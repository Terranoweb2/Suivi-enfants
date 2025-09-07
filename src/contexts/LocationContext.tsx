import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Location as LocationType, 
  SafeZone, 
  GeofenceEvent, 
  LocationState 
} from '../types';
import { locationService } from '../services/locationService';
import { notificationService } from '../services/notificationService';
import { APP_CONFIG } from '../constants';

interface LocationContextType extends LocationState {
  requestPermissions: () => Promise<boolean>;
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
  getCurrentLocation: () => Promise<LocationType | null>;
  addSafeZone: (safeZone: Omit<SafeZone, 'id'>) => Promise<SafeZone | null>;
  removeSafeZone: (safeZoneId: string) => Promise<boolean>;
  updateSafeZone: (safeZone: SafeZone) => Promise<boolean>;
  getSafeZones: () => SafeZone[];
  getLocationHistory: (childId: string, days?: number) => Promise<LocationType[]>;
  clearLocationHistory: () => void;
  safeZones: SafeZone[];
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

const LOCATION_TRACKING_TASK = 'location-tracking-task';
const GEOFENCING_TASK = 'geofencing-task';

// Définir les tâches en arrière-plan
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Erreur de géolocalisation en arrière-plan:', error);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];
    
    if (location) {
      try {
        // Sauvegarder la localisation
        await locationService.saveLocation({
          id: Date.now().toString(),
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          speed: location.coords.speed,
          heading: location.coords.heading,
          timestamp: new Date(location.timestamp),
          childId: '', // À déterminer selon l'utilisateur connecté
        });

        // Vérifier les géofences
        const safeZones = await locationService.getSafeZones();
        for (const safeZone of safeZones) {
          const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            safeZone.latitude,
            safeZone.longitude
          );

          const isInside = distance <= safeZone.radius;
          const wasInside = await AsyncStorage.getItem(`geofence_${safeZone.id}`) === 'true';

          if (isInside && !wasInside) {
            // Entrée dans la zone
            await AsyncStorage.setItem(`geofence_${safeZone.id}`, 'true');
            if (safeZone.entryNotification) {
              await notificationService.sendGeofenceNotification({
                type: 'enter',
                safeZone,
                location: {
                  id: Date.now().toString(),
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  accuracy: location.coords.accuracy,
                  timestamp: new Date(location.timestamp),
                  childId: safeZone.childId,
                },
                timestamp: new Date(),
              });
            }
          } else if (!isInside && wasInside) {
            // Sortie de la zone
            await AsyncStorage.setItem(`geofence_${safeZone.id}`, 'false');
            if (safeZone.exitNotification) {
              await notificationService.sendGeofenceNotification({
                type: 'exit',
                safeZone,
                location: {
                  id: Date.now().toString(),
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  accuracy: location.coords.accuracy,
                  timestamp: new Date(location.timestamp),
                  childId: safeZone.childId,
                },
                timestamp: new Date(),
              });
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors du traitement de la localisation:', error);
      }
    }
  }
});

// Fonction utilitaire pour calculer la distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [state, setState] = useState<LocationState>({
    currentLocation: null,
    locationHistory: [],
    isTracking: false,
    hasPermission: false,
    error: null,
  });
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);

  useEffect(() => {
    checkPermissions();
    loadSafeZones();
    loadLocationHistory();
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setState(prev => ({ ...prev, hasPermission: status === 'granted' }));
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      setState(prev => ({ ...prev, error: 'Erreur de permission' }));
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      // Demander les permissions de localisation
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setState(prev => ({ 
          ...prev, 
          error: 'Permission de localisation refusée',
          hasPermission: false 
        }));
        return false;
      }

      // Demander les permissions en arrière-plan
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      const hasPermission = foregroundStatus === 'granted';
      setState(prev => ({ ...prev, hasPermission, error: null }));
      
      return hasPermission;
    } catch (error) {
      console.error('Erreur lors de la demande de permissions:', error);
      setState(prev => ({ ...prev, error: 'Erreur de permission', hasPermission: false }));
      return false;
    }
  };

  const startTracking = async (): Promise<boolean> => {
    try {
      if (!state.hasPermission) {
        const granted = await requestPermissions();
        if (!granted) return false;
      }

      setState(prev => ({ ...prev, isTracking: true, error: null }));

      // Démarrer le suivi en arrière-plan
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: APP_CONFIG.LOCATION_UPDATE_INTERVAL,
        distanceInterval: 10, // 10 mètres
        foregroundService: {
          notificationTitle: 'TerranoKidsFind',
          notificationBody: 'Suivi de localisation actif',
          notificationColor: '#1E90FF',
        },
      });

      return true;
    } catch (error) {
      console.error('Erreur lors du démarrage du suivi:', error);
      setState(prev => ({ 
        ...prev, 
        isTracking: false, 
        error: 'Impossible de démarrer le suivi' 
      }));
      return false;
    }
  };

  const stopTracking = async (): Promise<void> => {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      }

      setState(prev => ({ ...prev, isTracking: false }));
    } catch (error) {
      console.error('Erreur lors de l\'arrêt du suivi:', error);
    }
  };

  const getCurrentLocation = async (): Promise<LocationType | null> => {
    try {
      if (!state.hasPermission) {
        const granted = await requestPermissions();
        if (!granted) return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        maximumAge: APP_CONFIG.MAXIMUM_AGE,
        timeout: APP_CONFIG.LOCATION_TIMEOUT,
      });

      const currentLocation: LocationType = {
        id: Date.now().toString(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: new Date(location.timestamp),
        childId: '', // À déterminer selon l'utilisateur connecté
      };

      setState(prev => ({ 
        ...prev, 
        currentLocation,
        locationHistory: [currentLocation, ...prev.locationHistory].slice(0, 1000)
      }));

      // Sauvegarder la localisation
      await locationService.saveLocation(currentLocation);

      return currentLocation;
    } catch (error) {
      console.error('Erreur lors de l\'obtention de la localisation:', error);
      setState(prev => ({ ...prev, error: 'Impossible d\'obtenir la localisation' }));
      return null;
    }
  };

  const addSafeZone = async (safeZoneData: Omit<SafeZone, 'id'>): Promise<SafeZone | null> => {
    try {
      const safeZone: SafeZone = {
        ...safeZoneData,
        id: Date.now().toString(),
        createdAt: new Date(),
      };

      const savedSafeZone = await locationService.saveSafeZone(safeZone);
      
      if (savedSafeZone) {
        setSafeZones(prev => [...prev, savedSafeZone]);
        return savedSafeZone;
      }
      
      return null;
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la zone de sécurité:', error);
      setState(prev => ({ ...prev, error: 'Impossible d\'ajouter la zone de sécurité' }));
      return null;
    }
  };

  const removeSafeZone = async (safeZoneId: string): Promise<boolean> => {
    try {
      const success = await locationService.deleteSafeZone(safeZoneId);
      
      if (success) {
        setSafeZones(prev => prev.filter(zone => zone.id !== safeZoneId));
        // Nettoyer le cache de géofence
        await AsyncStorage.removeItem(`geofence_${safeZoneId}`);
      }
      
      return success;
    } catch (error) {
      console.error('Erreur lors de la suppression de la zone de sécurité:', error);
      setState(prev => ({ ...prev, error: 'Impossible de supprimer la zone de sécurité' }));
      return false;
    }
  };

  const updateSafeZone = async (safeZone: SafeZone): Promise<boolean> => {
    try {
      const success = await locationService.updateSafeZone(safeZone);
      
      if (success) {
        setSafeZones(prev => prev.map(zone => 
          zone.id === safeZone.id ? safeZone : zone
        ));
      }
      
      return success;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la zone de sécurité:', error);
      setState(prev => ({ ...prev, error: 'Impossible de mettre à jour la zone de sécurité' }));
      return false;
    }
  };

  const getSafeZones = (): SafeZone[] => {
    return safeZones;
  };

  const getLocationHistory = async (childId: string, days = 7): Promise<LocationType[]> => {
    try {
      const history = await locationService.getLocationHistory(childId, days);
      return history;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
  };

  const clearLocationHistory = (): void => {
    setState(prev => ({ ...prev, locationHistory: [] }));
    locationService.clearLocationHistory();
  };

  const loadSafeZones = async (): Promise<void> => {
    try {
      const zones = await locationService.getSafeZones();
      setSafeZones(zones);
    } catch (error) {
      console.error('Erreur lors du chargement des zones de sécurité:', error);
    }
  };

  const loadLocationHistory = async (): Promise<void> => {
    try {
      // Charger l'historique récent depuis le stockage local
      const history = await locationService.getRecentLocationHistory();
      setState(prev => ({ ...prev, locationHistory: history }));
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
    }
  };

  const value: LocationContextType = {
    ...state,
    requestPermissions,
    startTracking,
    stopTracking,
    getCurrentLocation,
    addSafeZone,
    removeSafeZone,
    updateSafeZone,
    getSafeZones,
    getLocationHistory,
    clearLocationHistory,
    safeZones,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation doit être utilisé dans un LocationProvider');
  }
  return context;
};

export default LocationProvider;