/**
 * Utility functions for TerranoKidsFind
 */

// Date and time utilities
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateTime = (date: Date): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

export const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  
  return formatDate(date);
};

export const formatDistanceToNow = (date: Date): string => {
  return getTimeAgo(date);
};

// Location utilities
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
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

export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

// String utilities
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength - 3) + '...';
};

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatPhoneNumber = (phone: string): string => {
  // Simple French phone number formatting
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('33')) {
    const withoutCountry = cleaned.slice(2);
    return `+33 ${withoutCountry.slice(0, 1)} ${withoutCountry.slice(1, 3)} ${withoutCountry.slice(3, 5)} ${withoutCountry.slice(5, 7)} ${withoutCountry.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
};

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password);
};

// Storage utilities
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const sanitizeForStorage = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }));
};

// Color utilities
export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Battery utilities
export const getBatteryColor = (level: number): string => {
  if (level <= 15) return '#F44336'; // Red
  if (level <= 30) return '#FF9800'; // Orange
  if (level <= 50) return '#FFC107'; // Yellow
  return '#4CAF50'; // Green
};

export const getBatteryIcon = (level: number, isCharging: boolean): string => {
  if (isCharging) return '🔌';
  if (level <= 15) return '🪫';
  if (level <= 30) return '🔋';
  if (level <= 60) return '🔋';
  return '🔋';
};

// Emergency utilities
export const formatEmergencyMessage = (
  childName: string,
  location: { latitude: number; longitude: number },
  timestamp: Date
): string => {
  return `🚨 ALERTE SOS - ${childName}\n\nLocalisation: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}\nHeure: ${formatDateTime(timestamp)}\n\nCeci est une alerte d'urgence automatique de TerranoKidsFind.`;
};

// Geofencing utilities
export const isPointInCircle = (
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radius: number
): boolean => {
  const distance = calculateDistance(pointLat, pointLon, centerLat, centerLon);
  return distance <= radius;
};

// Device utilities
export const getDeviceType = (): 'phone' | 'tablet' | 'unknown' => {
  // This would be implemented with device detection logic
  return 'phone';
};

export const isLandscape = (width: number, height: number): boolean => {
  return width > height;
};

// Error handling utilities
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'Une erreur inconnue s\'est produite';
};

export const logError = (error: any, context?: string): void => {
  console.error(`[TerranoKidsFind${context ? ` - ${context}` : ''}]:`, error);
  // In production, you might want to send this to a crash reporting service
};

// Permission utilities
export const getPermissionMessage = (permission: string): string => {
  const messages: Record<string, string> = {
    location: 'Cette application a besoin d\'accéder à votre localisation pour suivre et protéger vos enfants.',
    camera: 'Cette application peut utiliser la caméra pour les fonctionnalités de sécurité.',
    microphone: 'Cette application peut utiliser le microphone pour la fonction d\'écoute de l\'environnement de sécurité.',
    contacts: 'Cette application accède aux contacts pour gérer les numéros autorisés.',
    notifications: 'Cette application envoie des notifications pour les alertes de sécurité importantes.',
  };
  
  return messages[permission] || 'Cette permission est nécessaire pour le bon fonctionnement de l\'application.';
};

export default {
  formatDate,
  formatTime,
  formatDateTime,
  getTimeAgo,
  calculateDistance,
  formatDistance,
  truncateText,
  capitalizeFirst,
  formatPhoneNumber,
  isValidEmail,
  isValidPhone,
  isValidPassword,
  generateId,
  sanitizeForStorage,
  hexToRgba,
  getBatteryColor,
  getBatteryIcon,
  formatEmergencyMessage,
  isPointInCircle,
  getDeviceType,
  isLandscape,
  getErrorMessage,
  logError,
  getPermissionMessage,
};