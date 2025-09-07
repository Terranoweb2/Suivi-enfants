import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { Location as LocationType, Child, SafeZone } from '../types';
import { APP_CONFIG, API_ENDPOINTS } from '../constants';
import { calculateDistance } from '../utils';

const LOCATION_TASK_NAME = 'background-location-task';
const SYNC_TASK_NAME = 'location-sync-task';

interface GPSTrackingOptions {
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
  enableBackground: boolean;
  childId: string;
}

interface TrackingSession {
  id: string;
  childId: string;
  startTime: Date;
  endTime?: Date;
  totalDistance: number;
  locations: LocationType[];
  isActive: boolean;
}

class GPSTrackingService {
  private isTracking: boolean = false;
  private trackingSession: TrackingSession | null = null;
  private foregroundSubscription: Location.LocationSubscription | null = null;
  private lastKnownLocation: LocationType | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private listeners: Set<(location: LocationType) => void> = new Set();

  constructor() {
    this.setupAppStateListener();
    this.registerBackgroundTasks();
  }

  // App state management
  private setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState) => {
      if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        this.handleAppForeground();
      } else if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
        // App went to background
        this.handleAppBackground();
      }
      this.appState = nextAppState;
    });
  }

  private async handleAppForeground() {
    if (this.isTracking) {
      // Resume foreground tracking
      await this.startForegroundTracking();
      // Sync any cached locations
      await this.syncCachedLocations();
    }
  }

  private async handleAppBackground() {
    if (this.isTracking) {
      // Stop foreground tracking, background task will continue
      this.stopForegroundTracking();
    }
  }

  // Background task registration
  private registerBackgroundTasks() {
    // Location tracking task
    TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: any) => {
      if (error) {
        console.error('Background location task error:', error);
        return;
      }

      if (data) {
        const { locations } = data;
        this.handleBackgroundLocationUpdate(locations);
      }
    });

    // Data sync task
    TaskManager.defineTask(SYNC_TASK_NAME, async () => {
      try {
        await this.syncCachedLocations();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('Background sync error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }

  // Permission management
  async requestPermissions(): Promise<boolean> {
    try {
      // Request foreground permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.warn('Foreground location permission denied');
        return false;
      }

      // Request background permissions
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission denied');
        // Continue with foreground only
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  // Main tracking control
  async startTracking(options: Partial<GPSTrackingOptions> = {}): Promise<boolean> {
    try {
      if (this.isTracking) {
        console.warn('GPS tracking already active');
        return true;
      }

      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        throw new Error('Location permissions required');
      }

      const trackingOptions: GPSTrackingOptions = {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: APP_CONFIG.HIGH_ACCURACY_UPDATE_INTERVAL,
        distanceInterval: 5, // 5 meters
        enableBackground: true,
        childId: options.childId || '',
        ...options,
      };

      // Create new tracking session
      this.trackingSession = {
        id: Date.now().toString(),
        childId: trackingOptions.childId,
        startTime: new Date(),
        totalDistance: 0,
        locations: [],
        isActive: true,
      };

      // Start foreground tracking
      await this.startForegroundTracking(trackingOptions);

      // Start background tracking if enabled
      if (trackingOptions.enableBackground) {
        await this.startBackgroundTracking(trackingOptions);
      }

      // Register background sync
      await this.setupBackgroundSync();

      this.isTracking = true;
      
      // Save tracking state
      await this.saveTrackingState();

      console.log('GPS tracking started successfully');
      return true;

    } catch (error) {
      console.error('Failed to start GPS tracking:', error);
      return false;
    }
  }

  async stopTracking(): Promise<void> {
    try {
      if (!this.isTracking) {
        return;
      }

      // Stop foreground tracking
      this.stopForegroundTracking();

      // Stop background tracking
      await this.stopBackgroundTracking();

      // Finalize tracking session
      if (this.trackingSession) {
        this.trackingSession.endTime = new Date();
        this.trackingSession.isActive = false;
        
        // Save final session
        await this.saveTrackingSession(this.trackingSession);
      }

      // Sync remaining data
      await this.syncCachedLocations();

      this.isTracking = false;
      this.trackingSession = null;

      // Clear tracking state
      await this.clearTrackingState();

      console.log('GPS tracking stopped successfully');

    } catch (error) {
      console.error('Error stopping GPS tracking:', error);
    }
  }

  // Foreground tracking
  private async startForegroundTracking(options?: GPSTrackingOptions) {
    try {
      if (this.foregroundSubscription) {
        this.foregroundSubscription.remove();
      }

      const trackingOptions = options || {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: APP_CONFIG.HIGH_ACCURACY_UPDATE_INTERVAL,
        distanceInterval: 5,
        enableBackground: true,
        childId: '',
      };

      this.foregroundSubscription = await Location.watchPositionAsync(
        {
          accuracy: trackingOptions.accuracy,
          timeInterval: trackingOptions.timeInterval,
          distanceInterval: trackingOptions.distanceInterval,
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

    } catch (error) {
      console.error('Error starting foreground tracking:', error);
    }
  }

  private stopForegroundTracking() {
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }
  }

  // Background tracking
  private async startBackgroundTracking(options: GPSTrackingOptions) {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: options.accuracy,
        timeInterval: options.timeInterval,
        distanceInterval: options.distanceInterval,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'TerranoKidsFind',
          notificationBody: 'Localisation de sécurité active',
          notificationColor: '#1E90FF',
        },
      });

    } catch (error) {
      console.error('Error starting background tracking:', error);
    }
  }

  private async stopBackgroundTracking() {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (error) {
      console.error('Error stopping background tracking:', error);
    }
  }

  // Location update handlers
  private handleLocationUpdate(locationData: Location.LocationObject) {
    const location: LocationType = {
      id: Date.now().toString(),
      latitude: locationData.coords.latitude,
      longitude: locationData.coords.longitude,
      accuracy: locationData.coords.accuracy || 0,
      altitude: locationData.coords.altitude,
      speed: locationData.coords.speed,
      heading: locationData.coords.heading,
      timestamp: new Date(locationData.timestamp),
      childId: this.trackingSession?.childId || '',
    };

    this.processLocationUpdate(location);
  }

  private async handleBackgroundLocationUpdate(locations: Location.LocationObject[]) {
    for (const locationData of locations) {
      const location: LocationType = {
        id: Date.now().toString(),
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        accuracy: locationData.coords.accuracy || 0,
        altitude: locationData.coords.altitude,
        speed: locationData.coords.speed,
        heading: locationData.coords.heading,
        timestamp: new Date(locationData.timestamp),
        childId: this.trackingSession?.childId || '',
      };

      this.processLocationUpdate(location);
    }
  }

  private async processLocationUpdate(location: LocationType) {
    try {
      // Update session data
      if (this.trackingSession) {
        this.trackingSession.locations.push(location);
        
        // Calculate distance traveled
        if (this.lastKnownLocation) {
          const distance = calculateDistance(
            this.lastKnownLocation.latitude,
            this.lastKnownLocation.longitude,
            location.latitude,
            location.longitude
          );
          this.trackingSession.totalDistance += distance;
        }
      }

      // Cache location locally
      await this.cacheLocation(location);

      // Check geofences
      await this.checkGeofences(location);

      // Notify listeners
      this.notifyListeners(location);

      // Update last known location
      this.lastKnownLocation = location;

      // Try to sync if connected
      await this.trySyncLocation(location);

    } catch (error) {
      console.error('Error processing location update:', error);
    }
  }

  // Geofencing
  private async checkGeofences(location: LocationType) {
    try {
      const safeZones = await this.getSafeZones(location.childId);
      
      for (const zone of safeZones) {
        if (!zone.isActive) continue;

        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          zone.latitude,
          zone.longitude
        );

        const isInside = distance <= zone.radius;
        const wasInside = await this.getZoneState(zone.id);

        if (isInside && !wasInside) {
          // Entered zone
          await this.setZoneState(zone.id, true);
          await this.triggerGeofenceEvent('enter', zone, location);
        } else if (!isInside && wasInside) {
          // Exited zone
          await this.setZoneState(zone.id, false);
          await this.triggerGeofenceEvent('exit', zone, location);
        }
      }
    } catch (error) {
      console.error('Error checking geofences:', error);
    }
  }

  // Data management
  private async cacheLocation(location: LocationType) {
    try {
      const cached = await AsyncStorage.getItem('cached_locations');
      const locations: LocationType[] = cached ? JSON.parse(cached) : [];
      
      locations.push(location);
      
      // Keep only last 1000 locations
      if (locations.length > 1000) {
        locations.splice(0, locations.length - 1000);
      }

      await AsyncStorage.setItem('cached_locations', JSON.stringify(locations));
    } catch (error) {
      console.error('Error caching location:', error);
    }
  }

  private async syncCachedLocations() {
    try {
      const cached = await AsyncStorage.getItem('cached_locations');
      if (!cached) return;

      const locations: LocationType[] = JSON.parse(cached);
      const unsyncedLocations = locations.filter(loc => !loc.id.includes('synced'));

      if (unsyncedLocations.length === 0) return;

      // Send to server
      const response = await this.syncWithServer(unsyncedLocations);
      
      if (response.success) {
        // Mark as synced
        const syncedLocations = locations.map(loc => ({
          ...loc,
          id: loc.id.includes('synced') ? loc.id : `${loc.id}_synced`
        }));

        await AsyncStorage.setItem('cached_locations', JSON.stringify(syncedLocations));
        console.log(`Synced ${unsyncedLocations.length} locations`);
      }

    } catch (error) {
      console.error('Error syncing cached locations:', error);
    }
  }

  // Server communication
  private async trySyncLocation(location: LocationType) {
    try {
      await this.syncWithServer([location]);
    } catch (error) {
      // Silent fail, will be retried in background sync
      console.warn('Immediate sync failed, will retry later');
    }
  }

  private async syncWithServer(locations: LocationType[]) {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${API_ENDPOINTS.BASE_URL}/location/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ locations }),
    });

    return await response.json();
  }

  // Utility methods
  private async getAuthToken(): Promise<string | null> {
    try {
      const { SecureStore } = await import('expo-secure-store');
      return await SecureStore.getItemAsync('auth_token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async getSafeZones(childId: string): Promise<SafeZone[]> {
    try {
      const cached = await AsyncStorage.getItem('safe_zones');
      const zones: SafeZone[] = cached ? JSON.parse(cached) : [];
      return zones.filter(zone => zone.childId === childId);
    } catch (error) {
      console.error('Error getting safe zones:', error);
      return [];
    }
  }

  private async getZoneState(zoneId: string): Promise<boolean> {
    try {
      const state = await AsyncStorage.getItem(`zone_state_${zoneId}`);
      return state === 'true';
    } catch (error) {
      return false;
    }
  }

  private async setZoneState(zoneId: string, inside: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(`zone_state_${zoneId}`, inside.toString());
    } catch (error) {
      console.error('Error setting zone state:', error);
    }
  }

  private async triggerGeofenceEvent(type: 'enter' | 'exit', zone: SafeZone, location: LocationType) {
    try {
      // Trigger notification
      const { notificationService } = await import('./notificationService');
      await notificationService.sendGeofenceNotification({
        type,
        safeZone: zone,
        location,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error triggering geofence event:', error);
    }
  }

  // Background sync setup
  private async setupBackgroundSync() {
    try {
      await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
        minimumInterval: 60, // 1 minute
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (error) {
      console.error('Error setting up background sync:', error);
    }
  }

  // State persistence
  private async saveTrackingState() {
    try {
      await AsyncStorage.setItem('gps_tracking_active', 'true');
      if (this.trackingSession) {
        await AsyncStorage.setItem('tracking_session', JSON.stringify(this.trackingSession));
      }
    } catch (error) {
      console.error('Error saving tracking state:', error);
    }
  }

  private async clearTrackingState() {
    try {
      await AsyncStorage.removeItem('gps_tracking_active');
      await AsyncStorage.removeItem('tracking_session');
    } catch (error) {
      console.error('Error clearing tracking state:', error);
    }
  }

  private async saveTrackingSession(session: TrackingSession) {
    try {
      const sessions = await this.getTrackingSessions();
      sessions.push(session);
      
      // Keep only last 30 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const filteredSessions = sessions.filter(s => new Date(s.startTime) >= cutoff);
      
      await AsyncStorage.setItem('tracking_sessions', JSON.stringify(filteredSessions));
    } catch (error) {
      console.error('Error saving tracking session:', error);
    }
  }

  // Public API
  async getCurrentLocation(): Promise<LocationType | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        maximumAge: 10000, // 10 seconds
      });

      return {
        id: Date.now().toString(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: new Date(location.timestamp),
        childId: this.trackingSession?.childId || '',
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return this.lastKnownLocation;
    }
  }

  isActivelyTracking(): boolean {
    return this.isTracking;
  }

  getCurrentSession(): TrackingSession | null {
    return this.trackingSession;
  }

  getLastKnownLocation(): LocationType | null {
    return this.lastKnownLocation;
  }

  async getTrackingSessions(): Promise<TrackingSession[]> {
    try {
      const sessions = await AsyncStorage.getItem('tracking_sessions');
      return sessions ? JSON.parse(sessions) : [];
    } catch (error) {
      console.error('Error getting tracking sessions:', error);
      return [];
    }
  }

  async getLocationHistory(childId: string, days: number = 7): Promise<LocationType[]> {
    try {
      const sessions = await this.getTrackingSessions();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const relevantSessions = sessions.filter(session => 
        session.childId === childId && 
        new Date(session.startTime) >= cutoff
      );

      const locations: LocationType[] = [];
      relevantSessions.forEach(session => {
        locations.push(...session.locations);
      });

      return locations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Error getting location history:', error);
      return [];
    }
  }

  // Event listeners
  addLocationListener(callback: (location: LocationType) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(location: LocationType) {
    this.listeners.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Error in location listener:', error);
      }
    });
  }

  // Cleanup
  async cleanup() {
    await this.stopTracking();
    this.listeners.clear();
  }
}

export const gpsTrackingService = new GPSTrackingService();
export default gpsTrackingService;