import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  usageControlService, 
  AppUsageData, 
  UsageSettings 
} from '../services/usageControlService';
import { formatTime } from '../utils';
import Button from './Button';

interface UsageControlDashboardProps {
  childId: string;
  childName: string;
  onNavigateToDetails?: () => void;
  style?: any;
}

const UsageControlDashboard: React.FC<UsageControlDashboardProps> = ({
  childId,
  childName,
  onNavigateToDetails,
  style,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [todayUsage, setTodayUsage] = useState<any>(null);
  const [settings, setSettings] = useState<UsageSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    loadUsageData();
    checkMonitoringStatus();
    
    // Set up usage listener
    const unsubscribe = usageControlService.addUsageListener((data) => {
      if (data.type === 'session_update') {
        loadUsageData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [childId]);

  const loadUsageData = async () => {
    try {
      setIsLoading(true);
      
      const [usage, userSettings] = await Promise.all([
        usageControlService.getTodayUsage(childId),
        usageControlService.getSettings(),
      ]);
      
      setTodayUsage(usage);
      setSettings(userSettings);
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkMonitoringStatus = () => {
    setIsMonitoring(usageControlService.isMonitoringActive());
  };

  const handleToggleMonitoring = async () => {
    try {
      if (isMonitoring) {
        await usageControlService.stopScreenTimeMonitoring();
        setIsMonitoring(false);
        Alert.alert('Surveillance arrêtée', 'La surveillance du temps d\'écran a été arrêtée');
      } else {
        const success = await usageControlService.startScreenTimeMonitoring(childId);
        if (success) {
          setIsMonitoring(true);
          Alert.alert('Surveillance activée', 'La surveillance du temps d\'écran a été activée');
        } else {
          Alert.alert('Erreur', 'Impossible d\'activer la surveillance');
        }
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const handleQuickAction = async (action: 'break_time' | 'bedtime' | 'limit_reached') => {
    switch (action) {
      case 'break_time':
        Alert.alert(
          'Pause recommandée',
          `Envoyer une notification de pause à ${childName} ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Envoyer', onPress: () => console.log('Break notification sent') },
          ]
        );
        break;
      case 'bedtime':
        Alert.alert(
          'Heure du coucher',
          `Activer le mode nuit pour ${childName} ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Activer', onPress: () => console.log('Bedtime mode activated') },
          ]
        );
        break;
      case 'limit_reached':
        Alert.alert(
          'Limite atteinte',
          `La limite quotidienne de ${childName} a été atteinte. Bloquer l'accès ?`,
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Bloquer', onPress: () => console.log('Device access blocked') },
          ]
        );
        break;
    }
  };

  const getUsageStatusColor = (status: string) => {
    switch (status) {
      case 'within':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      case 'exceeded':
        return theme.colors.error;
      default:
        return theme.colors.gray[500];
    }
  };

  const getUsageStatusText = (status: string) => {
    switch (status) {
      case 'within':
        return 'Dans les limites';
      case 'warning':
        return 'Attention - Proche limite';
      case 'exceeded':
        return 'Limite dépassée';
      default:
        return 'Statut inconnu';
    }
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}min`;
    }
    return `${remainingMinutes}min`;
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
      marginBottom: theme.spacing.LG,
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
    monitoringToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.SM,
    },
    toggleText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
    },
    usageOverview: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.LG,
    },
    usageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.SM,
    },
    usageIcon: {
      marginRight: theme.spacing.SM,
    },
    usageLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
      flex: 1,
    },
    usageValue: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.SM,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: theme.spacing.SM,
    },
    statusText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.BOLD,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.colors.gray[200],
      borderRadius: 4,
      marginTop: theme.spacing.SM,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    quickActions: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
      marginBottom: theme.spacing.LG,
    },
    quickAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      gap: theme.spacing.XS,
    },
    breakAction: {
      backgroundColor: theme.colors.secondary,
    },
    bedtimeAction: {
      backgroundColor: theme.colors.primary,
    },
    limitAction: {
      backgroundColor: theme.colors.error,
    },
    quickActionText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    topApps: {
      marginBottom: theme.spacing.LG,
    },
    sectionTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
    },
    appItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.SM,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray[200],
    },
    appIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.SM,
    },
    appInfo: {
      flex: 1,
    },
    appName: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
    },
    appCategory: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
    },
    appUsage: {
      alignItems: 'flex-end',
    },
    appTime: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
    },
    appStatus: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
    },
    viewDetailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      gap: theme.spacing.XS,
    },
    viewDetailsText: {
      color: theme.colors.primary,
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: theme.spacing.XL,
    },
    loadingText: {
      marginTop: theme.spacing.SM,
      color: theme.colors.gray[600],
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="time" size={32} color={theme.colors.gray[400]} />
          <Text style={styles.loadingText}>Chargement des données d'usage...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons 
          name="time" 
          size={24} 
          color={theme.colors.primary} 
          style={styles.headerIcon}
        />
        <Text style={styles.title}>Contrôle d'usage</Text>
        <View style={styles.monitoringToggle}>
          <Text style={styles.toggleText}>Surveillance</Text>
          <Switch
            value={isMonitoring}
            onValueChange={handleToggleMonitoring}
            trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
          />
        </View>
      </View>

      {todayUsage && settings && (
        <>
          {/* Usage Overview */}
          <View style={styles.usageOverview}>
            <View style={styles.usageRow}>
              <Ionicons 
                name="phone-portrait" 
                size={16} 
                color={theme.colors.gray[600]} 
                style={styles.usageIcon}
              />
              <Text style={styles.usageLabel}>Temps d'écran aujourd'hui</Text>
              <Text style={styles.usageValue}>
                {formatMinutes(todayUsage.totalScreenTime)}
              </Text>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: getUsageStatusColor(todayUsage.limitStatus) }
              ]}>
                <Text style={styles.statusText}>
                  {getUsageStatusText(todayUsage.limitStatus)}
                </Text>
              </View>
            </View>

            <View style={styles.usageRow}>
              <Ionicons 
                name="apps" 
                size={16} 
                color={theme.colors.gray[600]} 
                style={styles.usageIcon}
              />
              <Text style={styles.usageLabel}>Applications utilisées</Text>
              <Text style={styles.usageValue}>{todayUsage.appUsage.length}</Text>
            </View>

            <View style={styles.usageRow}>
              <Ionicons 
                name="play" 
                size={16} 
                color={theme.colors.gray[600]} 
                style={styles.usageIcon}
              />
              <Text style={styles.usageLabel}>Sessions</Text>
              <Text style={styles.usageValue}>{todayUsage.sessionsCount}</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${Math.min(100, (todayUsage.totalScreenTime / settings.dailyScreenTimeLimit) * 100)}%`,
                    backgroundColor: getUsageStatusColor(todayUsage.limitStatus)
                  }
                ]}
              />
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={[styles.quickAction, styles.breakAction]}
              onPress={() => handleQuickAction('break_time')}
            >
              <Ionicons name="pause" size={14} color={theme.colors.white} />
              <Text style={styles.quickActionText}>Pause</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quickAction, styles.bedtimeAction]}
              onPress={() => handleQuickAction('bedtime')}
            >
              <Ionicons name="moon" size={14} color={theme.colors.white} />
              <Text style={styles.quickActionText}>Nuit</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quickAction, styles.limitAction]}
              onPress={() => handleQuickAction('limit_reached')}
            >
              <Ionicons name="stop-circle" size={14} color={theme.colors.white} />
              <Text style={styles.quickActionText}>Bloquer</Text>
            </TouchableOpacity>
          </View>

          {/* Top Apps */}
          {todayUsage.appUsage.length > 0 && (
            <View style={styles.topApps}>
              <Text style={styles.sectionTitle}>Applications les plus utilisées</Text>
              {todayUsage.appUsage.slice(0, 3).map((app: AppUsageData, index: number) => (
                <View key={app.appId} style={styles.appItem}>
                  <View style={styles.appIcon}>
                    <Ionicons 
                      name="apps" 
                      size={16} 
                      color={theme.colors.primary} 
                    />
                  </View>
                  <View style={styles.appInfo}>
                    <Text style={styles.appName}>{app.appName}</Text>
                    <Text style={styles.appCategory}>{app.category}</Text>
                  </View>
                  <View style={styles.appUsage}>
                    <Text style={styles.appTime}>{formatMinutes(app.usageTime)}</Text>
                    <Text style={styles.appStatus}>
                      {app.isBlocked ? 'Bloquée' : 'Autorisée'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* View Details Button */}
          <TouchableOpacity 
            style={styles.viewDetailsButton}
            onPress={onNavigateToDetails}
          >
            <Text style={styles.viewDetailsText}>Voir les détails</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default UsageControlDashboard;