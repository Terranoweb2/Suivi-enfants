import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Notification, NotificationType } from '../types';
import { isWeb } from '../utils/platform';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  hasPermission: boolean;
  sendNotification: (title: string, message: string, type?: NotificationType) => Promise<boolean>;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasPermission, setHasPermission] = useState(isWeb);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const sendNotification = async (title: string, message: string, type: NotificationType = 'location_update'): Promise<boolean> => {
    const newNotification: Notification = {
      id: `notification-${Date.now()}`,
      userId: 'demo-user-1',
      type,
      title,
      message,
      isRead: false,
      timestamp: new Date(),
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Afficher une notification web si possible
    if (isWeb && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
      });
    }

    return true;
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, isRead: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const requestPermission = async (): Promise<boolean> => {
    if (isWeb && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasPermission(granted);
      return granted;
    }
    return hasPermission;
  };

  const contextValue: NotificationContextType = {
    notifications: notifications || [],
    unreadCount,
    hasPermission,
    sendNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    requestPermission,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
