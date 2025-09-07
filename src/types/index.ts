// Types principaux pour TerranoKidsFind

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'parent' | 'child';
  profileImage?: string;
  isPremium: boolean;
  createdAt: Date;
  updatedAt: Date;
  familyId?: string;
  emergencyContacts?: EmergencyContact[];
}

export interface Child extends User {
  role: 'child';
  parentId: string;
  deviceId: string;
  batteryLevel: number;
  lastLocation?: Location;
  isOnline: boolean;
  emergencyContacts: EmergencyContact[];
  allowedContacts: Contact[];
  blockedNumbers: string[];
  screenTimeSettings: ScreenTimeSettings;
  safeZones: SafeZone[];
}

export interface Parent extends User {
  role: 'parent';
  children: string[]; // Child IDs
  subscriptionPlan: SubscriptionPlan;
  notificationSettings: NotificationSettings;
}

export interface Location {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
  address?: string;
  childId: string;
}

export interface SafeZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // en mètres
  isActive: boolean;
  entryNotification: boolean;
  exitNotification: boolean;
  color: string;
  createdAt: Date;
  childId: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  priority: number;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  isAllowed: boolean;
  isBlocked: boolean;
}

export interface SOSAlert {
  id: string;
  childId: string;
  location: Location;
  timestamp: Date;
  status: 'active' | 'resolved' | 'false_alarm' | 'cancelled';
  message?: string;
  audioRecording?: string;
  type?: 'manual_trigger' | 'follow_up' | 'resolution';
  severity?: 'high' | 'medium' | 'low';
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'audio' | 'image' | 'sticker';
  timestamp: Date;
  isRead: boolean;
  familyId: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  timestamp: Date;
}

export type NotificationType = 
  | 'sos_alert'
  | 'zone_entry'
  | 'zone_exit'
  | 'low_battery'
  | 'device_offline'
  | 'unauthorized_contact'
  | 'screen_time_limit'
  | 'location_update';

export interface ScreenTimeSettings {
  dailyLimit: number; // en minutes
  bedtime: string; // HH:MM
  wakeupTime: string; // HH:MM
  blockedApps: string[];
  allowedApps: string[];
  parentalControlEnabled: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: 'free' | 'premium';
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  features: string[];
  isActive: boolean;
  expiresAt?: Date;
}

export interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  sosAlerts: boolean;
  zoneAlerts: boolean;
  batteryAlerts: boolean;
  offlineAlerts: boolean;
}

export interface AppSettings {
  language: 'fr' | 'en' | 'es' | 'ar';
  theme: 'light' | 'dark' | 'auto';
  mapProvider: 'google' | 'openstreet';
  units: 'metric' | 'imperial';
  autoRefreshInterval: number; // en secondes
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  OnBoarding: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyPhone: { phone: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Map: undefined;
  Messages: undefined;
  Settings: undefined;
  Premium: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  ChildDetails: { childId: string };
  AddChild: undefined;
  SOSHistory: undefined;
  RemoteSoundHistory: { childId?: string };
  BatteryStatus: undefined;
  BatteryMonitoring: { childId?: string };
  EnvironmentListeningHistory: { childId?: string };
  UsageControl: { childId?: string };
  CallFiltering: { 
    childId?: string; 
    initialTab?: 'overview' | 'calls' | 'messages' | 'contacts' | 'settings';
  };
};

export type MapStackParamList = {
  MapView: undefined;
  SafeZones: undefined;
  AddSafeZone: undefined;
  LocationHistory: { childId: string };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Profile: undefined;
  Children: undefined;
  Notifications: undefined;
  Security: undefined;
  Privacy: undefined;
  Support: undefined;
  About: undefined;
};

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: 'parent' | 'child';
  acceptTerms: boolean;
}

// Hook types
export interface LocationState {
  currentLocation: Location | null;
  locationHistory: Location[];
  isTracking: boolean;
  hasPermission: boolean;
  error: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Geofencing types
export interface GeofenceEvent {
  type: 'enter' | 'exit';
  safeZone: SafeZone;
  location: Location;
  timestamp: Date;
}

// GPS Tracking types
export interface TrackingSession {
  id: string;
  childId: string;
  startTime: Date;
  endTime?: Date;
  locations: Location[];
  totalDistance: number;
  isActive: boolean;
}

// Battery monitoring types
export interface BatteryInfo {
  level: number;
  isCharging: boolean;
  temperature?: number;
  health?: string;
}

// Environment listening types
export interface AudioSession {
  id: string;
  childId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  audioUrl?: string;
  isActive: boolean;
  parentId: string;
}

export interface CallLog {
  id: string;
  childId: string;
  phoneNumber: string;
  contactName?: string;
  type: 'incoming' | 'outgoing' | 'missed' | 'blocked';
  duration: number;
  timestamp: Date;
}

// Smart watch types
export interface SmartWatch {
  id: string;
  childId: string;
  brand: string;
  model: string;
  macAddress: string;
  isConnected: boolean;
  batteryLevel: number;
  firmwareVersion: string;
  features: string[];
}

export interface WatchCommand {
  id: string;
  watchId: string;
  type: 'locate' | 'call' | 'sound_alarm' | 'safe_zone_update';
  payload: any;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
  timestamp: Date;
}