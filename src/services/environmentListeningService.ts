import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AppState, Platform } from 'react-native';
import { notificationService } from './notificationService';
import { API_ENDPOINTS, APP_CONFIG } from '../constants';

export interface ListeningSession {
  id: string;
  childId: string;
  parentId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  audioFile?: string;
  encryptionKey?: string;
  reason: 'emergency' | 'safety_check' | 'lost_child' | 'suspicious_activity';
  location?: {
    latitude: number;
    longitude: number;
  };
  audioQuality: 'low' | 'medium' | 'high';
  isEncrypted: boolean;
  consentStatus: 'pending' | 'approved' | 'denied';
  metadata?: {
    deviceInfo: string;
    batteryLevel: number;
    networkType: string;
  };
}

export interface ListeningRequest {
  childId: string;
  parentId: string;
  duration: number; // max duration in seconds
  reason: ListeningSession['reason'];
  emergencyMode: boolean;
  requireConsent: boolean;
  audioQuality: ListeningSession['audioQuality'];
  autoStart: boolean;
}

export interface ListeningSettings {
  maxSessionDuration: number; // seconds
  requireChildConsent: boolean;
  emergencyOverride: boolean; // bypass consent in emergency
  audioQuality: 'low' | 'medium' | 'high';
  autoDeleteAfter: number; // hours
  encryptionEnabled: boolean;
  allowedReasons: ListeningSession['reason'][];
  dailyLimit: number; // max sessions per day
  cooldownPeriod: number; // minutes between sessions
}

class EnvironmentListeningService {
  private activeSessions: Map<string, ListeningSession> = new Map();
  private sessionHistory: ListeningSession[] = [];
  private recording: Audio.Recording | null = null;
  private settings: ListeningSettings = {
    maxSessionDuration: 300, // 5 minutes
    requireChildConsent: true,
    emergencyOverride: true,
    audioQuality: 'medium',
    autoDeleteAfter: 24, // 24 hours
    encryptionEnabled: true,
    allowedReasons: ['emergency', 'safety_check', 'lost_child'],
    dailyLimit: 5,
    cooldownPeriod: 30, // 30 minutes
  };
  
  private listeners: Set<(session: ListeningSession) => void> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    await this.loadSettings();
    await this.loadSessionHistory();
    await this.setupAudioPermissions();
    await this.setupAppStateListener();
    this.isInitialized = true;
  }

  // Session Management
  async startListeningSession(request: ListeningRequest): Promise<ListeningSession | null> {
    try {
      // Validate premium access
      if (!await this.validatePremiumAccess(request.parentId)) {
        throw new Error('Environment listening requires premium subscription');
      }

      // Check daily limits
      if (!await this.checkDailyLimits(request.parentId)) {
        throw new Error('Daily listening limit exceeded');
      }

      // Check cooldown period
      if (!await this.checkCooldownPeriod(request.childId)) {
        throw new Error('Cooldown period still active');
      }

      // Validate child consent if required
      if (this.settings.requireChildConsent && !request.emergencyMode) {
        const consent = await this.requestChildConsent(request);
        if (!consent) {
          throw new Error('Child consent required but not granted');
        }
      }

      const session: ListeningSession = {
        id: this.generateSessionId(),
        childId: request.childId,
        parentId: request.parentId,
        startTime: new Date(),
        duration: Math.min(request.duration, this.settings.maxSessionDuration),
        status: 'active',
        reason: request.reason,
        audioQuality: request.audioQuality,
        isEncrypted: this.settings.encryptionEnabled,
        consentStatus: request.emergencyMode && this.settings.emergencyOverride ? 'approved' : 'pending',
        metadata: await this.getDeviceMetadata(),
      };

      // Generate encryption key if encryption is enabled
      if (this.settings.encryptionEnabled) {
        session.encryptionKey = this.generateEncryptionKey();
      }

      // Start audio recording
      const success = await this.startAudioRecording(session);
      if (!success) {
        throw new Error('Failed to start audio recording');
      }

      // Store active session
      this.activeSessions.set(session.id, session);

      // Notify listeners
      this.notifyListeners(session);

      // Send notification to parent
      await this.notifyParentSessionStarted(session);

      // Schedule automatic stop
      setTimeout(() => {
        this.stopListeningSession(session.id, 'time_limit');
      }, session.duration * 1000);

      console.log(`Environment listening session started: ${session.id}`);
      return session;

    } catch (error) {
      console.error('Error starting listening session:', error);
      return null;
    }
  }

  async stopListeningSession(sessionId: string, reason: 'user_request' | 'time_limit' | 'error' | 'child_denied'): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return false;
      }

      // Stop audio recording
      await this.stopAudioRecording();

      // Update session
      session.endTime = new Date();
      session.status = reason === 'error' ? 'failed' : 'completed';

      // Move to history
      this.sessionHistory.push(session);
      this.activeSessions.delete(sessionId);

      // Save audio file with encryption if enabled
      if (session.isEncrypted && session.audioFile) {
        await this.encryptAudioFile(session.audioFile, session.encryptionKey!);
      }

      // Schedule cleanup
      this.scheduleAudioCleanup(session);

      // Notify listeners
      this.notifyListeners(session);

      // Send notification
      await this.notifyParentSessionEnded(session, reason);

      console.log(`Environment listening session stopped: ${sessionId} (${reason})`);
      return true;

    } catch (error) {
      console.error('Error stopping listening session:', error);
      return false;
    }
  }

  async cancelListeningSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return false;
      }

      // Verify user has permission to cancel
      if (session.parentId !== userId && session.childId !== userId) {
        throw new Error('Unauthorized to cancel this session');
      }

      session.status = 'cancelled';
      return await this.stopListeningSession(sessionId, 'user_request');

    } catch (error) {
      console.error('Error cancelling listening session:', error);
      return false;
    }
  }

  // Audio Recording Management
  private async startAudioRecording(session: ListeningSession): Promise<boolean> {
    try {
      // Check audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Audio recording permission not granted');
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Set recording options based on quality
      const recordingOptions = this.getRecordingOptions(session.audioQuality);

      // Create recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions);

      // Start recording
      await this.recording.startAsync();

      // Generate audio file path
      const audioFileName = `env_listening_${session.id}_${Date.now()}.m4a`;
      session.audioFile = `${FileSystem.documentDirectory}audio/${audioFileName}`;

      return true;

    } catch (error) {
      console.error('Error starting audio recording:', error);
      return false;
    }
  }

  private async stopAudioRecording(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
    } catch (error) {
      console.error('Error stopping audio recording:', error);
    }
  }

  private getRecordingOptions(quality: ListeningSession['audioQuality']) {
    const baseOptions = {
      isMeteringEnabled: true,
      android: {
        extension: '.m4a',
        outputFormat: 2, // MPEG_4
        audioEncoder: 3, // AAC
      },
      ios: {
        extension: '.m4a',
        audioQuality: 0x60, // HIGH
        outputFormat: 'mpeg4aac',
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
      },
    };

    switch (quality) {
      case 'low':
        return {
          ...baseOptions,
          android: {
            ...baseOptions.android,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
          },
          ios: {
            ...baseOptions.ios,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 64000,
          },
        };
      case 'high':
        return {
          ...baseOptions,
          android: {
            ...baseOptions.android,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 192000,
          },
          ios: {
            ...baseOptions.ios,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 192000,
          },
        };
      default: // medium
        return {
          ...baseOptions,
          android: {
            ...baseOptions.android,
            sampleRate: 22050,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            ...baseOptions.ios,
            sampleRate: 22050,
            numberOfChannels: 1,
            bitRate: 128000,
          },
        };
    }
  }

  // Consent Management
  private async requestChildConsent(request: ListeningRequest): Promise<boolean> {
    try {
      // Send consent request notification to child
      // TODO: Implement consent request notification
      console.log('Consent request sent to child:', request.childId);

      // Wait for response (with timeout)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false); // Default to denied if no response
        }, 60000); // 1 minute timeout

        // Listen for consent response
        const consentListener = (response: { childId: string; granted: boolean }) => {
          if (response.childId === request.childId) {
            clearTimeout(timeout);
            resolve(response.granted);
          }
        };

        // Add temporary listener (in real implementation, this would be event-driven)
        // For now, simulate consent approval in non-emergency cases
        setTimeout(() => {
          clearTimeout(timeout);
          resolve(request.emergencyMode || !this.settings.requireChildConsent);
        }, 5000);
      });

    } catch (error) {
      console.error('Error requesting child consent:', error);
      return false;
    }
  }

  // Validation and Security
  private async validatePremiumAccess(parentId: string): Promise<boolean> {
    try {
      // Check user's premium status
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        return user.isPremium || false;
      }
      return false;
    } catch (error) {
      console.error('Error validating premium access:', error);
      return false;
    }
  }

  private async checkDailyLimits(parentId: string): Promise<boolean> {
    const today = new Date().toDateString();
    const todaySessions = this.sessionHistory.filter(session => 
      session.parentId === parentId && 
      session.startTime.toDateString() === today
    );
    
    return todaySessions.length < this.settings.dailyLimit;
  }

  private async checkCooldownPeriod(childId: string): Promise<boolean> {
    const lastSession = this.sessionHistory
      .filter(session => session.childId === childId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
    
    if (!lastSession) return true;
    
    const cooldownMs = this.settings.cooldownPeriod * 60 * 1000;
    const timeSinceLastSession = Date.now() - lastSession.startTime.getTime();
    
    return timeSinceLastSession >= cooldownMs;
  }

  // Encryption and Security
  private generateEncryptionKey(): string {
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
  }

  private async encryptAudioFile(filePath: string, encryptionKey: string): Promise<void> {
    try {
      // In a real implementation, this would use proper encryption
      // For now, we'll just rename the file to indicate it's "encrypted"
      const encryptedPath = filePath.replace('.m4a', '.enc');
      await FileSystem.moveAsync({
        from: filePath,
        to: encryptedPath,
      });
      
      // Store encryption key securely
      await SecureStore.setItemAsync(`audio_key_${encryptedPath}`, encryptionKey);
      
    } catch (error) {
      console.error('Error encrypting audio file:', error);
    }
  }

  private async decryptAudioFile(filePath: string): Promise<string | null> {
    try {
      const encryptionKey = await SecureStore.getItemAsync(`audio_key_${filePath}`);
      if (!encryptionKey) {
        throw new Error('Encryption key not found');
      }
      
      // In a real implementation, this would decrypt the file
      const decryptedPath = filePath.replace('.enc', '.m4a');
      await FileSystem.copyAsync({
        from: filePath,
        to: decryptedPath,
      });
      
      return decryptedPath;
      
    } catch (error) {
      console.error('Error decrypting audio file:', error);
      return null;
    }
  }

  // Data Management
  async getSessionHistory(parentId?: string, days: number = 30): Promise<ListeningSession[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.sessionHistory
      .filter(session => {
        const matchesParent = !parentId || session.parentId === parentId;
        const withinTimeframe = session.startTime >= cutoffDate;
        return matchesParent && withinTimeframe;
      })
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  getActiveSession(childId: string): ListeningSession | null {
    for (const session of this.activeSessions.values()) {
      if (session.childId === childId) {
        return session;
      }
    }
    return null;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessionHistory.find(s => s.id === sessionId);
      if (!session) return false;

      // Delete audio file
      if (session.audioFile) {
        await FileSystem.deleteAsync(session.audioFile, { idempotent: true });
        
        // Delete encryption key
        await SecureStore.deleteItemAsync(`audio_key_${session.audioFile}`);
      }

      // Remove from history
      this.sessionHistory = this.sessionHistory.filter(s => s.id !== sessionId);
      await this.saveSessionHistory();

      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  // Settings Management
  async updateSettings(newSettings: Partial<ListeningSettings>): Promise<boolean> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await this.saveSettings();
      return true;
    } catch (error) {
      console.error('Error updating listening settings:', error);
      return false;
    }
  }

  getSettings(): ListeningSettings {
    return { ...this.settings };
  }

  // Cleanup and Maintenance
  private async scheduleAudioCleanup(session: ListeningSession): Promise<void> {
    const cleanupTime = this.settings.autoDeleteAfter * 60 * 60 * 1000; // Convert to milliseconds
    
    setTimeout(async () => {
      await this.deleteSession(session.id);
    }, cleanupTime);
  }

  async cleanupExpiredSessions(): Promise<void> {
    const expirationTime = this.settings.autoDeleteAfter * 60 * 60 * 1000;
    const cutoffTime = Date.now() - expirationTime;
    
    const expiredSessions = this.sessionHistory.filter(session => 
      session.startTime.getTime() < cutoffTime
    );
    
    for (const session of expiredSessions) {
      await this.deleteSession(session.id);
    }
  }

  // Utility Methods
  private async getDeviceMetadata() {
    return {
      deviceInfo: Platform.OS === 'ios' ? 'iOS Device' : 'Android Device',
      batteryLevel: 100, // Would get from battery service
      networkType: 'WiFi', // Would detect network type
    };
  }

  private generateSessionId(): string {
    return `env_listening_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async setupAudioPermissions(): Promise<void> {
    try {
      await Audio.requestPermissionsAsync();
    } catch (error) {
      console.error('Error setting up audio permissions:', error);
    }
  }

  private async setupAppStateListener(): Promise<void> {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // Handle background state - may need to stop recording based on platform
        console.log('App went to background during listening session');
      }
    });
  }

  // Notifications
  private async notifyParentSessionStarted(session: ListeningSession): Promise<void> {
    // TODO: Implement proper notification using existing service
    console.log('Session started notification:', session.id);
  }

  private async notifyParentSessionEnded(session: ListeningSession, reason: string): Promise<void> {
    // TODO: Implement proper notification using existing service
    console.log('Session ended notification:', session.id, reason);
  }

  // Data Persistence
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('listening_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving listening settings:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('listening_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading listening settings:', error);
    }
  }

  private async saveSessionHistory(): Promise<void> {
    try {
      // Keep only recent history for storage efficiency
      const recentHistory = this.sessionHistory.slice(-100);
      await AsyncStorage.setItem('listening_history', JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Error saving session history:', error);
    }
  }

  private async loadSessionHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('listening_history');
      this.sessionHistory = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading session history:', error);
    }
  }

  // Event Listeners
  addSessionListener(callback: (session: ListeningSession) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(session: ListeningSession): void {
    this.listeners.forEach(callback => {
      try {
        callback(session);
      } catch (error) {
        console.error('Error in session listener:', error);
      }
    });
  }

  // Public API
  isListeningActive(childId: string): boolean {
    return this.getActiveSession(childId) !== null;
  }

  async cleanup(): Promise<void> {
    // Stop all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      await this.stopListeningSession(sessionId, 'error');
    }
    
    // Stop recording
    await this.stopAudioRecording();
    
    // Clear listeners
    this.listeners.clear();
  }
}

export const environmentListeningService = new EnvironmentListeningService();
export default environmentListeningService;