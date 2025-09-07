import AsyncStorage from '@react-native-async-storage/async-storage';
// Fallback Battery API when expo-battery is not available
const MockBattery = {
  isAvailableAsync: () => Promise.resolve(false),
  getBatteryLevelAsync: () => Promise.resolve(0.75),
  getBatteryStateAsync: () => Promise.resolve(1), // 1 = CHARGING
  getPowerStateAsync: () => Promise.resolve({
    batteryTemperature: 25.5,
    batteryHealth: 85,
  }),
  addBatteryLevelListener: (callback: any) => {
    // Mock listener that doesn't actually listen
    return { remove: () => {} };
  },
  addBatteryStateListener: (callback: any) => {
    // Mock listener that doesn't actually listen
    return { remove: () => {} };
  },
  removeBatteryLevelListener: () => {},
  removeBatteryStateListener: () => {},
  BatteryState: {
    CHARGING: 1,
    UNPLUGGED: 2,
    FULL: 3,
  },
};

// Try to import expo-battery, fall back to mock if not available
let Battery: any;
try {
  Battery = require('expo-battery');
} catch (error) {
  console.warn('expo-battery not available, using mock implementation');
  Battery = MockBattery;
}
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { BatteryInfo, User, ApiResponse } from '../types';
import { notificationService } from './notificationService';
import { API_ENDPOINTS, APP_CONFIG } from '../constants';

export interface BatteryAlert {
  id: string;
  childId: string;
  batteryLevel: number;
  isCharging: boolean;
  alertType: 'low' | 'critical' | 'charging' | 'full';
  timestamp: Date;
  acknowledged: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface BatterySettings {
  lowBatteryThreshold: number; // Default: 20%
  criticalBatteryThreshold: number; // Default: 5%
  enableLowBatteryAlerts: boolean;
  enableCriticalBatteryAlerts: boolean;
  enableChargingAlerts: boolean;
  enableFullBatteryAlerts: boolean;
  alertInterval: number; // Minutes between repeated alerts
}

export interface BatteryHistory {
  timestamp: Date;
  level: number;
  isCharging: boolean;
  temperature?: number;
  health?: string;
}

class BatteryMonitoringService {
  private batteryHistory: BatteryHistory[] = [];
  private alertHistory: BatteryAlert[] = [];
  private currentBatteryInfo: BatteryInfo | null = null;
  private settings: BatterySettings = {
    lowBatteryThreshold: 20,
    criticalBatteryThreshold: 5,
    enableLowBatteryAlerts: true,
    enableCriticalBatteryAlerts: true,
    enableChargingAlerts: false,
    enableFullBatteryAlerts: false,
    alertInterval: 30, // 30 minutes
  };
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastAlertTime: Map<string, Date> = new Map();
  private isMonitoring: boolean = false;
  private listeners: Set<(batteryInfo: BatteryInfo) => void> = new Set();

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    await this.loadSettings();
    await this.loadBatteryHistory();
    await this.loadAlertHistory();
    await this.setupAppStateListener();
  }

  // Battery Monitoring
  async startBatteryMonitoring(): Promise<boolean> {
    try {
      if (this.isMonitoring) {
        return true;
      }

      // Check if battery API is available
      const isAvailable = await Battery.isAvailableAsync();
      if (!isAvailable) {
        console.warn('Battery API not available on this device');
        return false;
      }

      // Get initial battery state
      await this.updateBatteryInfo();

      // Start periodic monitoring (every 2 minutes)
      this.monitoringInterval = setInterval(async () => {
        await this.updateBatteryInfo();
      }, 2 * 60 * 1000);

      // Set up battery level change listener
      const batteryLevelListener = Battery.addBatteryLevelListener(({ batteryLevel }: { batteryLevel: number }) => {
        this.handleBatteryLevelChange(batteryLevel);
      });

      // Set up charging state listener
      const batteryStateListener = Battery.addBatteryStateListener(({ batteryState }: { batteryState: any }) => {
        this.handleChargingStateChange(batteryState);
      });

      this.isMonitoring = true;
      console.log('Battery monitoring started');
      return true;

    } catch (error) {
      console.error('Error starting battery monitoring:', error);
      return false;
    }
  }

  async stopBatteryMonitoring(): Promise<void> {
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      // Remove listeners
      Battery.removeBatteryLevelListener;
      Battery.removeBatteryStateListener;

      this.isMonitoring = false;
      console.log('Battery monitoring stopped');
    } catch (error) {
      console.error('Error stopping battery monitoring:', error);
    }
  }

  private async updateBatteryInfo(): Promise<void> {
    try {
      const [batteryLevel, batteryState, powerState] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
        Battery.getPowerStateAsync(),
      ]);

      const batteryInfo: BatteryInfo = {
        level: Math.round(batteryLevel * 100),
        isCharging: batteryState === Battery.BatteryState.CHARGING,
        temperature: powerState?.batteryTemperature,
        health: this.getBatteryHealthText(powerState?.batteryHealth),
      };

      // Update current battery info
      this.currentBatteryInfo = batteryInfo;

      // Add to history
      this.addBatteryHistory(batteryInfo);

      // Check for alerts
      await this.checkBatteryAlerts(batteryInfo);

      // Notify listeners
      this.notifyListeners(batteryInfo);

      // Sync with server
      await this.syncBatteryDataWithServer(batteryInfo);

    } catch (error) {
      console.error('Error updating battery info:', error);
    }
  }

  private handleBatteryLevelChange(batteryLevel: number): void {
    if (this.currentBatteryInfo) {
      this.currentBatteryInfo.level = Math.round(batteryLevel * 100);
      this.addBatteryHistory(this.currentBatteryInfo);
      this.checkBatteryAlerts(this.currentBatteryInfo);
      this.notifyListeners(this.currentBatteryInfo);
    }
  }

  private handleChargingStateChange(batteryState: any): void {
    if (this.currentBatteryInfo) {
      const wasCharging = this.currentBatteryInfo.isCharging;
      const isCharging = batteryState === Battery.BatteryState.CHARGING;
      
      this.currentBatteryInfo.isCharging = isCharging;

      // Trigger charging state change alert
      if (wasCharging !== isCharging) {
        this.handleChargingStateAlert(isCharging);
      }

      this.addBatteryHistory(this.currentBatteryInfo);
      this.notifyListeners(this.currentBatteryInfo);
    }
  }

  // Alert Management
  private async checkBatteryAlerts(batteryInfo: BatteryInfo): Promise<void> {
    try {
      const { level, isCharging } = batteryInfo;

      // Critical battery alert (5% or below)
      if (level <= this.settings.criticalBatteryThreshold && 
          !isCharging && 
          this.settings.enableCriticalBatteryAlerts) {
        await this.createBatteryAlert('critical', batteryInfo);
      }
      // Low battery alert (20% or below)
      else if (level <= this.settings.lowBatteryThreshold && 
               !isCharging && 
               this.settings.enableLowBatteryAlerts) {
        await this.createBatteryAlert('low', batteryInfo);
      }

      // Full battery alert (100% and charging)
      if (level === 100 && 
          isCharging && 
          this.settings.enableFullBatteryAlerts) {
        await this.createBatteryAlert('full', batteryInfo);
      }

    } catch (error) {
      console.error('Error checking battery alerts:', error);
    }
  }

  private async handleChargingStateAlert(isCharging: boolean): Promise<void> {
    if (this.settings.enableChargingAlerts && this.currentBatteryInfo) {
      await this.createBatteryAlert('charging', this.currentBatteryInfo);
    }
  }

  private async createBatteryAlert(
    alertType: BatteryAlert['alertType'], 
    batteryInfo: BatteryInfo
  ): Promise<void> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      // Check if we should throttle this alert
      const alertKey = `${alertType}_${batteryInfo.level}`;
      const lastAlert = this.lastAlertTime.get(alertKey);
      const now = new Date();
      
      if (lastAlert) {
        const minutesSinceLastAlert = (now.getTime() - lastAlert.getTime()) / 1000 / 60;
        if (minutesSinceLastAlert < this.settings.alertInterval) {
          return; // Skip this alert due to throttling
        }
      }

      const alert: BatteryAlert = {
        id: this.generateAlertId(),
        childId: userId,
        batteryLevel: batteryInfo.level,
        isCharging: batteryInfo.isCharging,
        alertType,
        timestamp: now,
        acknowledged: false,
      };

      // Add to alert history
      this.alertHistory.push(alert);
      await this.saveAlertHistory();

      // Update last alert time
      this.lastAlertTime.set(alertKey, now);

      // Send notification
      await this.sendBatteryNotification(alert);

      console.log(`Battery alert created: ${alertType} at ${batteryInfo.level}%`);

    } catch (error) {
      console.error('Error creating battery alert:', error);
    }
  }

  private async sendBatteryNotification(alert: BatteryAlert): Promise<void> {
    try {
      await notificationService.sendBatteryAlert(alert.childId, alert.batteryLevel);
    } catch (error) {
      console.error('Error sending battery notification:', error);
    }
  }

  // Data Management
  getCurrentBatteryInfo(): BatteryInfo | null {
    return this.currentBatteryInfo;
  }

  async getBatteryHistory(days: number = 7): Promise<BatteryHistory[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.batteryHistory
      .filter(entry => entry.timestamp >= cutoffDate)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAlertHistory(days: number = 30): Promise<BatteryAlert[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.alertHistory
      .filter(alert => alert.timestamp >= cutoffDate)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this.alertHistory.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        await this.saveAlertHistory();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      return false;
    }
  }

  // Settings Management
  async updateSettings(newSettings: Partial<BatterySettings>): Promise<boolean> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await this.saveSettings();
      return true;
    } catch (error) {
      console.error('Error updating battery settings:', error);
      return false;
    }
  }

  getSettings(): BatterySettings {
    return { ...this.settings };
  }

  // Battery Analytics
  async getBatteryAnalytics(days: number = 7): Promise<{
    averageLevel: number;
    timeCharging: number; // percentage of time charging
    lowestLevel: number;
    highestLevel: number;
    chargingCycles: number;
    batteryHealthTrend: 'improving' | 'stable' | 'declining';
  }> {
    const history = await this.getBatteryHistory(days);
    
    if (history.length === 0) {
      return {
        averageLevel: 0,
        timeCharging: 0,
        lowestLevel: 0,
        highestLevel: 0,
        chargingCycles: 0,
        batteryHealthTrend: 'stable',
      };
    }

    const levels = history.map(h => h.level);
    const averageLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    const lowestLevel = Math.min(...levels);
    const highestLevel = Math.max(...levels);
    
    const chargingTime = history.filter(h => h.isCharging).length;
    const timeCharging = (chargingTime / history.length) * 100;

    // Count charging cycles (rough estimate)
    let chargingCycles = 0;
    let wasCharging = false;
    for (const entry of history.reverse()) {
      if (entry.isCharging && !wasCharging) {
        chargingCycles++;
      }
      wasCharging = entry.isCharging;
    }

    // Simple battery health trend analysis
    const recentAvg = history.slice(0, Math.floor(history.length / 3))
      .reduce((sum, h) => sum + h.level, 0) / Math.floor(history.length / 3);
    const olderAvg = history.slice(-Math.floor(history.length / 3))
      .reduce((sum, h) => sum + h.level, 0) / Math.floor(history.length / 3);
    
    let batteryHealthTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recentAvg > olderAvg + 5) batteryHealthTrend = 'improving';
    else if (recentAvg < olderAvg - 5) batteryHealthTrend = 'declining';

    return {
      averageLevel: Math.round(averageLevel),
      timeCharging: Math.round(timeCharging),
      lowestLevel,
      highestLevel,
      chargingCycles,
      batteryHealthTrend,
    };
  }

  // Utility Methods
  private addBatteryHistory(batteryInfo: BatteryInfo): void {
    const historyEntry: BatteryHistory = {
      timestamp: new Date(),
      level: batteryInfo.level,
      isCharging: batteryInfo.isCharging,
      temperature: batteryInfo.temperature,
      health: batteryInfo.health,
    };

    this.batteryHistory.push(historyEntry);

    // Keep only last 1000 entries
    if (this.batteryHistory.length > 1000) {
      this.batteryHistory = this.batteryHistory.slice(-1000);
    }

    this.saveBatteryHistory();
  }

  private getBatteryHealthText(health?: number): string | undefined {
    if (health === undefined) return undefined;
    
    if (health > 80) return 'Excellent';
    if (health > 60) return 'Good';
    if (health > 40) return 'Fair';
    if (health > 20) return 'Poor';
    return 'Very Poor';
  }

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

  private generateAlertId(): string {
    return `battery_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async setupAppStateListener(): Promise<void> {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !this.isMonitoring) {
        this.startBatteryMonitoring();
      } else if (nextAppState === 'background' && this.isMonitoring) {
        // Continue monitoring in background for critical alerts
      }
    });
  }

  // Data Persistence
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('battery_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving battery settings:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('battery_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading battery settings:', error);
    }
  }

  private async saveBatteryHistory(): Promise<void> {
    try {
      // Keep only recent history for storage efficiency
      const recentHistory = this.batteryHistory.slice(-500);
      await AsyncStorage.setItem('battery_history', JSON.stringify(recentHistory));
    } catch (error) {
      console.error('Error saving battery history:', error);
    }
  }

  private async loadBatteryHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('battery_history');
      this.batteryHistory = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading battery history:', error);
    }
  }

  private async saveAlertHistory(): Promise<void> {
    try {
      // Keep only last 100 alerts
      const recentAlerts = this.alertHistory.slice(-100);
      await AsyncStorage.setItem('battery_alerts', JSON.stringify(recentAlerts));
    } catch (error) {
      console.error('Error saving alert history:', error);
    }
  }

  private async loadAlertHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('battery_alerts');
      this.alertHistory = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading alert history:', error);
    }
  }

  // Server Synchronization
  private async syncBatteryDataWithServer(batteryInfo: BatteryInfo): Promise<void> {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) return;

      await fetch(`${API_ENDPOINTS.BASE_URL}/battery/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          batteryLevel: batteryInfo.level,
          isCharging: batteryInfo.isCharging,
          temperature: batteryInfo.temperature,
          timestamp: new Date(),
        }),
      });
    } catch (error) {
      console.error('Error syncing battery data with server:', error);
    }
  }

  // Event Listeners
  addBatteryListener(callback: (batteryInfo: BatteryInfo) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(batteryInfo: BatteryInfo): void {
    this.listeners.forEach(callback => {
      try {
        callback(batteryInfo);
      } catch (error) {
        console.error('Error in battery listener:', error);
      }
    });
  }

  // Public API
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  async clearHistory(): Promise<void> {
    this.batteryHistory = [];
    this.alertHistory = [];
    await AsyncStorage.removeItem('battery_history');
    await AsyncStorage.removeItem('battery_alerts');
  }

  async cleanup(): Promise<void> {
    await this.stopBatteryMonitoring();
    this.listeners.clear();
  }
}

export const batteryMonitoringService = new BatteryMonitoringService();
export default batteryMonitoringService;