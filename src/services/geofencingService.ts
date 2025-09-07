import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { SafeZone, Location as LocationType, GeofenceEvent } from '../types';
import { calculateDistance } from '../utils';
import { notificationService } from './notificationService';
import { API_ENDPOINTS, APP_CONFIG } from '../constants';

interface GeofenceState {
  zoneId: string;
  isInside: boolean;
  lastEntry?: Date;
  lastExit?: Date;
  entryCount: number;
  exitCount: number;
}

interface GeofenceAlert {
  id: string;
  zoneId: string;
  childId: string;
  type: 'enter' | 'exit';
  location: LocationType;
  timestamp: Date;
  acknowledged: boolean;
}

class GeofencingService {
  private geofenceStates: Map<string, GeofenceState> = new Map();
  private activeZones: Map<string, SafeZone> = new Map();
  private listeners: Set<(event: GeofenceEvent) => void> = new Set();
  private alertHistory: GeofenceAlert[] = [];

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    await this.loadGeofenceStates();
    await this.loadSafeZones();
    await this.loadAlertHistory();
  }

  // Safe Zone Management
  async createSafeZone(safeZoneData: Omit<SafeZone, 'id' | 'createdAt'>): Promise<SafeZone | null> {
    try {
      // Validate safe zone data
      const validationResult = this.validateSafeZone(safeZoneData);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error);
      }

      const safeZone: SafeZone = {
        ...safeZoneData,
        id: this.generateZoneId(),
        createdAt: new Date(),
      };

      // Save locally
      await this.saveSafeZoneLocally(safeZone);

      // Add to active zones
      this.activeZones.set(safeZone.id, safeZone);

      // Initialize geofence state
      this.geofenceStates.set(safeZone.id, {
        zoneId: safeZone.id,
        isInside: false,
        entryCount: 0,
        exitCount: 0,
      });

      // Sync with server
      await this.syncSafeZoneWithServer(safeZone);

      console.log(`Safe zone created: ${safeZone.name} (${safeZone.id})`);
      return safeZone;

    } catch (error) {
      console.error('Error creating safe zone:', error);
      return null;
    }
  }

  async updateSafeZone(safeZone: SafeZone): Promise<boolean> {
    try {
      // Validate updated data
      const validationResult = this.validateSafeZone(safeZone);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error);
      }

      // Update locally
      await this.updateSafeZoneLocally(safeZone);

      // Update active zones
      this.activeZones.set(safeZone.id, safeZone);

      // Sync with server
      await this.syncSafeZoneWithServer(safeZone);

      console.log(`Safe zone updated: ${safeZone.name} (${safeZone.id})`);
      return true;

    } catch (error) {
      console.error('Error updating safe zone:', error);
      return false;
    }
  }

  async deleteSafeZone(zoneId: string): Promise<boolean> {
    try {
      // Remove from active zones
      this.activeZones.delete(zoneId);

      // Remove geofence state
      this.geofenceStates.delete(zoneId);

      // Delete locally
      await this.deleteSafeZoneLocally(zoneId);

      // Delete from server
      await this.deleteSafeZoneFromServer(zoneId);

      // Clean up zone state storage
      await AsyncStorage.removeItem(`zone_state_${zoneId}`);

      console.log(`Safe zone deleted: ${zoneId}`);
      return true;

    } catch (error) {
      console.error('Error deleting safe zone:', error);
      return false;
    }
  }

  async getSafeZones(childId?: string): Promise<SafeZone[]> {
    try {
      const zones = Array.from(this.activeZones.values());
      
      if (childId) {
        return zones.filter(zone => zone.childId === childId);
      }
      
      return zones;
    } catch (error) {
      console.error('Error getting safe zones:', error);
      return [];
    }
  }

  async getSafeZone(zoneId: string): Promise<SafeZone | null> {
    return this.activeZones.get(zoneId) || null;
  }

  // Geofencing Logic
  async checkLocationAgainstGeofences(location: LocationType): Promise<GeofenceEvent[]> {
    const events: GeofenceEvent[] = [];

    try {
      const childZones = Array.from(this.activeZones.values())
        .filter(zone => zone.childId === location.childId && zone.isActive);

      for (const zone of childZones) {
        const event = await this.checkSingleGeofence(location, zone);
        if (event) {
          events.push(event);
        }
      }

    } catch (error) {
      console.error('Error checking geofences:', error);
    }

    return events;
  }

  private async checkSingleGeofence(location: LocationType, zone: SafeZone): Promise<GeofenceEvent | null> {
    try {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        zone.latitude,
        zone.longitude
      );

      const isCurrentlyInside = distance <= zone.radius;
      const state = this.geofenceStates.get(zone.id);
      const wasInside = state?.isInside || false;

      // Check for state changes
      if (isCurrentlyInside && !wasInside) {
        // Entry event
        const event: GeofenceEvent = {
          type: 'enter',
          safeZone: zone,
          location,
          timestamp: new Date(),
        };

        await this.handleGeofenceEvent(event);
        return event;

      } else if (!isCurrentlyInside && wasInside) {
        // Exit event
        const event: GeofenceEvent = {
          type: 'exit',
          safeZone: zone,
          location,
          timestamp: new Date(),
        };

        await this.handleGeofenceEvent(event);
        return event;
      }

      return null;

    } catch (error) {
      console.error('Error checking single geofence:', error);
      return null;
    }
  }

  private async handleGeofenceEvent(event: GeofenceEvent) {
    try {
      const { type, safeZone, location, timestamp } = event;

      // Update geofence state
      const currentState = this.geofenceStates.get(safeZone.id) || {
        zoneId: safeZone.id,
        isInside: false,
        entryCount: 0,
        exitCount: 0,
      };

      const updatedState: GeofenceState = {
        ...currentState,
        isInside: type === 'enter',
      };

      if (type === 'enter') {
        updatedState.lastEntry = timestamp;
        updatedState.entryCount++;
      } else {
        updatedState.lastExit = timestamp;
        updatedState.exitCount++;
      }

      this.geofenceStates.set(safeZone.id, updatedState);

      // Save state persistently
      await this.saveGeofenceState(safeZone.id, updatedState);

      // Create alert
      const alert: GeofenceAlert = {
        id: this.generateAlertId(),
        zoneId: safeZone.id,
        childId: safeZone.childId,
        type,
        location,
        timestamp,
        acknowledged: false,
      };

      this.alertHistory.push(alert);
      await this.saveAlertHistory();

      // Send notifications if enabled
      if ((type === 'enter' && safeZone.entryNotification) || 
          (type === 'exit' && safeZone.exitNotification)) {
        await this.sendGeofenceNotification(event);
      }

      // Notify listeners
      this.notifyListeners(event);

      console.log(`Geofence ${type}: ${safeZone.name}`);

    } catch (error) {
      console.error('Error handling geofence event:', error);
    }
  }

  private async sendGeofenceNotification(event: GeofenceEvent) {
    try {
      await notificationService.sendGeofenceAlert(event);
    } catch (error) {
      console.error('Error sending geofence notification:', error);
    }
  }

  // Zone Status and Analytics
  async getZoneStatus(zoneId: string): Promise<GeofenceState | null> {
    return this.geofenceStates.get(zoneId) || null;
  }

  async getZoneAnalytics(zoneId: string, days: number = 7): Promise<{
    totalEntries: number;
    totalExits: number;
    averageTimeInside: number;
    lastVisit?: Date;
    visits: Array<{ entry: Date; exit?: Date; duration?: number }>;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const zoneAlerts = this.alertHistory.filter(alert => 
        alert.zoneId === zoneId && 
        alert.timestamp >= cutoffDate
      );

      const entries = zoneAlerts.filter(alert => alert.type === 'enter')
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const exits = zoneAlerts.filter(alert => alert.type === 'exit')
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const visits: Array<{ entry: Date; exit?: Date; duration?: number }> = [];
      let totalDuration = 0;

      entries.forEach(entry => {
        const correspondingExit = exits.find(exit => 
          exit.timestamp > entry.timestamp &&
          !visits.some(visit => visit.exit && visit.exit.getTime() === exit.timestamp.getTime())
        );

        const visit = {
          entry: entry.timestamp,
          exit: correspondingExit?.timestamp,
          duration: correspondingExit ? 
            (correspondingExit.timestamp.getTime() - entry.timestamp.getTime()) / 1000 / 60 : // minutes
            undefined,
        };

        visits.push(visit);
        if (visit.duration) {
          totalDuration += visit.duration;
        }
      });

      return {
        totalEntries: entries.length,
        totalExits: exits.length,
        averageTimeInside: visits.length > 0 ? totalDuration / visits.length : 0,
        lastVisit: entries.length > 0 ? entries[entries.length - 1].timestamp : undefined,
        visits,
      };

    } catch (error) {
      console.error('Error getting zone analytics:', error);
      return {
        totalEntries: 0,
        totalExits: 0,
        averageTimeInside: 0,
        visits: [],
      };
    }
  }

  // Alert Management
  async getAlerts(childId?: string, acknowledged?: boolean): Promise<GeofenceAlert[]> {
    let alerts = [...this.alertHistory];

    if (childId) {
      alerts = alerts.filter(alert => alert.childId === childId);
    }

    if (acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === acknowledged);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this.alertHistory.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        await this.saveAlertHistory();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      return false;
    }
  }

  async clearAlertsHistory(): Promise<void> {
    try {
      this.alertHistory = [];
      await AsyncStorage.removeItem('geofence_alerts');
    } catch (error) {
      console.error('Error clearing alerts history:', error);
    }
  }

  // Validation
  private validateSafeZone(zone: Omit<SafeZone, 'id' | 'createdAt'>): { isValid: boolean; error?: string } {
    if (!zone.name || zone.name.trim().length === 0) {
      return { isValid: false, error: 'Le nom de la zone est requis' };
    }

    if (!zone.childId || zone.childId.trim().length === 0) {
      return { isValid: false, error: 'L\'ID de l\'enfant est requis' };
    }

    if (zone.radius < APP_CONFIG.MIN_SAFE_ZONE_RADIUS) {
      return { isValid: false, error: `Le rayon minimum est de ${APP_CONFIG.MIN_SAFE_ZONE_RADIUS}m` };
    }

    if (zone.radius > APP_CONFIG.MAX_SAFE_ZONE_RADIUS) {
      return { isValid: false, error: `Le rayon maximum est de ${APP_CONFIG.MAX_SAFE_ZONE_RADIUS}m` };
    }

    if (zone.latitude < -90 || zone.latitude > 90) {
      return { isValid: false, error: 'Latitude invalide' };
    }

    if (zone.longitude < -180 || zone.longitude > 180) {
      return { isValid: false, error: 'Longitude invalide' };
    }

    return { isValid: true };
  }

  // Data Persistence
  private async saveSafeZoneLocally(safeZone: SafeZone): Promise<void> {
    try {
      const existing = await this.getAllSafeZonesFromStorage();
      const updated = [...existing.filter(z => z.id !== safeZone.id), safeZone];
      await AsyncStorage.setItem('safe_zones', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving safe zone locally:', error);
    }
  }

  private async updateSafeZoneLocally(safeZone: SafeZone): Promise<void> {
    await this.saveSafeZoneLocally(safeZone);
  }

  private async deleteSafeZoneLocally(zoneId: string): Promise<void> {
    try {
      const existing = await this.getAllSafeZonesFromStorage();
      const updated = existing.filter(z => z.id !== zoneId);
      await AsyncStorage.setItem('safe_zones', JSON.stringify(updated));
    } catch (error) {
      console.error('Error deleting safe zone locally:', error);
    }
  }

  private async getAllSafeZonesFromStorage(): Promise<SafeZone[]> {
    try {
      const stored = await AsyncStorage.getItem('safe_zones');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading safe zones from storage:', error);
      return [];
    }
  }

  private async loadSafeZones(): Promise<void> {
    try {
      const zones = await this.getAllSafeZonesFromStorage();
      this.activeZones.clear();
      
      zones.forEach(zone => {
        this.activeZones.set(zone.id, zone);
      });

      console.log(`Loaded ${zones.length} safe zones`);
    } catch (error) {
      console.error('Error loading safe zones:', error);
    }
  }

  private async saveGeofenceState(zoneId: string, state: GeofenceState): Promise<void> {
    try {
      await AsyncStorage.setItem(`zone_state_${zoneId}`, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving geofence state:', error);
    }
  }

  private async loadGeofenceStates(): Promise<void> {
    try {
      const zones = await this.getAllSafeZonesFromStorage();
      
      for (const zone of zones) {
        try {
          const stateData = await AsyncStorage.getItem(`zone_state_${zone.id}`);
          if (stateData) {
            const state: GeofenceState = JSON.parse(stateData);
            this.geofenceStates.set(zone.id, state);
          }
        } catch (error) {
          console.error(`Error loading state for zone ${zone.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error loading geofence states:', error);
    }
  }

  private async saveAlertHistory(): Promise<void> {
    try {
      // Keep only last 1000 alerts
      const recentAlerts = this.alertHistory.slice(-1000);
      await AsyncStorage.setItem('geofence_alerts', JSON.stringify(recentAlerts));
    } catch (error) {
      console.error('Error saving alert history:', error);
    }
  }

  private async loadAlertHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('geofence_alerts');
      this.alertHistory = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading alert history:', error);
    }
  }

  // Server Synchronization
  private async syncSafeZoneWithServer(safeZone: SafeZone): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) return;

      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/safezones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(safeZone),
      });

      if (!response.ok) {
        console.warn('Failed to sync safe zone with server');
      }
    } catch (error) {
      console.error('Error syncing safe zone with server:', error);
    }
  }

  private async deleteSafeZoneFromServer(zoneId: string): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) return;

      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/safezones/${zoneId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('Failed to delete safe zone from server');
      }
    } catch (error) {
      console.error('Error deleting safe zone from server:', error);
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('auth_token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Event Listeners
  addGeofenceListener(callback: (event: GeofenceEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(event: GeofenceEvent): void {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in geofence listener:', error);
      }
    });
  }

  // Utility Methods
  private generateZoneId(): string {
    return `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  async cleanup(): Promise<void> {
    this.listeners.clear();
    this.activeZones.clear();
    this.geofenceStates.clear();
  }

  // Public API Summary
  async getGeofenceStats(): Promise<{
    totalZones: number;
    activeZones: number;
    totalAlerts: number;
    unacknowledgedAlerts: number;
  }> {
    const totalZones = this.activeZones.size;
    const activeZones = Array.from(this.activeZones.values()).filter(zone => zone.isActive).length;
    const totalAlerts = this.alertHistory.length;
    const unacknowledgedAlerts = this.alertHistory.filter(alert => !alert.acknowledged).length;

    return {
      totalZones,
      activeZones,
      totalAlerts,
      unacknowledgedAlerts,
    };
  }
}

export const geofencingService = new GeofencingService();
export default geofencingService;