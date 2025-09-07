import * as SecureStore from 'expo-secure-store';
import { API_ENDPOINTS } from '../constants';
import { 
  SOSAlert, 
  GeofenceEvent, 
  NotificationSettings, 
  ApiResponse 
} from '../types';

class NotificationService {
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
      return await SecureStore.getItemAsync('auth_token');
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      return null;
    }
  }

  // Gestion des tokens push
  async registerPushToken(token: string): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/register-token', {
        method: 'POST',
        body: JSON.stringify({ pushToken: token }),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du token push:', error);
      return false;
    }
  }

  async unregisterPushToken(): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/unregister-token', {
        method: 'DELETE',
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de la désinscription du token push:', error);
      return false;
    }
  }

  // Alertes SOS
  async sendSOSAlert(alert: SOSAlert): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>(API_ENDPOINTS.CREATE_SOS, {
        method: 'POST',
        body: JSON.stringify(alert),
      });

      if (response.success) {
        // Envoyer aussi une notification push prioritaire
        await this.sendPriorityPushNotification({
          title: '🚨 ALERTE SOS',
          body: 'Alerte d\'urgence reçue !',
          data: {
            type: 'sos_alert',
            alertId: alert.id,
            childId: alert.childId,
            location: alert.location,
          },
          priority: 'high',
          sound: 'sos_alert',
        });
      }

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'alerte SOS:', error);
      return false;
    }
  }

  async resolveSOSAlert(alertId: string): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>(
        `${API_ENDPOINTS.RESOLVE_SOS}/${alertId}`, 
        {
          method: 'PUT',
          body: JSON.stringify({ status: 'resolved' }),
        }
      );

      return response.success;
    } catch (error) {
      console.error('Erreur lors de la résolution de l\'alerte SOS:', error);
      return false;
    }
  }

  // Alertes de géofence
  async sendGeofenceAlert(event: GeofenceEvent): Promise<boolean> {
    try {
      const isEntry = event.type === 'enter';
      const title = isEntry ? '✅ Zone de sécurité' : '⚠️ Zone de sécurité';
      const body = isEntry 
        ? `Entrée dans la zone "${event.safeZone.name}"`
        : `Sortie de la zone "${event.safeZone.name}"`;

      const response = await this.makeAuthenticatedRequest<void>('/notifications/geofence', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          childId: event.safeZone.childId,
          safeZoneId: event.safeZone.id,
          eventType: event.type,
          location: event.location,
          timestamp: event.timestamp,
        }),
      });

      if (response.success) {
        await this.sendPushNotification({
          title,
          body,
          data: {
            type: `zone_${event.type}`,
            safeZoneId: event.safeZone.id,
            childId: event.safeZone.childId,
            location: event.location,
          },
        });
      }

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'alerte de géofence:', error);
      return false;
    }
  }

  // Alertes de batterie
  async sendBatteryAlert(childId: string, batteryLevel: number): Promise<boolean> {
    try {
      const isCritical = batteryLevel <= 5;
      const title = isCritical ? '🔋 Batterie critique' : '🔋 Batterie faible';
      const body = `Batterie à ${batteryLevel}% - Rechargez l'appareil`;

      const response = await this.makeAuthenticatedRequest<void>('/notifications/battery', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          childId,
          batteryLevel,
          isCritical,
        }),
      });

      if (response.success) {
        await this.sendPushNotification({
          title,
          body,
          data: {
            type: 'low_battery',
            childId,
            batteryLevel,
          },
          priority: isCritical ? 'high' : 'normal',
        });
      }

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'alerte de batterie:', error);
      return false;
    }
  }

  // Alertes hors ligne
  async sendOfflineAlert(childId: string): Promise<boolean> {
    try {
      const title = '📵 Appareil hors ligne';
      const body = 'L\'appareil de votre enfant est hors ligne';

      const response = await this.makeAuthenticatedRequest<void>('/notifications/offline', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          childId,
        }),
      });

      if (response.success) {
        await this.sendPushNotification({
          title,
          body,
          data: {
            type: 'device_offline',
            childId,
          },
        });
      }

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'alerte hors ligne:', error);
      return false;
    }
  }

  // Notifications push génériques
  private async sendPushNotification(notification: {
    title: string;
    body: string;
    data?: any;
    priority?: 'normal' | 'high';
    sound?: string;
  }): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/push', {
        method: 'POST',
        body: JSON.stringify(notification),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification push:', error);
      return false;
    }
  }

  private async sendPriorityPushNotification(notification: {
    title: string;
    body: string;
    data?: any;
    priority: 'high';
    sound?: string;
  }): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/push-priority', {
        method: 'POST',
        body: JSON.stringify(notification),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification prioritaire:', error);
      return false;
    }
  }

  // Gestion des paramètres de notification
  async updateSettings(settings: NotificationSettings): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>(API_ENDPOINTS.NOTIFICATION_SETTINGS, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des paramètres:', error);
      return false;
    }
  }

  async getSettings(): Promise<NotificationSettings | null> {
    try {
      const response = await this.makeAuthenticatedRequest<NotificationSettings>(
        API_ENDPOINTS.NOTIFICATION_SETTINGS
      );

      return response.success ? response.data || null : null;
    } catch (error) {
      console.error('Erreur lors de la récupération des paramètres:', error);
      return null;
    }
  }

  // Gestion des notifications lues/non lues
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>(
        `${API_ENDPOINTS.MARK_READ}/${notificationId}`, 
        {
          method: 'PUT',
        }
      );

      return response.success;
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
      return false;
    }
  }

  async markAllAsRead(): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>(API_ENDPOINTS.MARK_READ, {
        method: 'PUT',
        body: JSON.stringify({ markAll: true }),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors du marquage de toutes comme lues:', error);
      return false;
    }
  }

  // Envoi d'emails et SMS
  async sendEmailAlert(email: string, subject: string, message: string): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/email', {
        method: 'POST',
        body: JSON.stringify({
          email,
          subject,
          message,
        }),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      return false;
    }
  }

  async sendSMSAlert(phone: string, message: string): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/sms', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          message,
        }),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi du SMS:', error);
      return false;
    }
  }

  // Notifications programmées
  async scheduleNotification(notification: {
    title: string;
    body: string;
    data?: any;
    scheduledFor: Date;
  }): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/schedule', {
        method: 'POST',
        body: JSON.stringify(notification),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de la programmation de la notification:', error);
      return false;
    }
  }

  async cancelScheduledNotification(notificationId: string): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>(
        `/notifications/schedule/${notificationId}`, 
        {
          method: 'DELETE',
        }
      );

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la notification programmée:', error);
      return false;
    }
  }

  // Statistiques des notifications
  async getNotificationStats(): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  } | null> {
    try {
      const response = await this.makeAuthenticatedRequest<{
        total: number;
        unread: number;
        byType: Record<string, number>;
      }>('/notifications/stats');

      return response.success ? response.data || null : null;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return null;
    }
  }

  // Test des notifications
  async sendTestNotification(): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/test', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test TerranoKidsFind',
          body: 'Notification de test - Tout fonctionne correctement !',
          data: { type: 'test' },
        }),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification de test:', error);
      return false;
    }
  }

  // Nettoyage des anciennes notifications
  async cleanupOldNotifications(daysToKeep: number = 30): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest<void>('/notifications/cleanup', {
        method: 'DELETE',
        body: JSON.stringify({ daysToKeep }),
      });

      return response.success;
    } catch (error) {
      console.error('Erreur lors du nettoyage des notifications:', error);
      return false;
    }
  }

  // Utilitaires
  formatNotificationTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    
    return timestamp.toLocaleDateString('fr-FR');
  }

  getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      sos_alert: '🚨',
      zone_entry: '✅',
      zone_exit: '⚠️',
      low_battery: '🔋',
      device_offline: '📵',
      unauthorized_contact: '📞',
      screen_time_limit: '⏰',
      location_update: '📍',
    };

    return icons[type] || '📱';
  }

  getNotificationPriority(type: string): 'high' | 'normal' | 'low' {
    const priorities: Record<string, 'high' | 'normal' | 'low'> = {
      sos_alert: 'high',
      zone_exit: 'high',
      device_offline: 'high',
      low_battery: 'normal',
      zone_entry: 'normal',
      unauthorized_contact: 'normal',
      screen_time_limit: 'low',
      location_update: 'low',
    };

    return priorities[type] || 'normal';
  }
}

export const notificationService = new NotificationService();
export default notificationService;