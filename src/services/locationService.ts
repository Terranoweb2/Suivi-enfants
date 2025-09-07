import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS, APP_CONFIG } from '../constants';
import { 
  Location, 
  SafeZone, 
  ApiResponse 
} from '../types';

class LocationService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_ENDPOINTS.BASE_URL;
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await this.getStoredToken();
      const url = `${this.baseURL}${endpoint}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Erreur serveur',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Erreur réseau:', error);
      return {
        success: false,
        error: 'Erreur de connexion',
      };
    }
  }

  private async getStoredToken(): Promise<string | null> {
    try {
      const { SecureStore } = await import('expo-secure-store');
      return await SecureStore.getItemAsync('auth_token');
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      return null;
    }
  }

  // Gestion des localisations
  async saveLocation(location: Location): Promise<Location | null> {
    try {
      // Sauvegarder localement
      await this.saveLocationLocally(location);

      // Envoyer au serveur
      const response = await this.makeAuthenticatedRequest<Location>(API_ENDPOINTS.LOCATION, {
        method: 'POST',
        body: JSON.stringify(location),
      });

      if (response.success && response.data) {
        return response.data;
      }

      return location; // Retourner la localisation même si l'envoi au serveur échoue
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la localisation:', error);
      return null;
    }
  }

  private async saveLocationLocally(location: Location): Promise<void> {
    try {
      const existingLocations = await this.getLocalLocations();
      const updatedLocations = [location, ...existingLocations].slice(0, 1000); // Garder les 1000 dernières
      
      await AsyncStorage.setItem('location_history', JSON.stringify(updatedLocations));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde locale:', error);
    }
  }

  private async getLocalLocations(): Promise<Location[]> {
    try {
      const stored = await AsyncStorage.getItem('location_history');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erreur lors de la récupération locale:', error);
      return [];
    }
  }

  async getLocationHistory(childId: string, days: number = 7): Promise<Location[]> {
    try {
      const response = await this.makeAuthenticatedRequest<Location[]>(
        `${API_ENDPOINTS.LOCATION_HISTORY}?childId=${childId}&days=${days}`
      );

      if (response.success && response.data) {
        return response.data;
      }

      // Fallback sur les données locales
      const localLocations = await this.getLocalLocations();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return localLocations.filter(location => 
        location.childId === childId && 
        new Date(location.timestamp) >= cutoffDate
      );
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
  }

  async getRecentLocationHistory(limit: number = 100): Promise<Location[]> {
    try {
      const localLocations = await this.getLocalLocations();
      return localLocations.slice(0, limit);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique récent:', error);
      return [];
    }
  }

  async clearLocationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem('location_history');
    } catch (error) {
      console.error('Erreur lors du nettoyage de l\'historique:', error);
    }
  }

  async getLiveLocation(childId: string): Promise<Location | null> {
    try {
      const response = await this.makeAuthenticatedRequest<Location>(
        `${API_ENDPOINTS.LIVE_TRACKING}?childId=${childId}`
      );

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de la récupération de la localisation en direct:', error);
      return null;
    }
  }

  // Gestion des zones de sécurité
  async getSafeZones(): Promise<SafeZone[]> {
    try {
      // Essayer de récupérer depuis le serveur
      const response = await this.makeAuthenticatedRequest<SafeZone[]>(API_ENDPOINTS.SAFE_ZONES);

      if (response.success && response.data) {
        // Sauvegarder localement
        await AsyncStorage.setItem('safe_zones', JSON.stringify(response.data));
        return response.data;
      }

      // Fallback sur les données locales
      const stored = await AsyncStorage.getItem('safe_zones');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erreur lors de la récupération des zones de sécurité:', error);
      
      // Fallback sur les données locales
      try {
        const stored = await AsyncStorage.getItem('safe_zones');
        return stored ? JSON.parse(stored) : [];
      } catch (localError) {
        console.error('Erreur lors de la récupération locale:', localError);
        return [];
      }
    }
  }

  async saveSafeZone(safeZone: SafeZone): Promise<SafeZone | null> {
    try {
      // Validation
      if (safeZone.radius < APP_CONFIG.MIN_SAFE_ZONE_RADIUS) {
        throw new Error(`Le rayon minimum est de ${APP_CONFIG.MIN_SAFE_ZONE_RADIUS}m`);
      }

      if (safeZone.radius > APP_CONFIG.MAX_SAFE_ZONE_RADIUS) {
        throw new Error(`Le rayon maximum est de ${APP_CONFIG.MAX_SAFE_ZONE_RADIUS}m`);
      }

      // Sauvegarder localement d'abord
      await this.saveSafeZoneLocally(safeZone);

      // Envoyer au serveur
      const response = await this.makeAuthenticatedRequest<SafeZone>(API_ENDPOINTS.CREATE_SAFE_ZONE, {
        method: 'POST',
        body: JSON.stringify(safeZone),
      });

      if (response.success && response.data) {
        // Mettre à jour la sauvegarde locale avec l'ID du serveur
        await this.updateSafeZoneLocally(response.data);
        return response.data;
      }

      return safeZone; // Retourner la zone même si l'envoi au serveur échoue
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la zone de sécurité:', error);
      return null;
    }
  }

  private async saveSafeZoneLocally(safeZone: SafeZone): Promise<void> {
    try {
      const existingSafeZones = await this.getSafeZones();
      const updatedSafeZones = [...existingSafeZones, safeZone];
      
      await AsyncStorage.setItem('safe_zones', JSON.stringify(updatedSafeZones));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde locale de la zone:', error);
    }
  }

  private async updateSafeZoneLocally(safeZone: SafeZone): Promise<void> {
    try {
      const existingSafeZones = await this.getSafeZones();
      const updatedSafeZones = existingSafeZones.map(zone => 
        zone.id === safeZone.id ? safeZone : zone
      );
      
      await AsyncStorage.setItem('safe_zones', JSON.stringify(updatedSafeZones));
    } catch (error) {
      console.error('Erreur lors de la mise à jour locale de la zone:', error);
    }
  }

  async updateSafeZone(safeZone: SafeZone): Promise<boolean> {
    try {
      // Validation
      if (safeZone.radius < APP_CONFIG.MIN_SAFE_ZONE_RADIUS) {
        throw new Error(`Le rayon minimum est de ${APP_CONFIG.MIN_SAFE_ZONE_RADIUS}m`);
      }

      if (safeZone.radius > APP_CONFIG.MAX_SAFE_ZONE_RADIUS) {
        throw new Error(`Le rayon maximum est de ${APP_CONFIG.MAX_SAFE_ZONE_RADIUS}m`);
      }

      // Mettre à jour localement
      await this.updateSafeZoneLocally(safeZone);

      // Envoyer au serveur
      const response = await this.makeAuthenticatedRequest<SafeZone>(
        `${API_ENDPOINTS.UPDATE_SAFE_ZONE}/${safeZone.id}`, 
        {
          method: 'PUT',
          body: JSON.stringify(safeZone),
        }
      );

      return response.success;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la zone de sécurité:', error);
      return false;
    }
  }

  async deleteSafeZone(safeZoneId: string): Promise<boolean> {
    try {
      // Supprimer localement
      await this.deleteSafeZoneLocally(safeZoneId);

      // Supprimer sur le serveur
      const response = await this.makeAuthenticatedRequest<void>(
        `${API_ENDPOINTS.DELETE_SAFE_ZONE}/${safeZoneId}`, 
        {
          method: 'DELETE',
        }
      );

      return response.success;
    } catch (error) {
      console.error('Erreur lors de la suppression de la zone de sécurité:', error);
      return false;
    }
  }

  private async deleteSafeZoneLocally(safeZoneId: string): Promise<void> {
    try {
      const existingSafeZones = await this.getSafeZones();
      const updatedSafeZones = existingSafeZones.filter(zone => zone.id !== safeZoneId);
      
      await AsyncStorage.setItem('safe_zones', JSON.stringify(updatedSafeZones));
    } catch (error) {
      console.error('Erreur lors de la suppression locale de la zone:', error);
    }
  }

  // Utilitaires de géolocalisation
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  }

  isLocationInSafeZone(location: Location, safeZone: SafeZone): boolean {
    const distance = this.calculateDistance(
      location.latitude,
      location.longitude,
      safeZone.latitude,
      safeZone.longitude
    );

    return distance <= safeZone.radius;
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      // Utiliser un service de géocodage inverse
      const response = await fetch(
        `https://api.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );

      if (response.ok) {
        const data = await response.json();
        return data.display_name || null;
      }

      return null;
    } catch (error) {
      console.error('Erreur lors du géocodage inverse:', error);
      return null;
    }
  }

  // Gestion des alertes de géofence
  async checkGeofenceViolations(location: Location): Promise<SafeZone[]> {
    try {
      const safeZones = await this.getSafeZones();
      const violations: SafeZone[] = [];

      for (const safeZone of safeZones) {
        if (safeZone.childId === location.childId && safeZone.isActive) {
          const isInside = this.isLocationInSafeZone(location, safeZone);
          
          // Vérifier si c'est une violation (sortie de zone)
          if (!isInside && safeZone.exitNotification) {
            violations.push(safeZone);
          }
        }
      }

      return violations;
    } catch (error) {
      console.error('Erreur lors de la vérification des violations de géofence:', error);
      return [];
    }
  }

  // Optimisation de batterie
  async optimizeLocationTracking(batteryLevel: number): Promise<{
    interval: number;
    accuracy: string;
  }> {
    if (batteryLevel < 20) {
      // Mode économie d'énergie
      return {
        interval: APP_CONFIG.LOCATION_UPDATE_INTERVAL * 3, // 90 secondes
        accuracy: 'low',
      };
    } else if (batteryLevel < 50) {
      // Mode normal
      return {
        interval: APP_CONFIG.LOCATION_UPDATE_INTERVAL * 2, // 60 secondes
        accuracy: 'medium',
      };
    } else {
      // Mode haute précision
      return {
        interval: APP_CONFIG.HIGH_ACCURACY_UPDATE_INTERVAL, // 10 secondes
        accuracy: 'high',
      };
    }
  }

  // Synchronisation des données
  async syncLocationData(): Promise<boolean> {
    try {
      const localLocations = await this.getLocalLocations();
      const unsyncedLocations = localLocations.filter(location => !location.id.includes('synced'));

      if (unsyncedLocations.length === 0) {
        return true;
      }

      const response = await this.makeAuthenticatedRequest<Location[]>('/location/bulk', {
        method: 'POST',
        body: JSON.stringify({ locations: unsyncedLocations }),
      });

      if (response.success) {
        // Marquer les locations comme synchronisées
        const syncedLocations = localLocations.map(location => ({
          ...location,
          id: location.id.includes('synced') ? location.id : `${location.id}_synced`,
        }));

        await AsyncStorage.setItem('location_history', JSON.stringify(syncedLocations));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      return false;
    }
  }

  // Nettoyage des données anciennes
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const localLocations = await this.getLocalLocations();
      const filteredLocations = localLocations.filter(location => 
        new Date(location.timestamp) >= cutoffDate
      );

      await AsyncStorage.setItem('location_history', JSON.stringify(filteredLocations));
    } catch (error) {
      console.error('Erreur lors du nettoyage des données:', error);
    }
  }
}

export const locationService = new LocationService();
export default locationService;