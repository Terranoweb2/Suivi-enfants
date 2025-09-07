// Constantes pour TerranoKidsFind

// Couleurs de la marque - Thème Orange/Noir
export const COLORS = {
  // Couleurs principales
  PRIMARY: '#FF6B35', // Orange vibrant principal
  SECONDARY: '#FF8C42', // Orange secondaire plus clair
  WHITE: '#FFFFFF',
  BLACK: '#1A1A1A', // Noir profond
  
  // Nuances d'orange
  ORANGE_LIGHT: '#FFB366',
  ORANGE_DARK: '#E55A2B',
  ORANGE_50: '#FFF3E0',
  ORANGE_100: '#FFE0B2',
  ORANGE_200: '#FFCC80',
  ORANGE_300: '#FFB74D',
  ORANGE_400: '#FFA726',
  ORANGE_500: '#FF9800',
  ORANGE_600: '#FB8C00',
  ORANGE_700: '#F57C00',
  ORANGE_800: '#EF6C00',
  ORANGE_900: '#E65100',
  
  // Couleurs fonctionnelles adaptées au thème
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  ERROR: '#F44336',
  INFO: '#FF6B35', // Orange au lieu du bleu
  
  // Nuances de gris/noir adaptées
  GRAY_50: '#FAFAFA',
  GRAY_100: '#F5F5F5',
  GRAY_200: '#EEEEEE',
  GRAY_300: '#E0E0E0',
  GRAY_400: '#BDBDBD',
  GRAY_500: '#9E9E9E',
  GRAY_600: '#757575',
  GRAY_700: '#424242',
  GRAY_800: '#2C2C2C',
  GRAY_900: '#1A1A1A',
  
  // Couleurs d'arrière-plan
  BACKGROUND: '#FAFAFA',
  SURFACE: '#FFFFFF',
  BORDER: '#E0E0E0',
  
  // Couleurs d'urgence
  SOS_RED: '#D32F2F',
  ALERT_ORANGE: '#FF6B35',
  SAFE_GREEN: '#388E3C',
  
  // Couleurs de statut
  ONLINE: '#4CAF50',
  OFFLINE: '#757575',
  CHARGING: '#FF9800',
  LOW_BATTERY: '#F44336',
};

// Typographie
export const FONTS = {
  REGULAR: 'System',
  MEDIUM: 'System',
  SEMIBOLD: 'System',
  BOLD: 'System',
};

export const FONT_SIZES = {
  XS: 10,
  SM: 12,
  MD: 14,
  LG: 16,
  XL: 18,
  XXL: 20,
  XXXL: 24,
  HEADING_SM: 20,
  HEADING_MD: 24,
  HEADING_LG: 28,
  HEADING_XL: 32,
  TITLE: 36,
};

// Espacements
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 40,
  XXXL: 48,
};

// Dimensions
export const SIZES = {
  // Boutons
  BUTTON_HEIGHT: 48,
  BUTTON_HEIGHT_SM: 36,
  BUTTON_HEIGHT_LG: 56,
  BUTTON_RADIUS: 8,
  BUTTON_RADIUS_SM: 4,
  BUTTON_RADIUS_LG: 12,
  
  // Icônes
  ICON_XS: 16,
  ICON_SM: 20,
  ICON_MD: 24,
  ICON_LG: 32,
  ICON_XL: 40,
  ICON_XXL: 48,
  
  // Bordures
  BORDER_RADIUS: 8,
  BORDER_RADIUS_SM: 4,
  BORDER_RADIUS_LG: 12,
  BORDER_RADIUS_XL: 16,
  BORDER_WIDTH: 1,
  BORDER_WIDTH_LG: 2,
  
  // Cartes
  CARD_RADIUS: 12,
  CARD_PADDING: 16,
  
  // Avatar
  AVATAR_SM: 32,
  AVATAR_MD: 48,
  AVATAR_LG: 64,
  AVATAR_XL: 80,
};

// Ombres
export const SHADOWS = {
  SM: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  MD: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  LG: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Configuration de l'application
export const APP_CONFIG = {
  NAME: 'TerranoKidsFind',
  VERSION: '1.0.0',
  
  // Localisation
  DEFAULT_LANGUAGE: 'fr',
  SUPPORTED_LANGUAGES: ['fr', 'en', 'es', 'ar'],
  
  // Maps
  DEFAULT_MAP_PROVIDER: 'google',
  MAP_PROVIDERS: ['google', 'openstreet'],
  
  // Localisation GPS
  LOCATION_UPDATE_INTERVAL: 30000, // 30 secondes
  HIGH_ACCURACY_UPDATE_INTERVAL: 10000, // 10 secondes en mode haute précision
  LOCATION_TIMEOUT: 15000, // 15 secondes
  MAXIMUM_AGE: 60000, // 1 minute
  
  // Géofencing
  MIN_SAFE_ZONE_RADIUS: 50, // 50 mètres minimum
  MAX_SAFE_ZONE_RADIUS: 2000, // 2 km maximum
  DEFAULT_SAFE_ZONE_RADIUS: 200, // 200 mètres par défaut
  
  // Batterie
  LOW_BATTERY_THRESHOLD: 15, // 15%
  CRITICAL_BATTERY_THRESHOLD: 5, // 5%
  
  // Notifications
  MAX_NOTIFICATION_HISTORY: 100,
  NOTIFICATION_SOUND_DURATION: 3000, // 3 secondes
  
  // Messages
  MAX_MESSAGE_LENGTH: 500,
  MAX_AUDIO_DURATION: 60, // 60 secondes
  MESSAGE_HISTORY_DAYS: 30,
  
  // Sécurité
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 300000, // 5 minutes
  TOKEN_REFRESH_INTERVAL: 900000, // 15 minutes
  
  // Abonnement
  FREE_SAFE_ZONES_LIMIT: 2,
  FREE_CHILDREN_LIMIT: 1,
  PREMIUM_FEATURES: [
    'unlimited_safe_zones',
    'unlimited_children',
    'environment_listening',
    'advanced_analytics',
    'priority_support',
    'extended_history',
    'app_blocking',
    'call_filtering'
  ],
};

// URLs de l'API
export const API_ENDPOINTS = {
  BASE_URL: __DEV__ ? 'http://localhost:3000/api' : 'https://api.terranokidsfind.com',
  
  // Authentification
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH_TOKEN: '/auth/refresh',
  LOGOUT: '/auth/logout',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  VERIFY_PHONE: '/auth/verify-phone',
  
  // Utilisateurs
  USER_PROFILE: '/users/profile',
  UPDATE_PROFILE: '/users/update',
  CHILDREN: '/users/children',
  ADD_CHILD: '/users/children/add',
  REMOVE_CHILD: '/users/children/remove',
  
  // Localisation
  LOCATION: '/location',
  LOCATION_HISTORY: '/location/history',
  LIVE_TRACKING: '/location/live',
  
  // Zones de sécurité
  SAFE_ZONES: '/safezones',
  CREATE_SAFE_ZONE: '/safezones/create',
  UPDATE_SAFE_ZONE: '/safezones/update',
  DELETE_SAFE_ZONE: '/safezones/delete',
  
  // Alertes SOS
  SOS_ALERTS: '/alerts/sos',
  CREATE_SOS: '/alerts/sos/create',
  RESOLVE_SOS: '/alerts/sos/resolve',
  
  // Messages
  MESSAGES: '/messages',
  SEND_MESSAGE: '/messages/send',
  MESSAGE_HISTORY: '/messages/history',
  
  // Notifications
  NOTIFICATIONS: '/notifications',
  MARK_READ: '/notifications/read',
  NOTIFICATION_SETTINGS: '/notifications/settings',
  
  // Monitoring
  BATTERY_STATUS: '/monitoring/battery',
  SCREEN_TIME: '/monitoring/screentime',
  APP_USAGE: '/monitoring/apps',
  CALL_LOGS: '/monitoring/calls',
  
  // Abonnements
  SUBSCRIPTION: '/subscription',
  UPGRADE: '/subscription/upgrade',
  CANCEL: '/subscription/cancel',
  
  // Montres connectées
  WATCHES: '/watches',
  CONNECT_WATCH: '/watches/connect',
  WATCH_COMMANDS: '/watches/commands',
};

// Messages d'erreur
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Problème de connexion réseau',
  UNAUTHORIZED: 'Session expirée, veuillez vous reconnecter',
  FORBIDDEN: 'Accès non autorisé',
  NOT_FOUND: 'Ressource non trouvée',
  SERVER_ERROR: 'Erreur serveur, veuillez réessayer',
  LOCATION_PERMISSION: 'Permission de localisation requise',
  CAMERA_PERMISSION: 'Permission d\'accès à la caméra requise',
  MICROPHONE_PERMISSION: 'Permission d\'accès au microphone requise',
  BIOMETRIC_NOT_AVAILABLE: 'Authentification biométrique non disponible',
  INVALID_CREDENTIALS: 'Email ou mot de passe incorrect',
  WEAK_PASSWORD: 'Le mot de passe doit contenir au moins 8 caractères',
  EMAIL_ALREADY_EXISTS: 'Cette adresse email est déjà utilisée',
  PHONE_ALREADY_EXISTS: 'Ce numéro de téléphone est déjà utilisé',
  INVALID_PHONE: 'Numéro de téléphone invalide',
  CHILD_NOT_FOUND: 'Enfant non trouvé',
  SAFE_ZONE_TOO_SMALL: 'La zone de sécurité est trop petite',
  SAFE_ZONE_TOO_LARGE: 'La zone de sécurité est trop grande',
  MAX_CHILDREN_REACHED: 'Nombre maximum d\'enfants atteint',
  PREMIUM_REQUIRED: 'Fonctionnalité premium requise',
};

// Messages de succès
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Connexion réussie',
  REGISTER_SUCCESS: 'Compte créé avec succès',
  PROFILE_UPDATED: 'Profil mis à jour',
  CHILD_ADDED: 'Enfant ajouté avec succès',
  SAFE_ZONE_CREATED: 'Zone de sécurité créée',
  SOS_SENT: 'Alerte SOS envoyée',
  MESSAGE_SENT: 'Message envoyé',
  SETTINGS_SAVED: 'Paramètres sauvegardés',
  PASSWORD_RESET: 'Mot de passe réinitialisé',
};

// Constantes de validation
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 50,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 50,
  PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

// Durées d'animation
export const ANIMATION_DURATION = {
  FAST: 200,
  NORMAL: 300,
  SLOW: 500,
  VERY_SLOW: 1000,
};

export default {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  SIZES,
  SHADOWS,
  APP_CONFIG,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION,
  ANIMATION_DURATION,
};