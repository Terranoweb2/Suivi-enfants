import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Notification, 
  NotificationType, 
  SOSAlert, 
  GeofenceEvent,
  NotificationSettings 
} from '../types';
import { notificationService } from '../services/notificationService';
import { APP_CONFIG } from '../constants';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  expoPushToken: string | null;
  settings: NotificationSettings;
  hasPermission: boolean;
  requestPermissions: () => Promise<boolean>;
  sendSOSNotification: (alert: SOSAlert) => Promise<void>;
  sendGeofenceNotification: (event: GeofenceEvent) => Promise<void>;
  sendBatteryNotification: (childId: string, level: number) => Promise<void>;
  sendOfflineNotification: (childId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  subscribeToNotifications: (callback: (notification: Notification) => void) => () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  pushNotifications: true,
  emailNotifications: true,
  smsNotifications: false,
  sosAlerts: true,
  zoneAlerts: true,
  batteryAlerts: true,
  offlineAlerts: true,
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [hasPermission, setHasPermission] = useState(false);
  
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const subscribers = useRef<Set<(notification: Notification) => void>>(new Set());

  useEffect(() => {
    registerForPushNotificationsAsync();
    loadSettings();
    loadNotifications();

    // Écouter les notifications reçues
    notificationListener.current = Notifications.addNotificationReceivedListener(handleNotificationReceived);

    // Écouter les réponses aux notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const registerForPushNotificationsAsync = async () => {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E90FF',
      });

      // Canal pour les alertes SOS
      await Notifications.setNotificationChannelAsync('sos', {
        name: 'Alertes SOS',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D32F2F',
        sound: 'sos_alert.wav',
      });

      // Canal pour les zones de sécurité
      await Notifications.setNotificationChannelAsync('geofence', {
        name: 'Zones de sécurité',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6D00',
      });

      // Canal pour la batterie
      await Notifications.setNotificationChannelAsync('battery', {
        name: 'Batterie',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lightColor: '#FF9800',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        setHasPermission(false);
        console.warn('Permissions de notification refusées');
        return;
      }
      
      setHasPermission(true);
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Token push:', token);
    } else {
      console.warn('Les notifications push ne fonctionnent que sur un appareil physique');
    }

    setExpoPushToken(token || null);
    
    if (token) {
      // Envoyer le token au serveur
      await notificationService.registerPushToken(token);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      
      if (granted && !expoPushToken) {
        await registerForPushNotificationsAsync();
      }
      
      return granted;
    } catch (error) {
      console.error('Erreur lors de la demande de permissions:', error);
      return false;
    }
  };

  const handleNotificationReceived = (notification: Notifications.Notification) => {
    console.log('Notification reçue:', notification);
    
    const customNotification: Notification = {
      id: notification.request.identifier,
      userId: '', // À déterminer selon le contexte
      type: notification.request.content.data?.type || 'info',
      title: notification.request.content.title || '',
      message: notification.request.content.body || '',
      data: notification.request.content.data,
      isRead: false,
      timestamp: new Date(),
    };

    setNotifications(prev => [customNotification, ...prev].slice(0, APP_CONFIG.MAX_NOTIFICATION_HISTORY));
    
    // Notifier les abonnés
    subscribers.current.forEach(callback => callback(customNotification));
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    console.log('Réponse à la notification:', response);
    
    const data = response.notification.request.content.data;
    
    // Gérer les actions selon le type de notification
    switch (data?.type) {
      case 'sos_alert':
        // Naviguer vers l'écran d'alerte SOS
        break;
      case 'zone_entry':
      case 'zone_exit':
        // Naviguer vers la carte
        break;
      case 'low_battery':
        // Naviguer vers les détails de l'enfant
        break;
    }
  };

  const sendSOSNotification = async (alert: SOSAlert): Promise<void> => {
    try {
      if (!settings.sosAlerts) return;

      const content: Notifications.NotificationContentInput = {
        title: '🚨 ALERTE SOS',
        body: `Alerte d'urgence reçue !`,
        data: {
          type: 'sos_alert',
          alertId: alert.id,
          childId: alert.childId,
          location: alert.location,
        },
        sound: 'sos_alert.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      });

      // Envoyer aussi via le service de notification
      await notificationService.sendSOSAlert(alert);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'alerte SOS:', error);
    }
  };

  const sendGeofenceNotification = async (event: GeofenceEvent): Promise<void> => {
    try {
      if (!settings.zoneAlerts) return;

      const isEntry = event.type === 'enter';
      const title = isEntry ? '✅ Zone de sécurité' : '⚠️ Zone de sécurité';
      const body = isEntry 
        ? `Entrée dans la zone "${event.safeZone.name}"`
        : `Sortie de la zone "${event.safeZone.name}"`;

      const content: Notifications.NotificationContentInput = {
        title,
        body,
        data: {
          type: `zone_${event.type}`,
          safeZoneId: event.safeZone.id,
          childId: event.safeZone.childId,
          location: event.location,
        },
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
        identifier: `geofence_${event.safeZone.id}_${event.type}`,
      });

      await notificationService.sendGeofenceAlert(event);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification de géofence:', error);
    }
  };

  const sendBatteryNotification = async (childId: string, level: number): Promise<void> => {
    try {
      if (!settings.batteryAlerts) return;

      const isCritical = level <= APP_CONFIG.CRITICAL_BATTERY_THRESHOLD;
      const title = isCritical ? '🔋 Batterie critique' : '🔋 Batterie faible';
      const body = `Batterie à ${level}% - Rechargez l'appareil`;

      const content: Notifications.NotificationContentInput = {
        title,
        body,
        data: {
          type: 'low_battery',
          childId,
          batteryLevel: level,
        },
        priority: isCritical 
          ? Notifications.AndroidNotificationPriority.HIGH 
          : Notifications.AndroidNotificationPriority.DEFAULT,
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
        identifier: `battery_${childId}_${level}`,
      });

      await notificationService.sendBatteryAlert(childId, level);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification de batterie:', error);
    }
  };

  const sendOfflineNotification = async (childId: string): Promise<void> => {
    try {
      if (!settings.offlineAlerts) return;

      const content: Notifications.NotificationContentInput = {
        title: '📵 Appareil hors ligne',
        body: 'L\'appareil de votre enfant est hors ligne',
        data: {
          type: 'device_offline',
          childId,
        },
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
        identifier: `offline_${childId}`,
      });

      await notificationService.sendOfflineAlert(childId);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification hors ligne:', error);
    }
  };

  const markAsRead = async (notificationId: string): Promise<void> => {
    try {
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );

      await notificationService.markAsRead(notificationId);
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
    }
  };

  const markAllAsRead = async (): Promise<void> => {
    try {
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );

      await notificationService.markAllAsRead();
    } catch (error) {
      console.error('Erreur lors du marquage de toutes comme lues:', error);
    }
  };

  const clearNotifications = (): void => {
    setNotifications([]);
    Notifications.dismissAllNotificationsAsync();
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>): Promise<void> => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      
      await AsyncStorage.setItem('notification_settings', JSON.stringify(updatedSettings));
      await notificationService.updateSettings(updatedSettings);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des paramètres:', error);
    }
  };

  const subscribeToNotifications = (callback: (notification: Notification) => void): (() => void) => {
    subscribers.current.add(callback);
    
    return () => {
      subscribers.current.delete(callback);
    };
  };

  const loadSettings = async (): Promise<void> => {
    try {
      const savedSettings = await AsyncStorage.getItem('notification_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
    }
  };

  const loadNotifications = async (): Promise<void> => {
    try {
      const savedNotifications = await AsyncStorage.getItem('notifications');
      if (savedNotifications) {
        const parsed = JSON.parse(savedNotifications);
        setNotifications(parsed);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    }
  };

  // Calculer le nombre de notifications non lues
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Sauvegarder les notifications localement
  useEffect(() => {
    AsyncStorage.setItem('notifications', JSON.stringify(notifications))
      .catch(error => console.error('Erreur lors de la sauvegarde des notifications:', error));
  }, [notifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    expoPushToken,
    settings,
    hasPermission,
    requestPermissions,
    sendSOSNotification,
    sendGeofenceNotification,
    sendBatteryNotification,
    sendOfflineNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    updateSettings,
    subscribeToNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications doit être utilisé dans un NotificationProvider');
  }
  return context;
};

export default NotificationProvider;