import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  environmentListeningService, 
  ListeningSession 
} from '../../services/environmentListeningService';
import { formatDate, formatTime, formatDistanceToNow } from '../../utils';
import Button from '../../components/Button';

interface EnvironmentListeningHistoryScreenProps {
  navigation: any;
  route?: {
    params?: {
      childId?: string;
    };
  };
}

const EnvironmentListeningHistoryScreen: React.FC<EnvironmentListeningHistoryScreenProps> = ({ 
  navigation,
  route 
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const childId = route?.params?.childId;
  
  const [sessions, setSessions] = useState<ListeningSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [selectedSession, setSelectedSession] = useState<ListeningSession | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [audioPlayer, setAudioPlayer] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    loadHistory();
    
    return () => {
      // Cleanup audio player
      if (audioPlayer) {
        audioPlayer.unloadAsync();
      }
    };
  }, [filter, childId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      const history = await environmentListeningService.getSessionHistory(
        user?.id,
        30 // Last 30 days
      );
      
      let filteredSessions = history;
      
      // Filter by child if specified
      if (childId) {
        filteredSessions = filteredSessions.filter(session => session.childId === childId);
      }
      
      // Filter by status
      switch (filter) {
        case 'active':
          filteredSessions = filteredSessions.filter(session => session.status === 'active');
          break;
        case 'completed':
          filteredSessions = filteredSessions.filter(session => session.status === 'completed');
          break;
        case 'failed':
          filteredSessions = filteredSessions.filter(session => 
            session.status === 'failed' || session.status === 'cancelled'
          );
          break;
      }
      
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Error loading listening history:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'historique d\'écoute');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [filter, childId]);

  const handleSessionDetails = (session: ListeningSession) => {
    setSelectedSession(session);
    setShowDetailsModal(true);
  };

  const handlePlayAudio = async (session: ListeningSession) => {
    try {
      if (!session.audioFile) {
        Alert.alert('Erreur', 'Fichier audio non disponible');
        return;
      }

      // Stop current audio if playing
      if (audioPlayer) {
        await audioPlayer.unloadAsync();
        setAudioPlayer(null);
        setIsPlaying(false);
      }

      // Load and play audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: session.audioFile },
        { shouldPlay: true }
      );

      setAudioPlayer(sound);
      setIsPlaying(true);

      // Set up playback status listener
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Erreur', 'Impossible de lire le fichier audio');
    }
  };

  const handleStopAudio = async () => {
    try {
      if (audioPlayer) {
        await audioPlayer.stopAsync();
        await audioPlayer.unloadAsync();
        setAudioPlayer(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  const handleDeleteSession = (session: ListeningSession) => {
    Alert.alert(
      'Supprimer la session',
      'Êtes-vous sûr de vouloir supprimer cette session d\'écoute ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: async () => {
            const success = await environmentListeningService.deleteSession(session.id);
            if (success) {
              await loadHistory();
              setShowDetailsModal(false);
              Alert.alert('Succès', 'Session supprimée');
            } else {
              Alert.alert('Erreur', 'Impossible de supprimer la session');
            }
          }
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#32CD32';
      case 'completed':
        return theme.colors.success;
      case 'failed':
      case 'cancelled':
        return theme.colors.error;
      default:
        return theme.colors.gray[500];
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'En cours';
      case 'completed':
        return 'Terminée';
      case 'failed':
        return 'Échec';
      case 'cancelled':
        return 'Annulée';
      default:
        return 'Inconnu';
    }
  };

  const getReasonText = (reason: string) => {
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

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'emergency':
        return 'warning';
      case 'safety_check':
        return 'shield-checkmark';
      case 'lost_child':
        return 'location';
      case 'suspicious_activity':
        return 'eye';
      default:
        return 'help-circle';
    }
  };

  const getDurationText = (session: ListeningSession): string => {
    if (session.status === 'active') {
      const elapsed = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (session.endTime) {
      const duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return 'Inconnue';
  };

  const renderSession = ({ item: session }: { item: ListeningSession }) => (
    <TouchableOpacity
      style={[styles.sessionCard, { borderLeftColor: getStatusColor(session.status) }]}
      onPress={() => handleSessionDetails(session)}
    >
      <View style={styles.sessionHeader}>
        <View style={styles.sessionInfo}>
          <Ionicons 
            name={getReasonIcon(session.reason) as any} 
            size={24} 
            color={getStatusColor(session.status)} 
          />
          <View style={styles.sessionText}>
            <Text style={[styles.sessionTitle, { color: theme.colors.text }]}>
              {getReasonText(session.reason)}
            </Text>
            <Text style={[styles.sessionSubtitle, { color: theme.colors.gray[600] }]}>
              {formatDistanceToNow(session.startTime)} • {getStatusText(session.status)}
            </Text>
          </View>
        </View>
        
        <View style={styles.sessionActions}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status) }]}>
            <Text style={styles.statusText}>{getStatusText(session.status)}</Text>
          </View>
          
          {session.audioFile && session.status === 'completed' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => handlePlayAudio(session)}
            >
              <Ionicons name="play" size={16} color={theme.colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={styles.sessionDetails}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.colors.gray[600] }]}>
            Durée: {getDurationText(session)}
          </Text>
          <Text style={[styles.detailLabel, { color: theme.colors.gray[600] }]}>
            Qualité: {session.audioQuality}
          </Text>
        </View>
        
        <Text style={[styles.sessionTime, { color: theme.colors.gray[600] }]}>
          {formatDate(session.startTime)} à {formatTime(session.startTime)}
        </Text>
        
        {session.isEncrypted && (
          <View style={styles.encryptionBadge}>
            <Ionicons name="lock-closed" size={12} color={theme.colors.success} />
            <Text style={[styles.encryptionText, { color: theme.colors.success }]}>
              Chiffré
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFilterButton = (filterValue: typeof filter, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterValue && { backgroundColor: theme.colors.primary },
        { borderColor: theme.colors.primary }
      ]}
      onPress={() => setFilter(filterValue)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterValue 
          ? { color: theme.colors.white }
          : { color: theme.colors.primary }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderDetailsModal = () => (
    <Modal
      visible={showDetailsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowDetailsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {selectedSession && (
            <>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  Détails de la session
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDetailsModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>
                    Information générale
                  </Text>
                  
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                      Raison:
                    </Text>
                    <Text style={[styles.detailItemValue, { color: theme.colors.text }]}>
                      {getReasonText(selectedSession.reason)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                      Statut:
                    </Text>
                    <Text style={[
                      styles.detailItemValue, 
                      { color: getStatusColor(selectedSession.status) }
                    ]}>
                      {getStatusText(selectedSession.status)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                      Durée:
                    </Text>
                    <Text style={[styles.detailItemValue, { color: theme.colors.text }]}>
                      {getDurationText(selectedSession)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                      Qualité audio:
                    </Text>
                    <Text style={[styles.detailItemValue, { color: theme.colors.text }]}>
                      {selectedSession.audioQuality}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>
                    Horodatage
                  </Text>
                  
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                      Début:
                    </Text>
                    <Text style={[styles.detailItemValue, { color: theme.colors.text }]}>
                      {formatDate(selectedSession.startTime)} à {formatTime(selectedSession.startTime)}
                    </Text>
                  </View>
                  
                  {selectedSession.endTime && (
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                        Fin:
                      </Text>
                      <Text style={[styles.detailItemValue, { color: theme.colors.text }]}>
                        {formatDate(selectedSession.endTime)} à {formatTime(selectedSession.endTime)}
                      </Text>
                    </View>
                  )}
                </View>

                {selectedSession.location && (
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>
                      Localisation
                    </Text>
                    
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                        Coordonnées:
                      </Text>
                      <Text style={[styles.detailItemValue, { color: theme.colors.text }]}>
                        {selectedSession.location.latitude.toFixed(6)}, {selectedSession.location.longitude.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, { color: theme.colors.text }]}>
                    Sécurité
                  </Text>
                  
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                      Chiffrement:
                    </Text>
                    <Text style={[
                      styles.detailItemValue, 
                      { color: selectedSession.isEncrypted ? theme.colors.success : theme.colors.warning }
                    ]}>
                      {selectedSession.isEncrypted ? 'Activé' : 'Désactivé'}
                    </Text>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailItemLabel, { color: theme.colors.gray[600] }]}>
                      Consentement:
                    </Text>
                    <Text style={[
                      styles.detailItemValue, 
                      { color: selectedSession.consentStatus === 'approved' ? theme.colors.success : theme.colors.warning }
                    ]}>
                      {selectedSession.consentStatus === 'approved' ? 'Accordé' : 'En attente/Refusé'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalActions}>
                {selectedSession.audioFile && selectedSession.status === 'completed' && (
                  <Button
                    title={isPlaying ? "Arrêter" : "Écouter"}
                    onPress={isPlaying ? handleStopAudio : () => handlePlayAudio(selectedSession)}
                    variant={isPlaying ? "outline" : "primary"}
                    style={styles.modalActionButton}
                  />
                )}
                
                <Button
                  title="Supprimer"
                  onPress={() => handleDeleteSession(selectedSession)}
                  variant="outline"
                  style={{
                    ...styles.modalActionButton,
                    borderColor: theme.colors.error,
                  }}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

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
    filterContainer: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
      gap: theme.spacing.SM,
    },
    filterButton: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
    },
    filterButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    content: {
      flex: 1,
    },
    sessionCard: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.LG,
      marginVertical: theme.spacing.SM,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      borderLeftWidth: 4,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    sessionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.SM,
    },
    sessionInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
      gap: theme.spacing.SM,
    },
    sessionText: {
      flex: 1,
    },
    sessionTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: 4,
    },
    sessionSubtitle: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    sessionActions: {
      alignItems: 'flex-end',
      gap: theme.spacing.SM,
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
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionDetails: {
      gap: 4,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    detailLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    sessionTime: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    encryptionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: theme.spacing.XS,
    },
    encryptionText: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.XL,
    },
    emptyIcon: {
      marginBottom: theme.spacing.LG,
    },
    emptyTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
      textAlign: 'center',
      lineHeight: 22,
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
      maxHeight: '80%',
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
    modalContent: {
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
    },
    detailSection: {
      marginBottom: theme.spacing.LG,
    },
    detailSectionTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: theme.spacing.SM,
    },
    detailItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.SM,
    },
    detailItemLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      flex: 1,
    },
    detailItemValue: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      flex: 1,
      textAlign: 'right',
    },
    modalActions: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.LG,
      paddingBottom: theme.spacing.XL,
      gap: theme.spacing.MD,
    },
    modalActionButton: {
      flex: 1,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Historique d'écoute</Text>
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumText}>PREMIUM</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'Toutes')}
        {renderFilterButton('active', 'En cours')}
        {renderFilterButton('completed', 'Terminées')}
        {renderFilterButton('failed', 'Échecs')}
      </View>

      <View style={styles.content}>
        {sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="headset-outline" 
              size={64} 
              color={theme.colors.gray[400]} 
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {filter === 'active' ? 'Aucune écoute active' : 'Aucun historique'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'active' 
                ? 'Aucune session d\'écoute n\'est actuellement active.'
                : 'Aucune session d\'écoute n\'a été enregistrée récemment.'
              }
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            renderItem={renderSession}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {renderDetailsModal()}
    </SafeAreaView>
  );
};

export default EnvironmentListeningHistoryScreen;