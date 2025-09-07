import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  usageControlService, 
  AppUsageData, 
  UsageSettings 
} from '../../services/usageControlService';
import { formatDate, formatTime } from '../../utils';
import Button from '../../components/Button';

interface UsageControlScreenProps {
  navigation: any;
  route?: {
    params?: {
      childId?: string;
    };
  };
}

const UsageControlScreen: React.FC<UsageControlScreenProps> = ({ 
  navigation,
  route 
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const childId = route?.params?.childId || '';
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'apps' | 'settings'>('overview');
  const [todayUsage, setTodayUsage] = useState<any>(null);
  const [weeklyUsage, setWeeklyUsage] = useState<any>(null);
  const [appUsage, setAppUsage] = useState<AppUsageData[]>([]);
  const [settings, setSettings] = useState<UsageSettings | null>(null);

  useEffect(() => {
    loadData();
  }, [childId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [today, weekly, userSettings] = await Promise.all([
        usageControlService.getTodayUsage(childId),
        usageControlService.getWeeklyUsage(childId),
        usageControlService.getSettings(),
      ]);
      
      setTodayUsage(today);
      setWeeklyUsage(weekly);
      setAppUsage(today.appUsage || []);
      setSettings(userSettings);
    } catch (error) {
      console.error('Error loading usage data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données d\'usage');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [childId]);

  const handleUpdateSettings = async (newSettings: Partial<UsageSettings>) => {
    try {
      const success = await usageControlService.updateSettings(newSettings);
      if (success) {
        setSettings({ ...settings!, ...newSettings });
        Alert.alert('Succès', 'Paramètres mis à jour');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour les paramètres');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const handleBlockApp = async (app: AppUsageData) => {
    Alert.alert(
      'Bloquer l\'application',
      `Êtes-vous sûr de vouloir bloquer "${app.appName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Bloquer', 
          style: 'destructive',
          onPress: async () => {
            const success = await usageControlService.blockApp({
              childId,
              appPackageName: app.packageName,
              action: 'block',
              reason: 'Parent blocked',
            });
            if (success) {
              await loadData();
              Alert.alert('Succès', 'Application bloquée');
            } else {
              Alert.alert('Erreur', 'Impossible de bloquer l\'application');
            }
          }
        },
      ]
    );
  };

  const handleUnblockApp = async (app: AppUsageData) => {
    const success = await usageControlService.unblockApp(app.packageName);
    if (success) {
      await loadData();
      Alert.alert('Succès', 'Application débloquée');
    } else {
      Alert.alert('Erreur', 'Impossible de débloquer l\'application');
    }
  };

  const handleSetAppLimit = (app: AppUsageData) => {
    Alert.prompt(
      'Définir une limite',
      `Limite quotidienne pour "${app.appName}" (en minutes):`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Définir', 
          onPress: async (input) => {
            const limit = parseInt(input || '0');
            if (limit > 0) {
              const success = await usageControlService.setAppTimeLimit(app.packageName, limit);
              if (success) {
                await loadData();
                Alert.alert('Succès', `Limite de ${limit} minutes définie`);
              } else {
                Alert.alert('Erreur', 'Impossible de définir la limite');
              }
            }
          }
        },
      ],
      'plain-text',
      app.timeLimit?.toString() || '60'
    );
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}min`;
    }
    return `${remainingMinutes}min`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social':
        return 'people';
      case 'games':
        return 'game-controller';
      case 'education':
        return 'school';
      case 'entertainment':
        return 'play';
      case 'productivity':
        return 'briefcase';
      default:
        return 'apps';
    }
  };

  const renderTabButton = (tabKey: typeof activeTab, label: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tabKey && styles.activeTabButton,
        { borderColor: theme.colors.primary }
      ]}
      onPress={() => setActiveTab(tabKey)}
    >
      <Ionicons 
        name={icon as any} 
        size={20} 
        color={activeTab === tabKey ? theme.colors.white : theme.colors.primary} 
      />
      <Text style={[
        styles.tabButtonText,
        activeTab === tabKey 
          ? { color: theme.colors.white }
          : { color: theme.colors.primary }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderOverview = () => (
    <ScrollView style={styles.tabContent}>
      {/* Today's Usage */}
      {todayUsage && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Usage d'aujourd'hui
          </Text>
          
          <View style={[styles.usageCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.usageStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {formatMinutes(todayUsage.totalScreenTime)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>
                  Temps total
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.secondary }]}>
                  {todayUsage.appUsage.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>
                  Applications
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                  {todayUsage.sessionsCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>
                  Sessions
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Weekly Overview */}
      {weeklyUsage && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Aperçu hebdomadaire
          </Text>
          
          <View style={[styles.usageCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.usageStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {formatMinutes(weeklyUsage.totalWeek)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>
                  Total semaine
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.colors.secondary }]}>
                  {formatMinutes(Math.round(weeklyUsage.averageDaily))}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.gray[600] }]}>
                  Moyenne/jour
                </Text>
              </View>
            </View>
            
            {/* Daily breakdown */}
            <View style={styles.dailyBreakdown}>
              <Text style={[styles.subsectionTitle, { color: theme.colors.text }]}>
                Utilisation par jour
              </Text>
              {weeklyUsage.dailyUsage.map((day: any, index: number) => (
                <View key={index} style={styles.dayItem}>
                  <Text style={[styles.dayLabel, { color: theme.colors.text }]}>
                    {formatDate(new Date(day.date))}
                  </Text>
                  <Text style={[styles.dayValue, { color: theme.colors.gray[600] }]}>
                    {formatMinutes(day.screenTime)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderApps = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Gestion des applications
        </Text>
        
        {appUsage.map((app) => (
          <View key={app.appId} style={[styles.appCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.appHeader}>
              <View style={styles.appInfo}>
                <View style={[styles.appIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons 
                    name={getCategoryIcon(app.category) as any} 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                </View>
                <View style={styles.appDetails}>
                  <Text style={[styles.appName, { color: theme.colors.text }]}>
                    {app.appName}
                  </Text>
                  <Text style={[styles.appCategory, { color: theme.colors.gray[600] }]}>
                    {app.category} • {formatMinutes(app.usageTime)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.appActions}>
                {app.isBlocked ? (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                    onPress={() => handleUnblockApp(app)}
                  >
                    <Ionicons name="checkmark" size={16} color={theme.colors.white} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
                    onPress={() => handleBlockApp(app)}
                  >
                    <Ionicons name="close" size={16} color={theme.colors.white} />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.colors.warning }]}
                  onPress={() => handleSetAppLimit(app)}
                >
                  <Ionicons name="time" size={16} color={theme.colors.white} />
                </TouchableOpacity>
              </View>
            </View>
            
            {app.timeLimit && (
              <View style={styles.appLimit}>
                <Text style={[styles.limitText, { color: theme.colors.gray[600] }]}>
                  Limite: {formatMinutes(app.timeLimit)} par jour
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView style={styles.tabContent}>
      {settings && (
        <>
          {/* Screen Time Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Temps d'écran
            </Text>
            
            <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Limite quotidienne: {formatMinutes(settings.dailyScreenTimeLimit)}
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                  Temps d'écran maximum autorisé par jour
                </Text>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Temps supplémentaire weekend: {formatMinutes(settings.weekendExtraTime)}
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                  Temps d'écran supplémentaire le weekend
                </Text>
              </View>
            </View>
          </View>

          {/* Bedtime Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Heure du coucher
            </Text>
            
            <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Début: {settings.bedtimeStart}
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                  Heure de début du mode nuit
                </Text>
              </View>
              
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Fin: {settings.bedtimeEnd}
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                  Heure de fin du mode nuit
                </Text>
              </View>
            </View>
          </View>

          {/* App Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Applications
            </Text>
            
            <View style={[styles.settingCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.settingToggle}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                    Apps éducatives illimitées
                  </Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                    Permettre un usage illimité des apps éducatives
                  </Text>
                </View>
                <Switch
                  value={settings.educationAppsUnlimited}
                  onValueChange={(value) => handleUpdateSettings({ educationAppsUnlimited: value })}
                  trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
                />
              </View>
              
              <View style={styles.settingToggle}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                    Rappels de pause
                  </Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                    Rappeler de faire des pauses régulières
                  </Text>
                </View>
                <Switch
                  value={settings.breakReminders}
                  onValueChange={(value) => handleUpdateSettings({ breakReminders: value })}
                  trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
                />
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
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
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.SM,
      gap: theme.spacing.SM,
    },
    tabButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      gap: theme.spacing.XS,
    },
    activeTabButton: {
      backgroundColor: theme.colors.primary,
    },
    tabButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    tabContent: {
      flex: 1,
      padding: theme.spacing.LG,
    },
    section: {
      marginBottom: theme.spacing.XL,
    },
    sectionTitle: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: theme.spacing.MD,
    },
    subsectionTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      marginBottom: theme.spacing.SM,
    },
    usageCard: {
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    usageStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: theme.spacing.LG,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: theme.fontSizes.XL,
      fontFamily: theme.fonts.BOLD,
    },
    statLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: theme.spacing.XS,
    },
    dailyBreakdown: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.gray[200],
      paddingTop: theme.spacing.MD,
    },
    dayItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.SM,
    },
    dayLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    dayValue: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    appCard: {
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.MD,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    appHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    appInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    appIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.SM,
    },
    appDetails: {
      flex: 1,
    },
    appName: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    appCategory: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 2,
    },
    appActions: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
    },
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appLimit: {
      marginTop: theme.spacing.SM,
      paddingTop: theme.spacing.SM,
      borderTopWidth: 1,
      borderTopColor: theme.colors.gray[200],
    },
    limitText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    settingCard: {
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    settingItem: {
      marginBottom: theme.spacing.MD,
    },
    settingToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.MD,
    },
    toggleInfo: {
      flex: 1,
      marginRight: theme.spacing.MD,
    },
    settingLabel: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    settingDescription: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 4,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Contrôle d'usage</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabContainer}>
        {renderTabButton('overview', 'Vue d\'ensemble', 'stats-chart')}
        {renderTabButton('apps', 'Applications', 'apps')}
        {renderTabButton('settings', 'Paramètres', 'settings')}
      </View>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'apps' && renderApps()}
      {activeTab === 'settings' && renderSettings()}
    </SafeAreaView>
  );
};

export default UsageControlScreen;