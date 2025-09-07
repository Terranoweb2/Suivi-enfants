import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { notificationService } from './notificationService';

export interface AppUsageData {
  appId: string;
  appName: string;
  packageName: string;
  category: 'social' | 'games' | 'education' | 'entertainment' | 'productivity' | 'other';
  usageTime: number; // in minutes
  openCount: number;
  lastUsed: Date;
  isBlocked: boolean;
  timeLimit?: number; // daily limit in minutes
}

export interface ScreenTimeSession {
  id: string;
  childId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  deviceType: 'phone' | 'tablet';
  wasLimitExceeded: boolean;
}

export interface UsageSettings {
  dailyScreenTimeLimit: number; // minutes
  bedtimeStart: string; // HH:MM
  bedtimeEnd: string; // HH:MM
  allowedApps: string[]; // app package names
  blockedApps: string[]; // app package names
  educationAppsUnlimited: boolean;
  weekendExtraTime: number; // additional minutes on weekends
  breakReminders: boolean;
  breakInterval: number; // minutes between break reminders
}

export interface AppControlRequest {
  childId: string;
  appPackageName: string;
  action: 'block' | 'unblock' | 'limit' | 'unlimited';
  timeLimit?: number; // for 'limit' action
  reason?: string;
}

class UsageControlService {
  private currentSession: ScreenTimeSession | null = null;
  private appUsageData: Map<string, AppUsageData> = new Map();
  private usageHistory: ScreenTimeSession[] = [];
  private settings: UsageSettings = {
    dailyScreenTimeLimit: 120, // 2 hours
    bedtimeStart: '21:00',
    bedtimeEnd: '07:00',
    allowedApps: [],
    blockedApps: [],
    educationAppsUnlimited: true,
    weekendExtraTime: 60,
    breakReminders: true,
    breakInterval: 30,
  };
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private listeners: Set<(data: any) => void> = new Set();

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    await this.loadSettings();
    await this.loadUsageHistory();
    await this.loadAppUsageData();
    await this.setupAppStateListener();
  }

  // Screen Time Monitoring
  async startScreenTimeMonitoring(childId: string): Promise<boolean> {
    try {
      if (this.isMonitoring) {
        return true;
      }

      // Check if within bedtime hours
      if (this.isWithinBedtime()) {
        await this.showBedtimeAlert();
        return false;
      }

      // Check daily limit
      if (await this.isDailyLimitReached(childId)) {
        await this.showLimitReachedAlert();
        return false;
      }

      const session: ScreenTimeSession = {
        id: this.generateSessionId(),
        childId,
        startTime: new Date(),
        duration: 0,
        deviceType: Platform.OS === 'ios' ? 'phone' : 'phone',
        wasLimitExceeded: false,
      };

      this.currentSession = session;
      this.isMonitoring = true;

      // Start monitoring
      this.monitoringInterval = setInterval(() => {
        this.updateCurrentSession();
      }, 60000); // Update every minute

      // Set up break reminders
      if (this.settings.breakReminders) {
        this.scheduleBreakReminders();
      }

      console.log('Screen time monitoring started');
      return true;

    } catch (error) {
      console.error('Error starting screen time monitoring:', error);
      return false;
    }
  }

  async stopScreenTimeMonitoring(): Promise<void> {
    try {
      if (this.currentSession) {
        this.currentSession.endTime = new Date();
        this.currentSession.duration = Math.floor(
          (this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime()) / 60000
        );

        this.usageHistory.push(this.currentSession);
        await this.saveUsageHistory();
        this.currentSession = null;
      }

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      this.isMonitoring = false;
      console.log('Screen time monitoring stopped');
    } catch (error) {
      console.error('Error stopping screen time monitoring:', error);
    }
  }

  // App Control
  async blockApp(request: AppControlRequest): Promise<boolean> {
    try {
      const appData = this.appUsageData.get(request.appPackageName);
      
      if (appData) {
        appData.isBlocked = true;
        this.appUsageData.set(request.appPackageName, appData);
      } else {
        // Create new app entry
        const newAppData: AppUsageData = {
          appId: request.appPackageName,
          appName: request.appPackageName,
          packageName: request.appPackageName,
          category: 'other',
          usageTime: 0,
          openCount: 0,
          lastUsed: new Date(),
          isBlocked: true,
        };
        this.appUsageData.set(request.appPackageName, newAppData);
      }

      await this.saveAppUsageData();
      await this.notifyAppBlocked(request);
      
      return true;
    } catch (error) {
      console.error('Error blocking app:', error);
      return false;
    }
  }

  async unblockApp(appPackageName: string): Promise<boolean> {
    try {
      const appData = this.appUsageData.get(appPackageName);
      if (appData) {
        appData.isBlocked = false;
        this.appUsageData.set(appPackageName, appData);
        await this.saveAppUsageData();
      }
      return true;
    } catch (error) {
      console.error('Error unblocking app:', error);
      return false;
    }
  }

  async setAppTimeLimit(appPackageName: string, limitMinutes: number): Promise<boolean> {
    try {
      const appData = this.appUsageData.get(appPackageName);
      if (appData) {
        appData.timeLimit = limitMinutes;
        this.appUsageData.set(appPackageName, appData);
        await this.saveAppUsageData();
      }
      return true;
    } catch (error) {
      console.error('Error setting app time limit:', error);
      return false;
    }
  }

  // Usage Analytics
  async getTodayUsage(childId: string): Promise<{
    totalScreenTime: number;
    appUsage: AppUsageData[];
    sessionsCount: number;
    limitStatus: 'within' | 'warning' | 'exceeded';
  }> {
    const today = new Date().toDateString();
    const todaySessions = this.usageHistory.filter(session => 
      session.childId === childId && 
      session.startTime.toDateString() === today
    );

    const totalScreenTime = todaySessions.reduce((total, session) => 
      total + session.duration, 0
    );

    const appUsage = Array.from(this.appUsageData.values())
      .filter(app => app.lastUsed.toDateString() === today)
      .sort((a, b) => b.usageTime - a.usageTime);

    let limitStatus: 'within' | 'warning' | 'exceeded' = 'within';
    const limit = this.getDailyLimit();
    
    if (totalScreenTime >= limit) {
      limitStatus = 'exceeded';
    } else if (totalScreenTime >= limit * 0.8) {
      limitStatus = 'warning';
    }

    return {
      totalScreenTime,
      appUsage,
      sessionsCount: todaySessions.length,
      limitStatus,
    };
  }

  async getWeeklyUsage(childId: string): Promise<{
    dailyUsage: { date: string; screenTime: number }[];
    averageDaily: number;
    totalWeek: number;
    mostUsedApps: AppUsageData[];
  }> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekSessions = this.usageHistory.filter(session => 
      session.childId === childId && 
      session.startTime >= weekAgo
    );

    // Group by day
    const dailyUsage: { [key: string]: number } = {};
    weekSessions.forEach(session => {
      const date = session.startTime.toDateString();
      dailyUsage[date] = (dailyUsage[date] || 0) + session.duration;
    });

    const dailyUsageArray = Object.entries(dailyUsage).map(([date, screenTime]) => ({
      date,
      screenTime,
    }));

    const totalWeek = Object.values(dailyUsage).reduce((sum, time) => sum + time, 0);
    const averageDaily = totalWeek / 7;

    const mostUsedApps = Array.from(this.appUsageData.values())
      .sort((a, b) => b.usageTime - a.usageTime)
      .slice(0, 5);

    return {
      dailyUsage: dailyUsageArray,
      averageDaily,
      totalWeek,
      mostUsedApps,
    };
  }

  // Settings Management
  async updateSettings(newSettings: Partial<UsageSettings>): Promise<boolean> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await this.saveSettings();
      return true;
    } catch (error) {
      console.error('Error updating usage settings:', error);
      return false;
    }
  }

  getSettings(): UsageSettings {
    return { ...this.settings };
  }

  // Private Methods
  private updateCurrentSession(): void {
    if (this.currentSession) {
      this.currentSession.duration = Math.floor(
        (Date.now() - this.currentSession.startTime.getTime()) / 60000
      );

      // Check if daily limit exceeded
      const dailyLimit = this.getDailyLimit();
      if (this.currentSession.duration >= dailyLimit) {
        this.currentSession.wasLimitExceeded = true;
        this.handleLimitExceeded();
      }

      this.notifyListeners({
        type: 'session_update',
        session: this.currentSession,
      });
    }
  }

  private isWithinBedtime(): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= this.settings.bedtimeStart || currentTime <= this.settings.bedtimeEnd;
  }

  private async isDailyLimitReached(childId: string): Promise<boolean> {
    const todayUsage = await this.getTodayUsage(childId);
    return todayUsage.totalScreenTime >= this.getDailyLimit();
  }

  private getDailyLimit(): number {
    const isWeekend = [0, 6].includes(new Date().getDay());
    return this.settings.dailyScreenTimeLimit + (isWeekend ? this.settings.weekendExtraTime : 0);
  }

  private async handleLimitExceeded(): Promise<void> {
    console.log('Daily screen time limit exceeded');
    // In a real app, this would trigger device lockdown or app restrictions
  }

  private scheduleBreakReminders(): void {
    setInterval(() => {
      if (this.isMonitoring) {
        this.showBreakReminder();
      }
    }, this.settings.breakInterval * 60000);
  }

  private async showBedtimeAlert(): Promise<void> {
    console.log('Bedtime hours - device usage restricted');
  }

  private async showLimitReachedAlert(): Promise<void> {
    console.log('Daily screen time limit reached');
  }

  private async showBreakReminder(): Promise<void> {
    console.log('Break reminder - take a rest!');
  }

  private async notifyAppBlocked(request: AppControlRequest): Promise<void> {
    console.log('App blocked:', request.appPackageName);
  }

  private generateSessionId(): string {
    return `usage_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async setupAppStateListener(): Promise<void> {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && this.isMonitoring) {
        this.stopScreenTimeMonitoring();
      } else if (nextAppState === 'active' && !this.isMonitoring) {
        // Could auto-start monitoring here
      }
    });
  }

  // Data Persistence
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('usage_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving usage settings:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('usage_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading usage settings:', error);
    }
  }

  private async saveUsageHistory(): Promise<void> {
    try {
      const recentHistory = this.usageHistory.slice(-200);
      await AsyncStorage.setItem('usage_history', JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Error saving usage history:', error);
    }
  }

  private async loadUsageHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('usage_history');
      this.usageHistory = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading usage history:', error);
    }
  }

  private async saveAppUsageData(): Promise<void> {
    try {
      const dataArray = Array.from(this.appUsageData.entries());
      await AsyncStorage.setItem('app_usage_data', JSON.stringify(dataArray));
    } catch (error) {
      console.error('Error saving app usage data:', error);
    }
  }

  private async loadAppUsageData(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('app_usage_data');
      if (stored) {
        const dataArray = JSON.parse(stored);
        this.appUsageData = new Map(dataArray);
      }
    } catch (error) {
      console.error('Error loading app usage data:', error);
    }
  }

  // Event Listeners
  addUsageListener(callback: (data: any) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(data: any): void {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in usage listener:', error);
      }
    });
  }

  // Public API
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  getCurrentSession(): ScreenTimeSession | null {
    return this.currentSession;
  }

  getBlockedApps(): string[] {
    return Array.from(this.appUsageData.values())
      .filter(app => app.isBlocked)
      .map(app => app.packageName);
  }

  async cleanup(): Promise<void> {
    await this.stopScreenTimeMonitoring();
    this.listeners.clear();
  }
}

export const usageControlService = new UsageControlService();
export default usageControlService;