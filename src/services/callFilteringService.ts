import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { notificationService } from './notificationService';

export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  relationship: 'parent' | 'family' | 'friend' | 'emergency' | 'school' | 'other';
  isWhitelisted: boolean;
  isBlocked: boolean;
  allowCalls: boolean;
  allowSMS: boolean;
  allowedHours?: {
    start: string; // HH:MM
    end: string; // HH:MM
  };
  priority: 'high' | 'medium' | 'low';
  addedBy: string; // parent ID
  addedAt: Date;
  lastContact?: Date;
}

export interface CallLog {
  id: string;
  contactId?: string;
  phoneNumber: string;
  contactName?: string;
  type: 'incoming' | 'outgoing' | 'missed';
  timestamp: Date;
  duration: number; // in seconds
  wasBlocked: boolean;
  blockReason?: 'not_whitelisted' | 'explicitly_blocked' | 'outside_hours' | 'unknown_number';
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface MessageLog {
  id: string;
  contactId?: string;
  phoneNumber: string;
  contactName?: string;
  type: 'received' | 'sent';
  content: string;
  timestamp: Date;
  wasBlocked: boolean;
  blockReason?: string;
  containsBlockedWords?: boolean;
}

export interface CallFilterSettings {
  enableCallFiltering: boolean;
  enableSMSFiltering: boolean;
  allowUnknownNumbers: boolean;
  allowEmergencyNumbers: boolean;
  blockPrivateNumbers: boolean;
  allowSchoolHours: boolean;
  schoolHoursStart: string; // HH:MM
  schoolHoursEnd: string; // HH:MM
  quietHoursStart: string; // HH:MM
  quietHoursEnd: string; // HH:MM
  allowParentOverride: boolean;
  blockedWords: string[];
  alertOnBlockedCall: boolean;
  alertOnUnknownCall: boolean;
  logAllActivity: boolean;
}

export interface WhitelistRequest {
  id: string;
  childId: string;
  requestedNumber: string;
  requestedName: string;
  reason: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'denied';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

class CallFilteringService {
  private contacts: Map<string, Contact> = new Map();
  private callLogs: CallLog[] = [];
  private messageLogs: MessageLog[] = [];
  private whitelistRequests: WhitelistRequest[] = [];
  private settings: CallFilterSettings = {
    enableCallFiltering: true,
    enableSMSFiltering: true,
    allowUnknownNumbers: false,
    allowEmergencyNumbers: true,
    blockPrivateNumbers: true,
    allowSchoolHours: true,
    schoolHoursStart: '08:00',
    schoolHoursEnd: '16:00',
    quietHoursStart: '21:00',
    quietHoursEnd: '07:00',
    allowParentOverride: true,
    blockedWords: ['spam', 'promotion', 'advertisement'],
    alertOnBlockedCall: true,
    alertOnUnknownCall: true,
    logAllActivity: true,
  };

  private listeners: Set<(event: any) => void> = new Set();
  private emergencyNumbers = ['112', '911', '15', '17', '18', '196', '115'];

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    await this.loadSettings();
    await this.loadContacts();
    await this.loadCallLogs();
    await this.loadMessageLogs();
    await this.loadWhitelistRequests();
    await this.setupCallInterception();
  }

  // Contact Management
  async addContact(contact: Omit<Contact, 'id' | 'addedAt'>): Promise<Contact> {
    const newContact: Contact = {
      ...contact,
      id: this.generateContactId(),
      addedAt: new Date(),
    };

    this.contacts.set(newContact.id, newContact);
    await this.saveContacts();

    this.notifyListeners({
      type: 'contact_added',
      contact: newContact,
    });

    return newContact;
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<boolean> {
    try {
      const contact = this.contacts.get(contactId);
      if (!contact) return false;

      const updatedContact = { ...contact, ...updates };
      this.contacts.set(contactId, updatedContact);
      await this.saveContacts();

      this.notifyListeners({
        type: 'contact_updated',
        contact: updatedContact,
      });

      return true;
    } catch (error) {
      console.error('Error updating contact:', error);
      return false;
    }
  }

  async removeContact(contactId: string): Promise<boolean> {
    try {
      const contact = this.contacts.get(contactId);
      if (!contact) return false;

      this.contacts.delete(contactId);
      await this.saveContacts();

      this.notifyListeners({
        type: 'contact_removed',
        contactId,
      });

      return true;
    } catch (error) {
      console.error('Error removing contact:', error);
      return false;
    }
  }

  async blockContact(contactId: string): Promise<boolean> {
    return this.updateContact(contactId, { isBlocked: true, isWhitelisted: false });
  }

  async unblockContact(contactId: string): Promise<boolean> {
    return this.updateContact(contactId, { isBlocked: false });
  }

  async whitelistContact(contactId: string): Promise<boolean> {
    return this.updateContact(contactId, { isWhitelisted: true, isBlocked: false });
  }

  // Call Filtering
  async handleIncomingCall(phoneNumber: string, callerName?: string): Promise<{
    shouldBlock: boolean;
    reason?: string;
    contact?: Contact;
  }> {
    try {
      if (!this.settings.enableCallFiltering) {
        return { shouldBlock: false };
      }

      // Check emergency numbers
      if (this.isEmergencyNumber(phoneNumber)) {
        await this.logCall({
          phoneNumber,
          contactName: callerName || 'Emergency',
          type: 'incoming',
          wasBlocked: false,
        });
        return { shouldBlock: false };
      }

      // Find contact
      const contact = this.findContactByNumber(phoneNumber);
      
      // Check if explicitly blocked
      if (contact?.isBlocked) {
        await this.logCall({
          phoneNumber,
          contactName: callerName || contact.name,
          type: 'incoming',
          wasBlocked: true,
          blockReason: 'explicitly_blocked',
        });
        
        if (this.settings.alertOnBlockedCall) {
          await this.sendBlockedCallAlert(phoneNumber, 'explicitly_blocked');
        }
        
        return { shouldBlock: true, reason: 'Contact is blocked', contact };
      }

      // Check whitelist
      if (contact?.isWhitelisted && contact.allowCalls) {
        // Check allowed hours
        if (contact.allowedHours && !this.isWithinAllowedHours(contact.allowedHours)) {
          await this.logCall({
            phoneNumber,
            contactName: callerName || contact.name,
            type: 'incoming',
            wasBlocked: true,
            blockReason: 'outside_hours',
          });
          return { shouldBlock: true, reason: 'Outside allowed hours', contact };
        }

        await this.logCall({
          phoneNumber,
          contactName: callerName || contact.name,
          type: 'incoming',
          wasBlocked: false,
        });
        return { shouldBlock: false, contact };
      }

      // Check quiet hours
      if (this.isWithinQuietHours()) {
        await this.logCall({
          phoneNumber,
          contactName: callerName,
          type: 'incoming',
          wasBlocked: true,
          blockReason: 'outside_hours',
        });
        return { shouldBlock: true, reason: 'Quiet hours active' };
      }

      // Check school hours
      if (this.settings.allowSchoolHours && this.isWithinSchoolHours()) {
        // Only allow emergency and family contacts during school
        if (contact?.relationship !== 'parent' && contact?.relationship !== 'emergency') {
          await this.logCall({
            phoneNumber,
            contactName: callerName || contact?.name,
            type: 'incoming',
            wasBlocked: true,
            blockReason: 'outside_hours',
          });
          return { shouldBlock: true, reason: 'School hours - only emergency contacts allowed' };
        }
      }

      // Unknown number handling
      if (!contact) {
        if (this.settings.allowUnknownNumbers) {
          await this.logCall({
            phoneNumber,
            contactName: callerName,
            type: 'incoming',
            wasBlocked: false,
          });
          
          if (this.settings.alertOnUnknownCall) {
            await this.sendUnknownCallAlert(phoneNumber);
          }
          
          return { shouldBlock: false };
        } else {
          await this.logCall({
            phoneNumber,
            contactName: callerName,
            type: 'incoming',
            wasBlocked: true,
            blockReason: 'unknown_number',
          });
          
          if (this.settings.alertOnBlockedCall) {
            await this.sendBlockedCallAlert(phoneNumber, 'unknown_number');
          }
          
          return { shouldBlock: true, reason: 'Unknown number not allowed' };
        }
      }

      // Default to block if not explicitly allowed
      await this.logCall({
        phoneNumber,
        contactName: callerName || contact?.name,
        type: 'incoming',
        wasBlocked: true,
        blockReason: 'not_whitelisted',
      });
      
      return { shouldBlock: true, reason: 'Contact not whitelisted' };

    } catch (error) {
      console.error('Error handling incoming call:', error);
      return { shouldBlock: false }; // Fail open for safety
    }
  }

  // SMS Filtering
  async handleIncomingMessage(phoneNumber: string, content: string, senderName?: string): Promise<{
    shouldBlock: boolean;
    reason?: string;
    contact?: Contact;
  }> {
    try {
      if (!this.settings.enableSMSFiltering) {
        return { shouldBlock: false };
      }

      const contact = this.findContactByNumber(phoneNumber);

      // Check blocked words
      if (this.containsBlockedWords(content)) {
        await this.logMessage({
          phoneNumber,
          contactName: senderName || contact?.name,
          type: 'received',
          content,
          wasBlocked: true,
          blockReason: 'blocked_words',
          containsBlockedWords: true,
        });
        return { shouldBlock: true, reason: 'Contains blocked words' };
      }

      // Apply similar filtering logic as calls
      const callResult = await this.handleIncomingCall(phoneNumber, senderName);
      
      await this.logMessage({
        phoneNumber,
        contactName: senderName || contact?.name,
        type: 'received',
        content,
        wasBlocked: callResult.shouldBlock,
        blockReason: callResult.reason as any,
      });

      return callResult;

    } catch (error) {
      console.error('Error handling incoming message:', error);
      return { shouldBlock: false };
    }
  }

  // Whitelist Requests
  async requestWhitelist(childId: string, phoneNumber: string, name: string, reason: string): Promise<WhitelistRequest> {
    const request: WhitelistRequest = {
      id: this.generateRequestId(),
      childId,
      requestedNumber: phoneNumber,
      requestedName: name,
      reason,
      requestedAt: new Date(),
      status: 'pending',
    };

    this.whitelistRequests.push(request);
    await this.saveWhitelistRequests();

    // Notify parents
    await this.notifyParentsOfWhitelistRequest(request);

    this.notifyListeners({
      type: 'whitelist_request_created',
      request,
    });

    return request;
  }

  async reviewWhitelistRequest(
    requestId: string, 
    approve: boolean, 
    reviewerId: string, 
    notes?: string
  ): Promise<boolean> {
    try {
      const request = this.whitelistRequests.find(r => r.id === requestId);
      if (!request) return false;

      request.status = approve ? 'approved' : 'denied';
      request.reviewedBy = reviewerId;
      request.reviewedAt = new Date();
      request.reviewNotes = notes;

      if (approve) {
        // Add to contacts and whitelist
        await this.addContact({
          name: request.requestedName,
          phoneNumber: request.requestedNumber,
          relationship: 'friend',
          isWhitelisted: true,
          isBlocked: false,
          allowCalls: true,
          allowSMS: true,
          priority: 'medium',
          addedBy: reviewerId,
        });
      }

      await this.saveWhitelistRequests();

      this.notifyListeners({
        type: 'whitelist_request_reviewed',
        request,
        approved: approve,
      });

      return true;
    } catch (error) {
      console.error('Error reviewing whitelist request:', error);
      return false;
    }
  }

  // Settings Management
  async updateSettings(newSettings: Partial<CallFilterSettings>): Promise<boolean> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await this.saveSettings();

      this.notifyListeners({
        type: 'settings_updated',
        settings: this.settings,
      });

      return true;
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  }

  getSettings(): CallFilterSettings {
    return { ...this.settings };
  }

  // Data Retrieval
  getContacts(): Contact[] {
    return Array.from(this.contacts.values());
  }

  getWhitelistedContacts(): Contact[] {
    return this.getContacts().filter(contact => contact.isWhitelisted);
  }

  getBlockedContacts(): Contact[] {
    return this.getContacts().filter(contact => contact.isBlocked);
  }

  getCallLogs(days: number = 7): CallLog[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.callLogs
      .filter(log => log.timestamp >= cutoffDate)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getMessageLogs(days: number = 7): MessageLog[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.messageLogs
      .filter(log => log.timestamp >= cutoffDate)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getPendingWhitelistRequests(): WhitelistRequest[] {
    return this.whitelistRequests.filter(request => request.status === 'pending');
  }

  getWhitelistRequestHistory(): WhitelistRequest[] {
    return this.whitelistRequests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  // Private Helper Methods
  private findContactByNumber(phoneNumber: string): Contact | undefined {
    return Array.from(this.contacts.values()).find(contact => 
      this.normalizePhoneNumber(contact.phoneNumber) === this.normalizePhoneNumber(phoneNumber)
    );
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/[^\d+]/g, '');
  }

  private isEmergencyNumber(phoneNumber: string): boolean {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return this.emergencyNumbers.some(emergency => normalized.includes(emergency));
  }

  private isWithinAllowedHours(allowedHours: { start: string; end: string }): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= allowedHours.start && currentTime <= allowedHours.end;
  }

  private isWithinQuietHours(): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= this.settings.quietHoursStart || currentTime <= this.settings.quietHoursEnd;
  }

  private isWithinSchoolHours(): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    
    return isWeekday && currentTime >= this.settings.schoolHoursStart && currentTime <= this.settings.schoolHoursEnd;
  }

  private containsBlockedWords(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return this.settings.blockedWords.some(word => 
      lowerContent.includes(word.toLowerCase())
    );
  }

  private async logCall(callData: Omit<CallLog, 'id' | 'timestamp'>): Promise<void> {
    const log: CallLog = {
      ...callData,
      id: this.generateCallLogId(),
      timestamp: new Date(),
    };

    this.callLogs.push(log);
    await this.saveCallLogs();

    this.notifyListeners({
      type: 'call_logged',
      log,
    });
  }

  private async logMessage(messageData: Omit<MessageLog, 'id' | 'timestamp'>): Promise<void> {
    const log: MessageLog = {
      ...messageData,
      id: this.generateMessageLogId(),
      timestamp: new Date(),
    };

    this.messageLogs.push(log);
    await this.saveMessageLogs();

    this.notifyListeners({
      type: 'message_logged',
      log,
    });
  }

  private async sendBlockedCallAlert(phoneNumber: string, reason: string): Promise<void> {
    console.log(`Blocked call alert: ${phoneNumber} (${reason})`);
    // TODO: Implement proper notification
  }

  private async sendUnknownCallAlert(phoneNumber: string): Promise<void> {
    console.log(`Unknown call alert: ${phoneNumber}`);
    // TODO: Implement proper notification
  }

  private async notifyParentsOfWhitelistRequest(request: WhitelistRequest): Promise<void> {
    console.log('Whitelist request notification:', request);
    // TODO: Implement proper notification
  }

  private async setupCallInterception(): Promise<void> {
    // This would integrate with platform-specific call management APIs
    // For now, this is a placeholder for the service structure
    console.log('Call interception setup complete');
  }

  private generateContactId(): string {
    return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCallLogId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageLogId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Data Persistence
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('call_filter_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving call filter settings:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('call_filter_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading call filter settings:', error);
    }
  }

  private async saveContacts(): Promise<void> {
    try {
      const contactsArray = Array.from(this.contacts.entries());
      await AsyncStorage.setItem('filtered_contacts', JSON.stringify(contactsArray));
    } catch (error) {
      console.error('Error saving contacts:', error);
    }
  }

  private async loadContacts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('filtered_contacts');
      if (stored) {
        const contactsArray = JSON.parse(stored);
        this.contacts = new Map(contactsArray);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }

  private async saveCallLogs(): Promise<void> {
    try {
      const recentLogs = this.callLogs.slice(-500);
      await AsyncStorage.setItem('call_logs', JSON.stringify(recentLogs));
    } catch (error) {
      console.error('Error saving call logs:', error);
    }
  }

  private async loadCallLogs(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('call_logs');
      this.callLogs = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading call logs:', error);
    }
  }

  private async saveMessageLogs(): Promise<void> {
    try {
      const recentLogs = this.messageLogs.slice(-500);
      await AsyncStorage.setItem('message_logs', JSON.stringify(recentLogs));
    } catch (error) {
      console.error('Error saving message logs:', error);
    }
  }

  private async loadMessageLogs(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('message_logs');
      this.messageLogs = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading message logs:', error);
    }
  }

  private async saveWhitelistRequests(): Promise<void> {
    try {
      await AsyncStorage.setItem('whitelist_requests', JSON.stringify(this.whitelistRequests));
    } catch (error) {
      console.error('Error saving whitelist requests:', error);
    }
  }

  private async loadWhitelistRequests(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('whitelist_requests');
      this.whitelistRequests = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading whitelist requests:', error);
    }
  }

  // Event Listeners
  addListener(callback: (event: any) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(event: any): void {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in call filter listener:', error);
      }
    });
  }

  // Public API
  async clearLogs(): Promise<void> {
    this.callLogs = [];
    this.messageLogs = [];
    await AsyncStorage.removeItem('call_logs');
    await AsyncStorage.removeItem('message_logs');
  }

  async cleanup(): Promise<void> {
    this.listeners.clear();
  }
}

export const callFilteringService = new CallFilteringService();
export default callFilteringService;