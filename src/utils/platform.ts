import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isNative = Platform.OS !== 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// Utilitaires pour les fonctionnalités conditionnelles
export const supportsNativeFeatures = isNative;
export const supportsSecureStorage = isNative;
export const supportsBiometrics = isNative;
export const supportsLocationTracking = isNative;
export const supportsNotifications = isNative;

// Mock functions pour le web
export const webMockStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    localStorage.removeItem(key);
  },
};

export const webMockSecureStore = {
  getItemAsync: async (key: string): Promise<string | null> => {
    return localStorage.getItem(`secure_${key}`);
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(`secure_${key}`, value);
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    localStorage.removeItem(`secure_${key}`);
  },
};

export const webMockBiometrics = {
  hasHardwareAsync: async (): Promise<boolean> => false,
  isEnrolledAsync: async (): Promise<boolean> => false,
  authenticateAsync: async (): Promise<{ success: boolean }> => ({ success: false }),
};

export const webMockLocation = {
  requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
  getCurrentPositionAsync: async () => {
    throw new Error('Location not available on web');
  },
  watchPositionAsync: async () => {
    throw new Error('Location tracking not available on web');
  },
};
