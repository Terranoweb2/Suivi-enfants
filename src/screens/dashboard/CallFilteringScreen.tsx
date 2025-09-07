import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Switch,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  callFilteringService,
  CallLog,
  MessageLog,
  CallFilterSettings,
  Contact,
  WhitelistRequest
} from '../../services/callFilteringService';
import { formatDate, formatTime, formatDistanceToNow } from '../../utils';
import Button from '../../components/Button';
import ContactManagement from '../../components/ContactManagement';

interface CallFilteringScreenProps {
  navigation: any;
  route?: {
    params?: {
      childId?: string;
      initialTab?: 'overview' | 'calls' | 'messages' | 'contacts' | 'settings';
    };
  };
}

const CallFilteringScreen: React.FC<CallFilteringScreenProps> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const childId = route?.params?.childId || user?.id;
  const initialTab = route?.params?.initialTab || 'overview';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [settings, setSettings] = useState<CallFilterSettings | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pendingRequests, setPendingRequests] = useState<WhitelistRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBlockedWordsModal, setShowBlockedWordsModal] = useState(false);
  const [newBlockedWord, setNewBlockedWord] = useState('');

  useEffect(() => {
    loadData();
    
    const unsubscribe = callFilteringService.addListener((event) => {
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [childId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [
        recentCallLogs,
        recentMessageLogs,
        currentSettings,
        allContacts,
        requests
      ] = await Promise.all([
        callFilteringService.getCallLogs(7),
        callFilteringService.getMessageLogs(7),
        callFilteringService.getSettings(),
        callFilteringService.getContacts(),
        callFilteringService.getPendingWhitelistRequests(),
      ]);
      
      setCallLogs(recentCallLogs);
      setMessageLogs(recentMessageLogs);
      setSettings(currentSettings);
      setContacts(allContacts);
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error loading call filtering data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUpdateSettings = async (newSettings: Partial<CallFilterSettings>) => {
    try {
      const success = await callFilteringService.updateSettings(newSettings);
      if (success) {
        setSettings({ ...settings!, ...newSettings });
        Alert.alert('Succès', 'Paramètres mis à jour');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour les paramètres');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const handleAddBlockedWord = async () => {
    if (!newBlockedWord.trim()) return;
    
    const currentWords = settings?.blockedWords || [];
    const updatedWords = [...currentWords, newBlockedWord.trim().toLowerCase()];
    
    await handleUpdateSettings({ blockedWords: updatedWords });
    setNewBlockedWord('');
  };

  const handleRemoveBlockedWord = async (word: string) => {
    const updatedWords = settings?.blockedWords.filter(w => w !== word) || [];
    await handleUpdateSettings({ blockedWords: updatedWords });
  };

  const getCallStatusIcon = (log: CallLog) => {
    if (log.wasBlocked) return 'close-circle';
    switch (log.type) {
      case 'incoming': return 'call-outline';
      case 'outgoing': return 'call';
      case 'missed': return 'call-outline';
      default: return 'call';
    }
  };

  const getCallStatusColor = (log: CallLog) => {
    if (log.wasBlocked) return theme.colors.error;
    switch (log.type) {
      case 'incoming': return theme.colors.success;
      case 'outgoing': return theme.colors.primary;
      case 'missed': return theme.colors.warning;
      default: return theme.colors.gray[500];
    }
  };

  const handleApproveRequest = async (request: WhitelistRequest) => {
    const success = await callFilteringService.reviewWhitelistRequest(
      request.id,
      true,
      user!.id,
      'Approuvé par le parent'
    );
    
    if (success) {
      await loadData();
      Alert.alert('Succès', 'Demande approuvée');
    } else {
      Alert.alert('Erreur', 'Impossible d\'approuver la demande');
    }
  };

  const handleDenyRequest = async (request: WhitelistRequest) => {
    Alert.alert(
      'Refuser la demande',
      'Pourquoi refusez-vous cette demande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Numéro inconnu',
          onPress: () => processRequestDenial(request, 'Numéro inconnu')
        },
        {
          text: 'Contact inapproprié',
          onPress: () => processRequestDenial(request, 'Contact inapproprié')
        },
        {
          text: 'Autre',
          onPress: () => processRequestDenial(request, 'Refusé par le parent')
        },
      ]
    );
  };

  const processRequestDenial = async (request: WhitelistRequest, reason: string) => {
    const success = await callFilteringService.reviewWhitelistRequest(
      request.id,
      false,
      user!.id,
      reason
    );
    
    if (success) {
      await loadData();
      Alert.alert('Succès', 'Demande refusée');
    } else {
      Alert.alert('Erreur', 'Impossible de refuser la demande');
    }
  };

  const renderOverviewTab = () => {
    const totalCalls = callLogs.length;
    const blockedCalls = callLogs.filter(log => log.wasBlocked).length;
    const totalMessages = messageLogs.length;
    const blockedMessages = messageLogs.filter(log => log.wasBlocked).length;
    const whitelistedContacts = contacts.filter(c => c.isWhitelisted).length;
    const blockedContacts = contacts.filter(c => c.isBlocked).length;

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="call" size={24} color={theme.colors.primary} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{totalCalls}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>Appels (7j)</Text>
            <Text style={[styles.statSubtext, { color: theme.colors.error }]}>
              {blockedCalls} bloqués
            </Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="chatbubble" size={24} color={theme.colors.secondary} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{totalMessages}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>Messages (7j)</Text>
            <Text style={[styles.statSubtext, { color: theme.colors.error }]}>
              {blockedMessages} bloqués
            </Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{whitelistedContacts}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>Autorisés</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="close-circle" size={24} color={theme.colors.error} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>{blockedContacts}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>Bloqués</Text>
          </View>
        </View>

        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Demandes en attente ({pendingRequests.length})
            </Text>
            {pendingRequests.slice(0, 3).map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <Text style={[styles.requestName, { color: theme.colors.text }]}>
                    {request.requestedName}
                  </Text>
                  <Text style={[styles.requestNumber, { color: theme.colors.gray[600] }]}>
                    {request.requestedNumber}
                  </Text>
                  <Text style={[styles.requestReason, { color: theme.colors.gray[600] }]}>
                    {request.reason}
                  </Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.requestButton, { backgroundColor: theme.colors.success }]}
                    onPress={() => handleApproveRequest(request)}
                  >
                    <Ionicons name="checkmark" size={16} color={theme.colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.requestButton, { backgroundColor: theme.colors.error }]}
                    onPress={() => handleDenyRequest(request)}
                  >
                    <Ionicons name="close" size={16} color={theme.colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.quickActions}>
          <Button
            title="Gérer les contacts"
            onPress={() => setActiveTab('contacts')}
            variant="outline"
            style={styles.quickActionButton}
          />
          <Button
            title="Paramètres"
            onPress={() => setActiveTab('settings')}
            variant="outline"
            style={styles.quickActionButton}
          />
        </View>
      </ScrollView>
    );
  };

  const renderCallsTab = () => (
    <FlatList
      data={callLogs}
      style={styles.tabContent}
      renderItem={({ item: log }) => (
        <View style={styles.logItem}>
          <Ionicons 
            name={getCallStatusIcon(log)}
            size={24} 
            color={getCallStatusColor(log)} 
          />
          <View style={styles.logInfo}>
            <Text style={[styles.logName, { color: theme.colors.text }]}>
              {log.contactName || log.phoneNumber}
            </Text>
            <Text style={[styles.logDetails, { color: theme.colors.gray[600] }]}>
              {formatDate(log.timestamp)} à {formatTime(log.timestamp)}
              {log.duration > 0 && ` • ${Math.floor(log.duration / 60)}:${(log.duration % 60).toString().padStart(2, '0')}`}
            </Text>
            {log.wasBlocked && (
              <Text style={[styles.logBlocked, { color: theme.colors.error }]}>
                Bloqué: {log.blockReason}
              </Text>
            )}
          </View>
          <View style={styles.logStatus}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: log.wasBlocked ? theme.colors.error : theme.colors.success }
            ]}>
              <Text style={styles.statusText}>
                {log.wasBlocked ? 'Bloqué' : 'Autorisé'}
              </Text>
            </View>
          </View>
        </View>
      )}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderMessagesTab = () => (
    <FlatList
      data={messageLogs}
      style={styles.tabContent}
      renderItem={({ item: log }) => (
        <View style={styles.logItem}>
          <Ionicons 
            name="chatbubble"
            size={24} 
            color={log.wasBlocked ? theme.colors.error : theme.colors.success} 
          />
          <View style={styles.logInfo}>
            <Text style={[styles.logName, { color: theme.colors.text }]}>
              {log.contactName || log.phoneNumber}
            </Text>
            <Text style={[styles.logDetails, { color: theme.colors.gray[600] }]}>
              {formatDate(log.timestamp)} à {formatTime(log.timestamp)}
            </Text>
            <Text style={[styles.messageContent, { color: theme.colors.gray[700] }]} numberOfLines={2}>
              {log.content}
            </Text>
            {log.wasBlocked && (
              <Text style={[styles.logBlocked, { color: theme.colors.error }]}>
                Bloqué: {log.blockReason}
                {log.containsBlockedWords && ' (mots interdits)'}
              </Text>
            )}
          </View>
          <View style={styles.logStatus}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: log.wasBlocked ? theme.colors.error : theme.colors.success }
            ]}>
              <Text style={styles.statusText}>
                {log.wasBlocked ? 'Bloqué' : 'Autorisé'}
              </Text>
            </View>
          </View>
        </View>
      )}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderContactsTab = () => (
    <View style={styles.tabContent}>
      <ContactManagement 
        childId={childId!}
        style={styles.contactManagement}
      />
    </View>
  );

  const renderSettingsTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: theme.colors.text }]}>
          Filtrage des appels
        </Text>
        
        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Activer le filtrage des appels
          </Text>
          <Switch
            value={settings?.enableCallFiltering}
            onValueChange={(value) => handleUpdateSettings({ enableCallFiltering: value })}
            trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Autoriser les numéros inconnus
          </Text>
          <Switch
            value={settings?.allowUnknownNumbers}
            onValueChange={(value) => handleUpdateSettings({ allowUnknownNumbers: value })}
            trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Bloquer les numéros masqués
          </Text>
          <Switch
            value={settings?.blockPrivateNumbers}
            onValueChange={(value) => handleUpdateSettings({ blockPrivateNumbers: value })}
            trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: theme.colors.text }]}>
          Messages
        </Text>
        
        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Activer le filtrage des SMS
          </Text>
          <Switch
            value={settings?.enableSMSFiltering}
            onValueChange={(value) => handleUpdateSettings({ enableSMSFiltering: value })}
            trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
          />
        </View>

        <TouchableOpacity 
          style={styles.settingButton}
          onPress={() => setShowBlockedWordsModal(true)}
        >
          <Text style={[styles.settingButtonText, { color: theme.colors.primary }]}>
            Gérer les mots interdits ({settings?.blockedWords.length || 0})
          </Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.settingsSection}>
        <Text style={[styles.settingsSectionTitle, { color: theme.colors.text }]}>
          Alertes
        </Text>
        
        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Alerter sur appel bloqué
          </Text>
          <Switch
            value={settings?.alertOnBlockedCall}
            onValueChange={(value) => handleUpdateSettings({ alertOnBlockedCall: value })}
            trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Alerter sur numéro inconnu
          </Text>
          <Switch
            value={settings?.alertOnUnknownCall}
            onValueChange={(value) => handleUpdateSettings({ alertOnUnknownCall: value })}
            trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderTabButton = (tab: string, label: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && { backgroundColor: theme.colors.primary }
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons 
        name={icon as any} 
        size={20} 
        color={activeTab === tab ? theme.colors.white : theme.colors.gray[600]} 
      />
      <Text style={[
        styles.tabButtonText,
        { color: activeTab === tab ? theme.colors.white : theme.colors.gray[600] }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderBlockedWordsModal = () => (
    <Modal
      visible={showBlockedWordsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowBlockedWordsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Mots interdits
            </Text>
            <TouchableOpacity
              onPress={() => setShowBlockedWordsModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.addWordContainer}>
            <TextInput
              style={[styles.wordInput, { 
                borderColor: theme.colors.gray[300],
                color: theme.colors.text 
              }]}
              placeholder="Ajouter un mot interdit"
              placeholderTextColor={theme.colors.gray[500]}
              value={newBlockedWord}
              onChangeText={setNewBlockedWord}
              onSubmitEditing={handleAddBlockedWord}
            />
            <TouchableOpacity
              style={[styles.addWordButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleAddBlockedWord}
            >
              <Ionicons name="add" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={settings?.blockedWords || []}
            style={styles.wordsContainer}
            renderItem={({ item: word }) => (
              <View style={styles.wordItem}>
                <Text style={[styles.wordText, { color: theme.colors.text }]}>{word}</Text>
                <TouchableOpacity
                  style={styles.removeWordButton}
                  onPress={() => handleRemoveBlockedWord(word)}
                >
                  <Ionicons name="close" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            )}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );

  const getTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverviewTab();
      case 'calls': return renderCallsTab();
      case 'messages': return renderMessagesTab();
      case 'contacts': return renderContactsTab();
      case 'settings': return renderSettingsTab();
      default: return renderOverviewTab();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray[200],
    },
    title: {
      fontSize: theme.fontSizes.HEADING_MD,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.SM,
      paddingVertical: theme.spacing.XS,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.SM,
      paddingHorizontal: theme.spacing.XS,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      gap: 4,
    },
    tabButtonText: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    tabContent: {
      flex: 1,
    },
    statsContainer: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
      gap: theme.spacing.MD,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.LG,
      borderRadius: theme.sizes.CARD_RADIUS,
      alignItems: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    statNumber: {
      fontSize: theme.fontSizes.HEADING_LG,
      fontFamily: theme.fonts.BOLD,
      marginTop: theme.spacing.SM,
    },
    statLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 4,
    },
    statSubtext: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 2,
    },
    section: {
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
    },
    sectionTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.BOLD,
      marginBottom: theme.spacing.MD,
    },
    requestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.MD,
      borderRadius: theme.sizes.CARD_RADIUS,
      marginBottom: theme.spacing.SM,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    requestInfo: {
      flex: 1,
    },
    requestName: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    requestNumber: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 2,
    },
    requestReason: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 2,
    },
    requestActions: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
    },
    requestButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActions: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
      gap: theme.spacing.MD,
    },
    quickActionButton: {
      flex: 1,
    },
    logItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.MD,
      marginHorizontal: theme.spacing.LG,
      marginVertical: theme.spacing.SM,
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    logInfo: {
      flex: 1,
      marginLeft: theme.spacing.MD,
    },
    logName: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    logDetails: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 2,
    },
    logBlocked: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 2,
    },
    messageContent: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 4,
      fontStyle: 'italic',
    },
    logStatus: {
      alignItems: 'flex-end',
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.SM,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    contactManagement: {
      flex: 1,
    },
    settingsSection: {
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
    },
    settingsSectionTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.BOLD,
      marginBottom: theme.spacing.MD,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.MD,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray[200],
    },
    settingLabel: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      flex: 1,
    },
    settingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.MD,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray[200],
    },
    settingButtonText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      flex: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.sizes.CARD_RADIUS * 2,
      borderTopRightRadius: theme.sizes.CARD_RADIUS * 2,
      paddingTop: theme.spacing.LG,
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.LG,
      paddingBottom: theme.spacing.MD,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray[200],
    },
    modalTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
    },
    closeButton: {
      padding: theme.spacing.SM,
    },
    addWordContainer: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
      gap: theme.spacing.SM,
    },
    wordInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      fontSize: theme.fontSizes.MD,
    },
    addWordButton: {
      width: 40,
      height: 40,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wordsContainer: {
      paddingHorizontal: theme.spacing.LG,
    },
    wordItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.MD,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray[200],
    },
    wordText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      flex: 1,
    },
    removeWordButton: {
      padding: theme.spacing.SM,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Filtrage d'appels</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabContainer}>
        {renderTabButton('overview', 'Vue d\'ensemble', 'apps')}
        {renderTabButton('calls', 'Appels', 'call')}
        {renderTabButton('messages', 'Messages', 'chatbubble')}
        {renderTabButton('contacts', 'Contacts', 'people')}
        {renderTabButton('settings', 'Paramètres', 'settings')}
      </View>

      {getTabContent()}
      {renderBlockedWordsModal()}
    </SafeAreaView>
  );
};

export default CallFilteringScreen;