import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  environmentListeningService, 
  ListeningRequest, 
  ListeningSession 
} from '../services/environmentListeningService';
import { formatDistanceToNow } from '../utils';
import Button from './Button';

interface EnvironmentListeningControlProps {
  childId: string;
  childName: string;
  onSessionStarted?: (session: ListeningSession) => void;
  onSessionEnded?: (session: ListeningSession) => void;
  disabled?: boolean;
  style?: any;
}

const EnvironmentListeningControl: React.FC<EnvironmentListeningControlProps> = ({
  childId,
  childName,
  onSessionStarted,
  onSessionEnded,
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [activeSession, setActiveSession] = useState<ListeningSession | null>(null);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  // Advanced settings
  const [duration, setDuration] = useState(180); // 3 minutes
  const [reason, setReason] = useState<ListeningSession['reason']>('safety_check');
  const [audioQuality, setAudioQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [requireConsent, setRequireConsent] = useState(true);

  useEffect(() => {
    checkActiveSession();
    checkPremiumStatus();
    
    // Set up session listener
    const unsubscribe = environmentListeningService.addSessionListener((session) => {
      if (session.childId === childId) {
        if (session.status === 'active') {
          setActiveSession(session);
          onSessionStarted?.(session);
        } else {
          setActiveSession(null);
          onSessionEnded?.(session);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [childId]);

  const checkActiveSession = () => {
    const session = environmentListeningService.getActiveSession(childId);
    setActiveSession(session);
  };

  const checkPremiumStatus = () => {
    setIsPremium(user?.isPremium || false);
  };

  const handleQuickListen = async (quickReason: ListeningSession['reason']) => {
    if (!isPremium) {
      showPremiumRequiredAlert();
      return;
    }

    const request: ListeningRequest = {
      childId,
      parentId: user!.id,
      duration: quickReason === 'emergency' ? 300 : 180, // 5 min for emergency, 3 min for others
      reason: quickReason,
      emergencyMode: quickReason === 'emergency',
      requireConsent: quickReason !== 'emergency',
      audioQuality: 'medium',
      autoStart: true,
    };

    await startListening(request);
  };

  const handleAdvancedListen = async () => {
    if (!isPremium) {
      showPremiumRequiredAlert();
      return;
    }

    const request: ListeningRequest = {
      childId,
      parentId: user!.id,
      duration,
      reason,
      emergencyMode,
      requireConsent: !emergencyMode && requireConsent,
      audioQuality,
      autoStart: true,
    };

    setShowAdvancedModal(false);
    await startListening(request);
  };

  const startListening = async (request: ListeningRequest) => {
    try {
      setIsLoading(true);

      const session = await environmentListeningService.startListeningSession(request);
      
      if (session) {
        setActiveSession(session);
        Alert.alert(
          '🎧 Écoute Activée',
          `L'écoute de l'environnement de ${childName} a été activée.\nRaison: ${getReasonText(request.reason)}\nDurée: ${Math.floor(request.duration / 60)} minutes`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          'Erreur',
          'Impossible d\'activer l\'écoute de l\'environnement. Vérifiez les paramètres et réessayez.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error.message || 'Une erreur s\'est produite lors de l\'activation de l\'écoute.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopListening = () => {
    if (!activeSession) return;

    Alert.alert(
      'Arrêter l\'écoute',
      'Êtes-vous sûr de vouloir arrêter l\'écoute de l\'environnement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Arrêter', 
          style: 'destructive',
          onPress: async () => {
            const success = await environmentListeningService.stopListeningSession(
              activeSession.id, 
              'user_request'
            );
            if (success) {
              setActiveSession(null);
            }
          }
        },
      ]
    );
  };

  const showPremiumRequiredAlert = () => {
    Alert.alert(
      '✨ Fonctionnalité Premium',
      'L\'écoute de l\'environnement est une fonctionnalité premium. Passez à la version premium pour accéder à cette fonctionnalité avancée de sécurité.',
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Voir Premium', style: 'default' },
      ]
    );
  };

  const getReasonText = (reason: ListeningSession['reason']): string => {
    switch (reason) {
      case 'emergency':
        return 'Urgence';
      case 'safety_check':
        return 'Vérification sécurité';
      case 'lost_child':
        return 'Enfant perdu';
      case 'suspicious_activity':
        return 'Activité suspecte';
      default:
        return 'Autre';
    }
  };

  const getRemainingTime = (): string => {
    if (!activeSession) return '';
    
    const elapsed = (Date.now() - activeSession.startTime.getTime()) / 1000;
    const remaining = Math.max(0, activeSession.duration - elapsed);
    
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.MD,
    },
    headerIcon: {
      marginRight: theme.spacing.SM,
    },
    title: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      flex: 1,
    },
    premiumBadge: {
      backgroundColor: theme.colors.warning,
      paddingHorizontal: theme.spacing.SM,
      paddingVertical: 4,
      borderRadius: 12,
    },
    premiumText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.BOLD,
    },
    activeStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.success + '20',
      padding: theme.spacing.MD,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      marginBottom: theme.spacing.MD,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.success,
      marginRight: theme.spacing.SM,
    },
    statusText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.success,
      flex: 1,
    },
    remainingTime: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.success,
    },
    quickActions: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
      marginBottom: theme.spacing.MD,
    },
    quickAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.MD,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      gap: theme.spacing.XS,
    },
    emergencyAction: {
      backgroundColor: '#FF4444',
    },
    safetyAction: {
      backgroundColor: theme.colors.warning,
    },
    lostAction: {
      backgroundColor: theme.colors.secondary,
    },
    quickActionText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    advancedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      gap: theme.spacing.XS,
    },
    advancedButtonText: {
      color: theme.colors.primary,
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    stopButton: {
      backgroundColor: theme.colors.error,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.MD,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      gap: theme.spacing.SM,
    },
    stopButtonText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.BOLD,
    },
    disabledContainer: {
      opacity: 0.6,
    },
    disabledText: {
      textAlign: 'center',
      color: theme.colors.gray[600],
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: theme.spacing.SM,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.XL,
      margin: theme.spacing.XL,
      maxHeight: '80%',
      width: '90%',
    },
    modalTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.LG,
      textAlign: 'center',
    },
    settingSection: {
      marginBottom: theme.spacing.LG,
    },
    settingLabel: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.SM,
    },
    settingText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
      flex: 1,
    },
    reasonButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.SM,
    },
    reasonButton: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    reasonButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    reasonButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.primary,
    },
    reasonButtonTextActive: {
      color: theme.colors.white,
    },
    durationButtons: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
    },
    durationButton: {
      flex: 1,
      paddingVertical: theme.spacing.SM,
      alignItems: 'center',
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    durationButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    durationButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.primary,
    },
    durationButtonTextActive: {
      color: theme.colors.white,
    },
    qualityButtons: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
    },
    qualityButton: {
      flex: 1,
      paddingVertical: theme.spacing.SM,
      alignItems: 'center',
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    qualityButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    qualityButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.primary,
    },
    qualityButtonTextActive: {
      color: theme.colors.white,
    },
    modalActions: {
      flexDirection: 'row',
      gap: theme.spacing.MD,
      marginTop: theme.spacing.LG,
    },
    modalButton: {
      flex: 1,
    },
  });

  if (disabled) {
    return (
      <View style={[styles.container, styles.disabledContainer, style]}>
        <View style={styles.header}>
          <Ionicons 
            name="headset" 
            size={24} 
            color={theme.colors.gray[400]} 
            style={styles.headerIcon}
          />
          <Text style={styles.title}>Écoute environnement</Text>
        </View>
        <Text style={styles.disabledText}>
          Enfant hors ligne - Écoute indisponible
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, style]}>
        <View style={styles.header}>
          <Ionicons 
            name="headset" 
            size={24} 
            color={theme.colors.primary} 
            style={styles.headerIcon}
          />
          <Text style={styles.title}>Écoute environnement</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        </View>

        {activeSession ? (
          <>
            <View style={styles.activeStatus}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                Écoute active • {getReasonText(activeSession.reason)}
              </Text>
              <Text style={styles.remainingTime}>
                {getRemainingTime()}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.stopButton}
              onPress={handleStopListening}
            >
              <Ionicons name="stop" size={20} color={theme.colors.white} />
              <Text style={styles.stopButtonText}>Arrêter l'écoute</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={[styles.quickAction, styles.emergencyAction]}
                onPress={() => handleQuickListen('emergency')}
                disabled={isLoading}
              >
                <Ionicons name="warning" size={16} color={theme.colors.white} />
                <Text style={styles.quickActionText}>Urgence</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.quickAction, styles.safetyAction]}
                onPress={() => handleQuickListen('safety_check')}
                disabled={isLoading}
              >
                <Ionicons name="shield-checkmark" size={16} color={theme.colors.white} />
                <Text style={styles.quickActionText}>Sécurité</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.quickAction, styles.lostAction]}
                onPress={() => handleQuickListen('lost_child')}
                disabled={isLoading}
              >
                <Ionicons name="location" size={16} color={theme.colors.white} />
                <Text style={styles.quickActionText}>Perdu</Text>
              </TouchableOpacity>
            </View>

            {/* Advanced Options */}
            <TouchableOpacity 
              style={styles.advancedButton}
              onPress={() => setShowAdvancedModal(true)}
              disabled={isLoading}
            >
              <Ionicons name="settings" size={16} color={theme.colors.primary} />
              <Text style={styles.advancedButtonText}>Options avancées</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Advanced Settings Modal */}
      <Modal
        visible={showAdvancedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAdvancedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Configuration avancée</Text>

              {/* Reason Selection */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Raison de l'écoute</Text>
                <View style={styles.reasonButtons}>
                  {[
                    { key: 'emergency', label: 'Urgence' },
                    { key: 'safety_check', label: 'Sécurité' },
                    { key: 'lost_child', label: 'Enfant perdu' },
                    { key: 'suspicious_activity', label: 'Activité suspecte' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.reasonButton,
                        reason === item.key && styles.reasonButtonActive,
                      ]}
                      onPress={() => setReason(item.key as ListeningSession['reason'])}
                    >
                      <Text style={[
                        styles.reasonButtonText,
                        reason === item.key && styles.reasonButtonTextActive,
                      ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Duration Selection */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Durée d'écoute</Text>
                <View style={styles.durationButtons}>
                  {[
                    { value: 60, label: '1 min' },
                    { value: 180, label: '3 min' },
                    { value: 300, label: '5 min' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.durationButton,
                        duration === item.value && styles.durationButtonActive,
                      ]}
                      onPress={() => setDuration(item.value)}
                    >
                      <Text style={[
                        styles.durationButtonText,
                        duration === item.value && styles.durationButtonTextActive,
                      ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Audio Quality */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Qualité audio</Text>
                <View style={styles.qualityButtons}>
                  {[
                    { value: 'low', label: 'Faible' },
                    { value: 'medium', label: 'Moyenne' },
                    { value: 'high', label: 'Élevée' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.qualityButton,
                        audioQuality === item.value && styles.qualityButtonActive,
                      ]}
                      onPress={() => setAudioQuality(item.value as 'low' | 'medium' | 'high')}
                    >
                      <Text style={[
                        styles.qualityButtonText,
                        audioQuality === item.value && styles.qualityButtonTextActive,
                      ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Emergency Mode */}
              <View style={styles.settingSection}>
                <View style={styles.settingRow}>
                  <Text style={styles.settingText}>Mode urgence (bypass consentement)</Text>
                  <Switch
                    value={emergencyMode}
                    onValueChange={setEmergencyMode}
                    trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
                  />
                </View>
              </View>

              {/* Require Consent */}
              {!emergencyMode && (
                <View style={styles.settingSection}>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingText}>Demander le consentement</Text>
                    <Switch
                      value={requireConsent}
                      onValueChange={setRequireConsent}
                      trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                onPress={() => setShowAdvancedModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Démarrer l'écoute"
                onPress={handleAdvancedListen}
                loading={isLoading}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default EnvironmentListeningControl;