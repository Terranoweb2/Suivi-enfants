import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { sosService } from '../../services/sosService';
import { SOSAlert } from '../../types';
import { formatDate, formatTime, formatDistanceToNow } from '../../utils';
import Button from '../../components/Button';

interface SOSHistoryScreenProps {
  navigation: any;
}

const SOSHistoryScreen: React.FC<SOSHistoryScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      
      let alertsData: SOSAlert[];
      
      switch (filter) {
        case 'active':
          alertsData = await sosService.getActiveAlerts(user?.id);
          break;
        case 'resolved':
          const allAlerts = await sosService.getAlertHistory(user?.id);
          alertsData = allAlerts.filter(alert => alert.status === 'resolved');
          break;
        default:
          alertsData = await sosService.getAlertHistory(user?.id);
      }
      
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading alerts:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'historique des alertes');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  }, [filter]);

  const handleResolveAlert = (alertId: string) => {
    Alert.alert(
      'Résoudre l\'alerte',
      'Êtes-vous sûr de vouloir marquer cette alerte comme résolue ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Résoudre', 
          style: 'default',
          onPress: async () => {
            const success = await sosService.resolveSOSAlert(alertId, user?.id || '');
            if (success) {
              await loadAlerts();
              Alert.alert('Succès', 'Alerte marquée comme résolue');
            } else {
              Alert.alert('Erreur', 'Impossible de résoudre l\'alerte');
            }
          }
        },
      ]
    );
  };

  const handleAlertDetails = (alert: SOSAlert) => {
    const timeActive = alert.resolvedAt 
      ? `Durée: ${Math.round((alert.resolvedAt.getTime() - alert.timestamp.getTime()) / 1000 / 60)} minutes`
      : 'Toujours active';
    
    const locationText = `Lat: ${alert.location.latitude.toFixed(6)}, Lng: ${alert.location.longitude.toFixed(6)}`;
    
    Alert.alert(
      'Détails de l\'alerte',
      `Statut: ${getStatusText(alert.status)}\n` +
      `Type: ${getTypeText(alert.type || '')}\n` +
      `Gravité: ${getSeverityText(alert.severity || '')}\n` +
      `Heure: ${formatDate(alert.timestamp)} à ${formatTime(alert.timestamp)}\n` +
      `${timeActive}\n` +
      `Position: ${locationText}\n` +
      `Message: ${alert.message}`,
      [
        alert.status === 'active' 
          ? { text: 'Résoudre', onPress: () => handleResolveAlert(alert.id) }
          : undefined,
        { text: 'Fermer', style: 'cancel' },
      ].filter(Boolean) as any
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#FF4444';
      case 'resolved':
        return '#32CD32';
      case 'cancelled':
        return '#FFA500';
      default:
        return theme.colors.gray[500];
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'resolved':
        return 'Résolue';
      case 'cancelled':
        return 'Annulée';
      default:
        return 'Inconnue';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'manual_trigger':
        return 'Déclenchement manuel';
      case 'follow_up':
        return 'Suivi automatique';
      case 'resolution':
        return 'Résolution';
      default:
        return 'Autre';
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'Élevée';
      case 'medium':
        return 'Moyenne';
      case 'low':
        return 'Faible';
      default:
        return 'Inconnue';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'warning';
      case 'medium':
        return 'alert-circle';
      case 'low':
        return 'information-circle';
      default:
        return 'help-circle';
    }
  };

  const renderAlert = ({ item: alert }: { item: SOSAlert }) => (
    <TouchableOpacity
      style={[styles.alertCard, { borderLeftColor: getStatusColor(alert.status) }]}
      onPress={() => handleAlertDetails(alert)}
    >
      <View style={styles.alertHeader}>
        <View style={styles.alertInfo}>
          <Ionicons 
            name={getSeverityIcon(alert.severity || 'medium')} 
            size={24} 
            color={getStatusColor(alert.status)} 
          />
          <View style={styles.alertText}>
            <Text style={[styles.alertTitle, { color: theme.colors.text }]}>
              {alert.message}
            </Text>
            <Text style={[styles.alertSubtitle, { color: theme.colors.gray[600] }]}>
              {formatDistanceToNow(alert.timestamp)} • {getStatusText(alert.status)}
            </Text>
          </View>
        </View>
        
        <View style={styles.alertActions}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(alert.status) }]}>
            <Text style={styles.statusText}>{getStatusText(alert.status)}</Text>
          </View>
          
          {alert.status === 'active' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => handleResolveAlert(alert.id)}
            >
              <Ionicons name="checkmark" size={16} color={theme.colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={styles.alertDetails}>
        <Text style={[styles.alertTime, { color: theme.colors.gray[600] }]}>
          {formatDate(alert.timestamp)} à {formatTime(alert.timestamp)}
        </Text>
        
        {alert.resolvedAt && (
          <Text style={[styles.alertResolved, { color: theme.colors.gray[600] }]}>
            Résolue le {formatDate(alert.resolvedAt)} à {formatTime(alert.resolvedAt)}
          </Text>
        )}
        
        <Text style={[styles.alertLocation, { color: theme.colors.gray[600] }]}>
          📍 Lat: {alert.location.latitude.toFixed(4)}, Lng: {alert.location.longitude.toFixed(4)}
        </Text>
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
    alertCard: {
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
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.SM,
    },
    alertInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
      gap: theme.spacing.SM,
    },
    alertText: {
      flex: 1,
    },
    alertTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: 4,
    },
    alertSubtitle: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    alertActions: {
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
    alertDetails: {
      gap: 4,
    },
    alertTime: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    alertResolved: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    alertLocation: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
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
        <Text style={styles.title}>Historique SOS</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'Toutes')}
        {renderFilterButton('active', 'Actives')}
        {renderFilterButton('resolved', 'Résolues')}
      </View>

      <View style={styles.content}>
        {alerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="shield-checkmark-outline" 
              size={64} 
              color={theme.colors.gray[400]} 
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {filter === 'active' ? 'Aucune alerte active' : 'Aucune alerte'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'active' 
                ? 'Il n\'y a actuellement aucune alerte d\'urgence active.'
                : 'Aucune alerte d\'urgence n\'a été déclenchée récemment.'
              }
            </Text>
          </View>
        ) : (
          <FlatList
            data={alerts}
            renderItem={renderAlert}
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

export default SOSHistoryScreen;