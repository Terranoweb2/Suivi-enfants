import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import { useLocation } from '../contexts/LocationContext';
import { Location as LocationType } from '../types';
import { APP_CONFIG } from '../constants';

interface UseLocationTrackingOptions {
  enableBackground?: boolean;
  accuracy?: Location.Accuracy;
  interval?: number;
  distanceFilter?: number;
  onLocationUpdate?: (location: LocationType) => void;
  onError?: (error: string) => void;
}

interface UseLocationTrackingReturn {
  currentLocation: LocationType | null;
  isTracking: boolean;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
  refreshLocation: () => Promise<LocationType | null>;
  locationHistory: LocationType[];
  clearHistory: () => void;
  batteryOptimized: boolean;
  setBatteryOptimized: (optimized: boolean) => void;
}

export const useLocationTracking = (
  options: UseLocationTrackingOptions = {}
): UseLocationTrackingReturn => {
  const {
    enableBackground = true,
    accuracy = Location.Accuracy.BestForNavigation,
    interval = APP_CONFIG.LOCATION_UPDATE_INTERVAL,
    distanceFilter = 10,
    onLocationUpdate,
    onError,
  } = options;

  const {
    currentLocation,
    isTracking,
    hasPermission,
    requestPermissions,
    startTracking: contextStartTracking,
    stopTracking: contextStopTracking,
    getCurrentLocation,
    locationHistory,
    clearLocationHistory,
  } = useLocation();

  const [localLocation, setLocalLocation] = useState<LocationType | null>(null);
  const [batteryOptimized, setBatteryOptimized] = useState(false);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground, refresh location
        if (isTracking) {
          refreshLocation();
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isTracking]);

  // Update local location when context location changes
  useEffect(() => {
    if (currentLocation) {
      setLocalLocation(currentLocation);
      onLocationUpdate?.(currentLocation);
    }
  }, [currentLocation, onLocationUpdate]);

  const getTrackingOptions = useCallback(() => {
    const baseOptions: Location.LocationOptions = {
      accuracy,
      distanceInterval: distanceFilter,
    };

    if (batteryOptimized) {
      // Battery optimized settings
      baseOptions.accuracy = Location.Accuracy.Balanced;
      baseOptions.timeInterval = interval * 2; // Double the interval
      baseOptions.distanceInterval = distanceFilter * 2; // Double the distance filter
    } else {
      // Normal settings
      baseOptions.timeInterval = interval;
    }

    return baseOptions;
  }, [accuracy, interval, distanceFilter, batteryOptimized]);

  const startTracking = useCallback(async (): Promise<boolean> => {
    try {
      if (!hasPermission) {
        const granted = await requestPermissions();
        if (!granted) {
          onError?.('Permission de localisation refusée');
          return false;
        }
      }

      // Start context-level tracking for background
      if (enableBackground) {
        const success = await contextStartTracking();
        if (!success) {
          onError?.('Impossible de démarrer le suivi en arrière-plan');
          return false;
        }
      }

      // Start foreground tracking
      const trackingOptions = getTrackingOptions();
      
      if (watcherRef.current) {
        watcherRef.current.remove();
      }

      watcherRef.current = await Location.watchPositionAsync(
        trackingOptions,
        (location) => {
          const newLocation: LocationType = {
            id: Date.now().toString(),
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            altitude: location.coords.altitude,
            speed: location.coords.speed,
            heading: location.coords.heading,
            timestamp: new Date(location.timestamp),
            childId: '', // Will be set by the location service
          };

          setLocalLocation(newLocation);
          onLocationUpdate?.(newLocation);
        }
      );

      return true;
    } catch (error) {
      console.error('Erreur lors du démarrage du suivi:', error);
      onError?.('Erreur lors du démarrage du suivi');
      return false;
    }
  }, [
    hasPermission,
    requestPermissions,
    enableBackground,
    contextStartTracking,
    getTrackingOptions,
    onLocationUpdate,
    onError,
  ]);

  const stopTracking = useCallback(() => {
    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }

    if (enableBackground) {
      contextStopTracking();
    }
  }, [enableBackground, contextStopTracking]);

  const refreshLocation = useCallback(async (): Promise<LocationType | null> => {
    try {
      const location = await getCurrentLocation();
      if (location) {
        setLocalLocation(location);
        onLocationUpdate?.(location);
      }
      return location;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la localisation:', error);
      onError?.('Erreur lors de la mise à jour de la localisation');
      return null;
    }
  }, [getCurrentLocation, onLocationUpdate, onError]);

  const clearHistory = useCallback(() => {
    clearLocationHistory();
  }, [clearLocationHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watcherRef.current) {
        watcherRef.current.remove();
      }
    };
  }, []);

  // Auto-adjust tracking based on battery optimization
  useEffect(() => {
    if (isTracking && watcherRef.current) {
      // Restart tracking with new options
      stopTracking();
      startTracking();
    }
  }, [batteryOptimized]);

  const finalLocation = localLocation || currentLocation;

  return {
    currentLocation: finalLocation,
    isTracking,
    accuracy: finalLocation?.accuracy || null,
    speed: finalLocation?.speed || null,
    heading: finalLocation?.heading || null,
    startTracking,
    stopTracking,
    refreshLocation,
    locationHistory,
    clearHistory,
    batteryOptimized,
    setBatteryOptimized,
  };
};

export default useLocationTracking;