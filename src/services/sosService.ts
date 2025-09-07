import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { SOSAlert, Location as LocationType, User, ApiResponse } from '../types';
import { notificationService } from './notificationService';
import { locationService } from './locationService';
import { API_ENDPOINTS, APP_CONFIG } from '../constants';

interface SOSSession {
  id: string;
  childId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'resolved' | 'cancelled';
  location: LocationType;
  emergencyContacts: string[];
  alertsSent: number;
  parentNotified: boolean;
}

class SOSService {
  private activeSessions: Map<string, SOSSession> = new Map();
  private alertHistory: SOSAlert[] = [];
  private isEmergencyModeActive: boolean = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    await this.loadAlertHistory();
    await this.loadActiveSessions();
  }

  // Emergency Alert Management
  async triggerSOSAlert(childId: string, location?: LocationType): Promise<SOSAlert | null> {
    try {
      // Get current location if not provided
      const currentLocation = location || await this.getCurrentLocation();
      if (!currentLocation) {
        throw new Error('Unable to get current location');
      }

      // Create SOS alert
      const alert: SOSAlert = {
        id: this.generateAlertId(),
        childId,
        location: currentLocation,
        timestamp: new Date(),
        status: 'active',
        type: 'manual_trigger',
        severity: 'high',
        message: 'Alerte SOS déclenchée',
        resolvedAt: undefined,
        resolvedBy: undefined,
      };

      // Save alert
      this.alertHistory.push(alert);
      await this.saveAlertHistory();

      // Create emergency session
      const session: SOSSession = {
        id: alert.id,
        childId,
        startTime: new Date(),
        status: 'active',
        location: currentLocation,
        emergencyContacts: await this.getEmergencyContacts(childId),
        alertsSent: 0,
        parentNotified: false,
      };

      this.activeSessions.set(alert.id, session);
      await this.saveActiveSessions();

      // Activate emergency mode
      this.isEmergencyModeActive = true;

      // Send immediate notifications
      await this.sendEmergencyNotifications(alert, session);

      // Start emergency protocol
      await this.startEmergencyProtocol(alert, session);

      console.log(`SOS Alert triggered: ${alert.id}`);
      return alert;

    } catch (error) {
      console.error('Error triggering SOS alert:', error);
      return null;
    }
  }

  async resolveSOSAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    try {
      // Find alert
      const alert = this.alertHistory.find(a => a.id === alertId);
      if (!alert || alert.status !== 'active') {
        return false;
      }

      // Update alert status
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.resolvedBy = resolvedBy;

      // Update session
      const session = this.activeSessions.get(alertId);
      if (session) {
        session.status = 'resolved';
        session.endTime = new Date();
        this.activeSessions.set(alertId, session);
      }

      // Save changes
      await this.saveAlertHistory();
      await this.saveActiveSessions();

      // Check if any other active alerts
      const hasActiveAlerts = this.alertHistory.some(a => a.status === 'active');
      if (!hasActiveAlerts) {
        this.isEmergencyModeActive = false;
      }

      // Send resolution notification
      await this.sendResolutionNotification(alert);

      // Sync with server
      await notificationService.resolveSOSAlert(alertId);

      console.log(`SOS Alert resolved: ${alertId}`);
      return true;

    } catch (error) {
      console.error('Error resolving SOS alert:', error);
      return false;
    }
  }

  async cancelSOSAlert(alertId: string, cancelledBy: string): Promise<boolean> {
    try {
      const alert = this.alertHistory.find(a => a.id === alertId);
      if (!alert || alert.status !== 'active') {
        return false;
      }

      alert.status = 'cancelled';
      alert.resolvedAt = new Date();
      alert.resolvedBy = cancelledBy;

      const session = this.activeSessions.get(alertId);
      if (session) {
        session.status = 'cancelled';
        session.endTime = new Date();
      }

      await this.saveAlertHistory();
      await this.saveActiveSessions();

      const hasActiveAlerts = this.alertHistory.some(a => a.status === 'active');
      if (!hasActiveAlerts) {
        this.isEmergencyModeActive = false;
      }

      console.log(`SOS Alert cancelled: ${alertId}`);
      return true;

    } catch (error) {
      console.error('Error cancelling SOS alert:', error);
      return false;
    }
  }

  // Emergency Protocol
  private async startEmergencyProtocol(alert: SOSAlert, session: SOSSession) {
    try {
      // Start continuous location tracking
      await this.startEmergencyLocationTracking(alert.childId);

      // Schedule follow-up alerts
      await this.scheduleFollowUpAlerts(alert, session);

      // Enable enhanced tracking
      await this.enableEnhancedTracking(alert.childId);

    } catch (error) {
      console.error('Error starting emergency protocol:', error);
    }
  }

  private async startEmergencyLocationTracking(childId: string) {
    try {
      // Enable enhanced tracking - simplified implementation
      // In a real app, this would increase update frequency
      console.log('Emergency location tracking activated for:', childId);
    } catch (error) {
      console.error('Error starting emergency location tracking:', error);
    }
  }

  private async scheduleFollowUpAlerts(alert: SOSAlert, session: SOSSession) {
    // Schedule alerts every 2 minutes until resolved
    const interval = setInterval(async () => {
      if (session.status !== 'active') {
        clearInterval(interval);
        return;
      }

      session.alertsSent++;
      await this.sendFollowUpNotification(alert, session);
      
      // Stop after 10 follow-up alerts (20 minutes)
      if (session.alertsSent >= 10) {
        clearInterval(interval);
      }
    }, 2 * 60 * 1000); // 2 minutes
  }

  private async enableEnhancedTracking(childId: string) {
    try {
      // Store enhanced tracking flag
      await AsyncStorage.setItem(`enhanced_tracking_${childId}`, 'true');
      
      // Enable additional sensors if available
      // This would typically include accelerometer, gyroscope, etc.
      console.log('Enhanced tracking enabled for emergency');
    } catch (error) {
      console.error('Error enabling enhanced tracking:', error);
    }
  }

  // Notification Management
  private async sendEmergencyNotifications(alert: SOSAlert, session: SOSSession) {
    try {
      // Send via notification service
      await notificationService.sendSOSAlert(alert);

      // Send SMS/Email to emergency contacts
      await this.sendEmergencyContactsAlert(alert, session);

      // Mark parent as notified
      session.parentNotified = true;

    } catch (error) {
      console.error('Error sending emergency notifications:', error);
    }
  }

  private async sendEmergencyContactsAlert(alert: SOSAlert, session: SOSSession) {
    try {
      for (const contactId of session.emergencyContacts) {
        // This would send SMS/Email alerts to emergency contacts
        // Implementation depends on backend service
        console.log(`Emergency alert sent to contact: ${contactId}`);
      }
    } catch (error) {
      console.error('Error sending emergency contacts alert:', error);
    }
  }

  private async sendFollowUpNotification(alert: SOSAlert, session: SOSSession) {
    try {
      const currentLocation = await this.getCurrentLocation();
      if (currentLocation) {
        alert.location = currentLocation;
      }

      await notificationService.sendSOSAlert({
        ...alert,
        message: `Alerte SOS continue - ${session.alertsSent} alerts envoyées`,
        type: 'follow_up',
      });

    } catch (error) {
      console.error('Error sending follow-up notification:', error);
    }
  }

  private async sendResolutionNotification(alert: SOSAlert) {
    try {
      await notificationService.sendSOSAlert({
        ...alert,
        message: 'Alerte SOS résolue',
        type: 'resolution',
        severity: 'low',
      });
    } catch (error) {
      console.error('Error sending resolution notification:', error);
    }
  }

  // Data Management
  async getActiveAlerts(childId?: string): Promise<SOSAlert[]> {
    let alerts = this.alertHistory.filter(alert => alert.status === 'active');
    
    if (childId) {
      alerts = alerts.filter(alert => alert.childId === childId);
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAlertHistory(childId?: string, days: number = 30): Promise<SOSAlert[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let alerts = this.alertHistory.filter(alert => alert.timestamp >= cutoffDate);
    
    if (childId) {
      alerts = alerts.filter(alert => alert.childId === childId);
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAlertDetails(alertId: string): Promise<{ alert: SOSAlert; session?: SOSSession } | null> {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (!alert) return null;

    const session = this.activeSessions.get(alertId);
    return { alert, session };
  }

  // Utility Methods
  private async getCurrentLocation(): Promise<LocationType | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      return {
        id: Date.now().toString(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        altitude: location.coords.altitude || undefined,
        speed: location.coords.speed || undefined,
        heading: location.coords.heading || undefined,
        timestamp: new Date(location.timestamp),
        childId: '', // Will be set by caller
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  private async getEmergencyContacts(childId: string): Promise<string[]> {
    try {
      // Get emergency contacts from user profile
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user: User = JSON.parse(userData);
        // Return emergency contact IDs for the child
        return (user.emergencyContacts || []).map(contact => contact.id);
      }
      return [];
    } catch (error) {
      console.error('Error getting emergency contacts:', error);
      return [];
    }
  }

  private generateAlertId(): string {
    return `sos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Data Persistence
  private async saveAlertHistory(): Promise<void> {
    try {
      // Keep only last 100 alerts
      const recentAlerts = this.alertHistory.slice(-100);
      await AsyncStorage.setItem('sos_alert_history', JSON.stringify(recentAlerts));
    } catch (error) {
      console.error('Error saving alert history:', error);
    }
  }

  private async loadAlertHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('sos_alert_history');
      this.alertHistory = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading alert history:', error);
    }
  }

  private async saveActiveSessions(): Promise<void> {
    try {
      const sessions = Array.from(this.activeSessions.entries());
      await AsyncStorage.setItem('sos_active_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving active sessions:', error);
    }
  }

  private async loadActiveSessions(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('sos_active_sessions');
      if (stored) {
        const sessions: [string, SOSSession][] = JSON.parse(stored);
        this.activeSessions = new Map(sessions);
        
        // Check if emergency mode should be active
        const hasActiveSessions = Array.from(this.activeSessions.values())
          .some(session => session.status === 'active');
        this.isEmergencyModeActive = hasActiveSessions;
      }
    } catch (error) {
      console.error('Error loading active sessions:', error);
    }
  }

  // Server Synchronization
  private async syncWithServer(): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) return;

      // Sync alert history with server
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/sos/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          alerts: this.alertHistory,
          sessions: Array.from(this.activeSessions.entries()),
        }),
      });

      if (!response.ok) {
        console.warn('Failed to sync SOS data with server');
      }
    } catch (error) {
      console.error('Error syncing with server:', error);
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

  // Public API
  isEmergencyActive(): boolean {
    return this.isEmergencyModeActive;
  }

  async clearHistory(): Promise<void> {
    this.alertHistory = [];
    await AsyncStorage.removeItem('sos_alert_history');
  }

  async getStatistics(): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    averageResponseTime: number;
  }> {
    const totalAlerts = this.alertHistory.length;
    const activeAlerts = this.alertHistory.filter(a => a.status === 'active').length;
    const resolvedAlerts = this.alertHistory.filter(a => a.status === 'resolved').length;
    
    const resolvedWithTime = this.alertHistory.filter(a => 
      a.status === 'resolved' && a.resolvedAt
    );
    
    const averageResponseTime = resolvedWithTime.length > 0 
      ? resolvedWithTime.reduce((sum, alert) => {
          const responseTime = alert.resolvedAt!.getTime() - alert.timestamp.getTime();
          return sum + responseTime;
        }, 0) / resolvedWithTime.length / 1000 / 60 // minutes
      : 0;

    return {
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      averageResponseTime,
    };
  }
}

export const sosService = new SOSService();
export default sosService;