import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';
import { Vibration } from 'react-native';
import { User, Location, ApiResponse } from '../types';
import { notificationService } from './notificationService';
import { API_ENDPOINTS, APP_CONFIG } from '../constants';

export interface SoundTriggerRequest {
  id: string;
  parentId: string;
  childId: string;
  soundType: 'alarm' | 'whistle' | 'siren' | 'bell' | 'custom';
  volume: number; // 0-100
  duration: number; // in seconds
  message?: string;
  timestamp: Date;
  status: 'pending' | 'playing' | 'completed' | 'failed' | 'cancelled';
}

export interface SoundTriggerResponse {
  id: string;
  requestId: string;
  childId: string;
  startedAt: Date;
  endedAt?: Date;
  actualDuration: number;
  location?: Location;
  status: 'started' | 'completed' | 'interrupted' | 'failed';
}

interface ActiveSound {
  sound: Audio.Sound;
  requestId: string;
  startTime: Date;
  duration: number;
  timer?: NodeJS.Timeout;
}

class RemoteSoundService {
  private activeSounds: Map<string, ActiveSound> = new Map();
  private soundHistory: SoundTriggerRequest[] = [];
  private responseHistory: SoundTriggerResponse[] = [];
  private isPlayingSound: boolean = false;
  private currentVolume: number = 0.8; // Default volume

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    await this.loadSoundHistory();
    await this.loadResponseHistory();
    await this.setupAudioMode();
    await this.checkPendingRequests();
  }

  private async setupAudioMode() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
      });
    } catch (error) {
      console.error('Error setting up audio mode:', error);
    }
  }

  // Remote Sound Triggering (Parent Side)
  async triggerRemoteSound(
    childId: string,
    soundType: SoundTriggerRequest['soundType'] = 'alarm',
    duration: number = 30,
    volume: number = 80,
    message?: string
  ): Promise<SoundTriggerRequest | null> {
    try {
      const request: SoundTriggerRequest = {
        id: this.generateRequestId(),
        parentId: await this.getCurrentUserId() || '',
        childId,
        soundType,
        volume: Math.max(0, Math.min(100, volume)),
        duration: Math.max(5, Math.min(300, duration)), // 5 seconds to 5 minutes
        message,
        timestamp: new Date(),
        status: 'pending',
      };

      // Save request locally
      this.soundHistory.push(request);
      await this.saveSoundHistory();

      // Send request to child device
      const success = await this.sendSoundRequestToChild(request);
      
      if (success) {
        console.log(`Remote sound request sent: ${request.id}`);
        return request;
      } else {
        request.status = 'failed';
        await this.saveSoundHistory();
        return null;
      }
    } catch (error) {
      console.error('Error triggering remote sound:', error);
      return null;
    }
  }

  async cancelRemoteSound(requestId: string): Promise<boolean> {
    try {
      // Update request status
      const request = this.soundHistory.find(r => r.id === requestId);
      if (request && request.status === 'pending') {
        request.status = 'cancelled';
        await this.saveSoundHistory();

        // Send cancellation to child device
        await this.sendSoundCancellationToChild(requestId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error cancelling remote sound:', error);
      return false;
    }
  }

  // Sound Playing (Child Side)
  async playRemoteSound(request: SoundTriggerRequest): Promise<SoundTriggerResponse> {
    try {
      // Check if already playing a sound
      if (this.isPlayingSound) {
        await this.stopAllSounds();
      }

      const response: SoundTriggerResponse = {
        id: this.generateResponseId(),
        requestId: request.id,
        childId: request.childId,
        startedAt: new Date(),
        actualDuration: 0,
        status: 'started',
      };

      // Get sound file path
      const soundUri = this.getSoundUri(request.soundType);
      
      let sound: Audio.Sound;
      
      if (soundUri) {
        // Load and play sound
        const { sound: loadedSound } = await Audio.Sound.createAsync(
          soundUri,
          {
            isLooping: true,
            volume: request.volume / 100,
          }
        );
        sound = loadedSound;
      } else {
        // Fallback: create a simple beep using system notification
        console.log('Using system notification sound as fallback');
        // For demo purposes, we'll simulate playing a sound
        const { sound: loadedSound } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
          {
            isLooping: true,
            volume: request.volume / 100,
          }
        ).catch(() => {
          // If even the fallback fails, create a minimal mock sound
          throw new Error('No sound available');
        });
        sound = loadedSound;
      }

      // Store active sound
      const activeSound: ActiveSound = {
        sound,
        requestId: request.id,
        startTime: new Date(),
        duration: request.duration,
      };

      this.activeSounds.set(request.id, activeSound);
      this.isPlayingSound = true;

      // Start playing
      await sound.playAsync();

      // Add vibration pattern
      this.startVibrationPattern(request.duration);

      // Set timer to stop sound
      activeSound.timer = setTimeout(async () => {
        await this.stopSound(request.id, 'completed');
      }, request.duration * 1000);

      // Update response
      response.status = 'started';
      this.responseHistory.push(response);
      await this.saveResponseHistory();

      // Send confirmation to parent
      await this.sendSoundResponse(response);

      console.log(`Playing remote sound: ${request.soundType} for ${request.duration}s`);
      return response;

    } catch (error) {
      console.error('Error playing remote sound:', error);
      const errorResponse: SoundTriggerResponse = {
        id: this.generateResponseId(),
        requestId: request.id,
        childId: request.childId,
        startedAt: new Date(),
        actualDuration: 0,
        status: 'failed',
      };
      return errorResponse;
    }
  }

  async stopSound(requestId: string, reason: 'completed' | 'interrupted' | 'cancelled' = 'completed'): Promise<boolean> {
    try {
      const activeSound = this.activeSounds.get(requestId);
      if (!activeSound) return false;

      // Stop the sound
      await activeSound.sound.stopAsync();
      await activeSound.sound.unloadAsync();

      // Clear timer
      if (activeSound.timer) {
        clearTimeout(activeSound.timer);
      }

      // Stop vibration
      Vibration.cancel();

      // Calculate actual duration
      const actualDuration = (new Date().getTime() - activeSound.startTime.getTime()) / 1000;

      // Update response
      const response = this.responseHistory.find(r => r.requestId === requestId);
      if (response) {
        response.endedAt = new Date();
        response.actualDuration = actualDuration;
        response.status = reason === 'completed' ? 'completed' : 'interrupted';
        await this.saveResponseHistory();

        // Send final response to parent
        await this.sendSoundResponse(response);
      }

      // Clean up
      this.activeSounds.delete(requestId);
      this.isPlayingSound = this.activeSounds.size > 0;

      console.log(`Stopped remote sound: ${requestId} (${reason})`);
      return true;

    } catch (error) {
      console.error('Error stopping sound:', error);
      return false;
    }
  }

  async stopAllSounds(): Promise<void> {
    try {
      const promises = Array.from(this.activeSounds.keys()).map(requestId =>
        this.stopSound(requestId, 'interrupted')
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error stopping all sounds:', error);
    }
  }

  // Sound Management
  private getSoundUri(soundType: SoundTriggerRequest['soundType']): any {
    // For now, return a system URI or the Expo system sound
    // In production, you would have actual audio files
    try {
      // Using system notification sound as fallback
      return { uri: 'system://notification.mp3' };
    } catch {
      // Return null if no sound available
      return null;
    }
  }

  private startVibrationPattern(duration: number) {
    try {
      // Create vibration pattern: vibrate for 500ms, pause 500ms, repeat
      const pattern = [0, 500, 500];
      const repeat = true;
      
      Vibration.vibrate(pattern, repeat);

      // Stop vibration after duration
      setTimeout(() => {
        Vibration.cancel();
      }, duration * 1000);
    } catch (error) {
      console.error('Error starting vibration pattern:', error);
    }
  }

  // Volume Control
  async setVolume(volume: number): Promise<boolean> {
    try {
      this.currentVolume = Math.max(0, Math.min(1, volume / 100));
      
      // Update volume for all active sounds
      for (const activeSound of this.activeSounds.values()) {
        await activeSound.sound.setVolumeAsync(this.currentVolume);
      }
      
      return true;
    } catch (error) {
      console.error('Error setting volume:', error);
      return false;
    }
  }

  async getVolume(): Promise<number> {
    return Math.round(this.currentVolume * 100);
  }

  // Communication with Child Device
  private async sendSoundRequestToChild(request: SoundTriggerRequest): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) return false;

      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/remote-sound/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      return response.ok;
    } catch (error) {
      console.error('Error sending sound request to child:', error);
      return false;
    }
  }

  private async sendSoundCancellationToChild(requestId: string): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) return false;

      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/remote-sound/cancel/${requestId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Error sending sound cancellation:', error);
      return false;
    }
  }

  private async sendSoundResponse(response: SoundTriggerResponse): Promise<void> {
    try {
      const token = await this.getAuthToken();
      if (!token) return;

      await fetch(`${API_ENDPOINTS.BASE_URL}/remote-sound/response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(response),
      });
    } catch (error) {
      console.error('Error sending sound response:', error);
    }
  }

  // Data Management
  async getSoundHistory(childId?: string, days: number = 7): Promise<SoundTriggerRequest[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let history = this.soundHistory.filter(request => request.timestamp >= cutoffDate);
    
    if (childId) {
      history = history.filter(request => request.childId === childId);
    }
    
    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getResponseHistory(childId?: string, days: number = 7): Promise<SoundTriggerResponse[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let history = this.responseHistory.filter(response => response.startedAt >= cutoffDate);
    
    if (childId) {
      history = history.filter(response => response.childId === childId);
    }
    
    return history.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlayingSound;
  }

  getActiveSounds(): SoundTriggerRequest['id'][] {
    return Array.from(this.activeSounds.keys());
  }

  // Utility Methods
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const user: User = JSON.parse(userData);
        return user.id;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
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

  private generateRequestId(): string {
    return `sound_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateResponseId(): string {
    return `sound_res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Data Persistence
  private async saveSoundHistory(): Promise<void> {
    try {
      // Keep only last 100 requests
      const recentHistory = this.soundHistory.slice(-100);
      await AsyncStorage.setItem('remote_sound_history', JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Error saving sound history:', error);
    }
  }

  private async loadSoundHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('remote_sound_history');
      this.soundHistory = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading sound history:', error);
    }
  }

  private async saveResponseHistory(): Promise<void> {
    try {
      // Keep only last 100 responses
      const recentHistory = this.responseHistory.slice(-100);
      await AsyncStorage.setItem('remote_sound_responses', JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Error saving response history:', error);
    }
  }

  private async loadResponseHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('remote_sound_responses');
      this.responseHistory = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading response history:', error);
    }
  }

  private async checkPendingRequests(): Promise<void> {
    try {
      // Check for any pending sound requests that need to be processed
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      // In a real app, this would check with the server for pending requests
      console.log('Checking for pending sound requests...');
    } catch (error) {
      console.error('Error checking pending requests:', error);
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.stopAllSounds();
    this.activeSounds.clear();
    this.isPlayingSound = false;
  }

  // Statistics
  async getStatistics(): Promise<{
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    mostUsedSoundType: string;
  }> {
    const totalRequests = this.soundHistory.length;
    const successfulRequests = this.soundHistory.filter(r => r.status === 'completed').length;
    
    const responses = this.responseHistory.filter(r => r.status === 'completed');
    const averageResponseTime = responses.length > 0
      ? responses.reduce((sum, r) => sum + r.actualDuration, 0) / responses.length
      : 0;

    const soundTypeCounts = this.soundHistory.reduce((counts, request) => {
      counts[request.soundType] = (counts[request.soundType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const mostUsedSoundType = Object.entries(soundTypeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'alarm';

    return {
      totalRequests,
      successfulRequests,
      averageResponseTime,
      mostUsedSoundType,
    };
  }
}

export const remoteSoundService = new RemoteSoundService();
export default remoteSoundService;