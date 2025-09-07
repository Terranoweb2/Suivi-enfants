import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { remoteSoundService, SoundTriggerRequest, SoundTriggerResponse } from '../../services/remoteSoundService';
import { formatDate, formatTime, formatDistanceToNow } from '../../utils';

interface RemoteSoundHistoryScreenProps {
  navigation: any;
  route?: {
    params?: {
      childId?: string;
    };
  };
}

const RemoteSoundHistoryScreen: React.FC<RemoteSoundHistoryScreenProps> = ({ 
  navigation,
  route 
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const childId = route?.params?.childId;
  
  const [requests, setRequests] = useState<SoundTriggerRequest[]>([]);
  const [responses, setResponses] = useState<SoundTriggerResponse[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'active'>('all');

  useEffect(() => {
    loadHistory();
  }, [filter, childId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      const [requestHistory, responseHistory] = await Promise.all([
        remoteSoundService.getSoundHistory(childId),
        remoteSoundService.getResponseHistory(childId),
      ]);
      
      let filteredRequests = requestHistory;
      
      switch (filter) {
        case 'completed':
          filteredRequests = requestHistory.filter(req => req.status === 'completed');
          break;
        case 'failed':
          filteredRequests = requestHistory.filter(req => req.status === 'failed');
          break;
        case 'active':
          filteredRequests = requestHistory.filter(req => req.status === 'playing');
          break;
      }
      
      setRequests(filteredRequests);
      setResponses(responseHistory);
    } catch (error) {
      console.error('Error loading sound history:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'historique des sons');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [filter, childId]);

  const handleCancelSound = async (requestId: string) => {
    Alert.alert(
      'Annuler le son',
      'Êtes-vous sûr de vouloir arrêter ce son ?',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui', 
          style: 'destructive',
          onPress: async () => {
            const success = await remoteSoundService.cancelRemoteSound(requestId);
            if (success) {
              await loadHistory();
              Alert.alert('Succès', 'Son arrêté avec succès');
            } else {
              Alert.alert('Erreur', 'Impossible d\'arrêter le son');
            }
          }
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#32CD32';
      case 'playing':
        return '#1E90FF';
      case 'failed':
        return '#FF4444';
      case 'cancelled':
        return '#FFA500';
      case 'pending':
        return '#9E9E9E';
      default:
        return theme.colors.gray[500];
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Terminé';
      case 'playing':
        return 'En cours';
      case 'failed':
        return 'Échec';
      case 'cancelled':
        return 'Annulé';
      case 'pending':
        return 'En attente';
      default:
        return 'Inconnu';
    }
  };

  const getSoundTypeIcon = (soundType: string) => {
    switch (soundType) {
      case 'alarm':
        return 'alarm';
      case 'whistle':
        return 'musical-note';
      case 'siren':
        return 'warning';
      case 'bell':
        return 'notifications';
      case 'custom':
        return 'volume-high';
      default:
        return 'volume-medium';
    }
  };

  const getSoundTypeName = (soundType: string) => {
    switch (soundType) {
      case 'alarm':
        return 'Alarme';
      case 'whistle':
        return 'Sifflet';
      case 'siren':
        return 'Sirène';
      case 'bell':
        return 'Sonnette';
      case 'custom':
        return 'Personnalisé';
      default:
        return 'Inconnu';
    }
  };

  const getResponse = (requestId: string): SoundTriggerResponse | undefined => {
    return responses.find(response => response.requestId === requestId);
  };

  const renderRequest = ({ item: request }: { item: SoundTriggerRequest }) => {
    const response = getResponse(request.id);
    
    return (
      <View style={[styles.requestCard, { borderLeftColor: getStatusColor(request.status) }]}>
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Ionicons 
              name={getSoundTypeIcon(request.soundType) as any} 
              size={24} 
              color={getStatusColor(request.status)} 
            />
            <View style={styles.requestText}>
              <Text style={[styles.requestTitle, { color: theme.colors.text }]}>
                {getSoundTypeName(request.soundType)}
              </Text>
              <Text style={[styles.requestSubtitle, { color: theme.colors.gray[600] }]}>
                {formatDistanceToNow(request.timestamp)} • {getStatusText(request.status)}
              </Text>
            </View>
          </View>
          
          <View style={styles.requestActions}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
              <Text style={styles.statusText}>{getStatusText(request.status)}</Text>
            </View>
            
            {request.status === 'playing' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
                onPress={() => handleCancelSound(request.id)}
              >
                <Ionicons name="stop" size={16} color={theme.colors.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.requestDetails}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.gray[600] }]}>
              Heure: 
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {formatDate(request.timestamp)} à {formatTime(request.timestamp)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.gray[600] }]}>
              Volume: 
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {request.volume}%
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.gray[600] }]}>
              Durée prévue: 
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {request.duration}s
            </Text>
          </View>
          
          {response && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.gray[600] }]}>
                Durée réelle: 
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                {Math.round(response.actualDuration)}s
              </Text>
            </View>
          )}
          
          {request.message && (
            <View style={styles.messageContainer}>
              <Text style={[styles.detailLabel, { color: theme.colors.gray[600] }]}>
                Message: 
              </Text>
              <Text style={[styles.messageText, { color: theme.colors.text }]}>
                "{request.message}"
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

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
    requestCard: {
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
    requestHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.SM,
    },
    requestInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
      gap: theme.spacing.SM,
    },
    requestText: {
      flex: 1,
    },
    requestTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: 4,
    },
    requestSubtitle: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    requestActions: {
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
    requestDetails: {
      gap: 4,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      minWidth: 100,
    },
    detailValue: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      flex: 1,
    },
    messageContainer: {
      marginTop: theme.spacing.SM,
      padding: theme.spacing.SM,
      backgroundColor: theme.colors.gray[100],
      borderRadius: theme.sizes.BUTTON_RADIUS,
    },
    messageText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      fontStyle: 'italic',
      marginTop: 4,
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
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Historique des sons</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'Tous')}
        {renderFilterButton('completed', 'Terminés')}
        {renderFilterButton('active', 'En cours')}
        {renderFilterButton('failed', 'Échecs')}
      </View>

      <View style={styles.content}>
        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="volume-medium-outline" 
              size={64} 
              color={theme.colors.gray[400]} 
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {filter === 'active' ? 'Aucun son en cours' : 'Aucun historique'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'active' 
                ? 'Aucun son n\'est actuellement en cours de diffusion.'
                : 'Aucun son n\'a été déclenché récemment.'
              }
            </Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            renderItem={renderRequest}
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
    </SafeAreaView>
  );
};

export default RemoteSoundHistoryScreen;