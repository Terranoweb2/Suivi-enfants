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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  batteryMonitoringService, 
  BatteryAlert, 
  BatteryHistory, 
  BatterySettings 
} from '../../services/batteryMonitoringService';
import { formatDate, formatTime, formatDistanceToNow } from '../../utils';
import Button from '../../components/Button';
import BatteryStatus from '../../components/BatteryStatus';

const { width: screenWidth } = Dimensions.get('window');

interface BatteryMonitoringScreenProps {
  navigation: any;
  route?: {
    params?: {
      childId?: string;
    };
  };
}

const BatteryMonitoringScreen: React.FC<BatteryMonitoringScreenProps> = ({ 
  navigation,
  route 
}) => {
  const { theme } = useTheme();
  const childId = route?.params?.childId;
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'alerts' | 'settings'>('overview');
  const [batteryHistory, setBatteryHistory] = useState<BatteryHistory[]>([]);
  const [alerts, setAlerts] = useState<BatteryAlert[]>([]);
  const [settings, setSettings] = useState<BatterySettings | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [childId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [historyData, alertsData, settingsData, analyticsData] = await Promise.all([
        batteryMonitoringService.getBatteryHistory(7),
        batteryMonitoringService.getAlertHistory(30),
        batteryMonitoringService.getSettings(),
        batteryMonitoringService.getBatteryAnalytics(7),
      ]);
      
      setBatteryHistory(historyData);
      setAlerts(alertsData);
      setSettings(settingsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading battery data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données de batterie');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [childId]);

  const handleUpdateSettings = async (newSettings: Partial<BatterySettings>) => {
    try {
      const success = await batteryMonitoringService.updateSettings(newSettings);
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

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const success = await batteryMonitoringService.acknowledgeAlert(alertId);
      if (success) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ));
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Effacer l\'historique',
      'Êtes-vous sûr de vouloir effacer tout l\'historique de batterie ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Effacer', 
          style: 'destructive',
          onPress: async () => {
            await batteryMonitoringService.clearHistory();
            await loadData();
          }
        },
      ]
    );
  };

  const getBatteryChartData = () => {
    if (batteryHistory.length === 0) return null;

    // Take last 24 data points for the chart
    const chartData = batteryHistory.slice(-24);
    
    return {
      labels: chartData.map((_, index) => {
        if (index % 4 === 0) { // Show every 4th label
          return formatTime(chartData[index].timestamp).slice(0, 5);
        }
        return '';
      }),
      datasets: [
        {
          data: chartData.map(entry => entry.level),
          color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'critical':
        return 'warning';
      case 'low':
        return 'battery-dead';
      case 'charging':
        return 'battery-charging';
      case 'full':
        return 'battery-full';
      default:
        return 'information-circle';
    }
  };

  const getAlertColor = (alertType: string) => {
    switch (alertType) {
      case 'critical':
        return '#FF4444';
      case 'low':
        return theme.colors.warning;
      case 'charging':
        return theme.colors.success;
      case 'full':
        return theme.colors.primary;
      default:
        return theme.colors.gray[500];
    }
  };

  const getAlertTypeText = (alertType: string) => {
    switch (alertType) {
      case 'critical':
        return 'Batterie critique';
      case 'low':
        return 'Batterie faible';
      case 'charging':
        return 'En charge';
      case 'full':
        return 'Chargée';
      default:
        return 'Autre';
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
      {/* Current Battery Status */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          État actuel
        </Text>
        <BatteryStatus showDetails size="large" />
      </View>

      {/* Analytics Cards */}
      {analytics && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Analyse (7 derniers jours)
          </Text>
          
          <View style={styles.analyticsGrid}>
            <View style={[styles.analyticsCard, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="battery-half" size={24} color={theme.colors.primary} />
              <Text style={[styles.analyticsValue, { color: theme.colors.text }]}>
                {analytics.averageLevel}%
              </Text>
              <Text style={[styles.analyticsLabel, { color: theme.colors.gray[600] }]}>
                Niveau moyen
              </Text>
            </View>
            
            <View style={[styles.analyticsCard, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="time" size={24} color={theme.colors.success} />
              <Text style={[styles.analyticsValue, { color: theme.colors.text }]}>
                {analytics.timeCharging}%
              </Text>
              <Text style={[styles.analyticsLabel, { color: theme.colors.gray[600] }]}>
                Temps en charge
              </Text>
            </View>
            
            <View style={[styles.analyticsCard, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="battery-dead" size={24} color={theme.colors.warning} />
              <Text style={[styles.analyticsValue, { color: theme.colors.text }]}>
                {analytics.lowestLevel}%
              </Text>
              <Text style={[styles.analyticsLabel, { color: theme.colors.gray[600] }]}>
                Niveau minimum
              </Text>
            </View>
            
            <View style={[styles.analyticsCard, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="refresh" size={24} color={theme.colors.secondary} />
              <Text style={[styles.analyticsValue, { color: theme.colors.text }]}>
                {analytics.chargingCycles}
              </Text>
              <Text style={[styles.analyticsLabel, { color: theme.colors.gray[600] }]}>
                Cycles de charge
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Battery Chart */}
      {/* Commented out until react-native-chart-kit is properly installed
      {getBatteryChartData() && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Évolution (24h)
          </Text>
          <View style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}>
            <LineChart
              data={getBatteryChartData()!}
              width={screenWidth - 60}
              height={200}
              chartConfig={{
                backgroundColor: theme.colors.surface,
                backgroundGradientFrom: theme.colors.surface,
                backgroundGradientTo: theme.colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
                labelColor: () => theme.colors.gray[600],
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '3',
                  strokeWidth: '2',
                  stroke: theme.colors.success,
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        </View>
      )}
      */}
    </ScrollView>
  );

  const renderHistory = () => (
    <FlatList
      style={styles.tabContent}
      data={batteryHistory}
      keyExtractor={(item, index) => `${item.timestamp}-${index}`}
      renderItem={({ item }) => (
        <View style={[styles.historyItem, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.historyHeader}>
            <Ionicons 
              name={item.isCharging ? 'battery-charging' : 'battery-half'} 
              size={20} 
              color={item.isCharging ? theme.colors.success : theme.colors.primary} 
            />
            <Text style={[styles.historyLevel, { color: theme.colors.text }]}>
              {item.level}%
            </Text>
            <Text style={[styles.historyTime, { color: theme.colors.gray[600] }]}>
              {formatDistanceToNow(item.timestamp)}
            </Text>
          </View>
          <Text style={[styles.historyDetails, { color: theme.colors.gray[600] }]}>
            {formatDate(item.timestamp)} à {formatTime(item.timestamp)} • 
            {item.isCharging ? ' En charge' : ' Sur batterie'}
            {item.temperature && ` • ${item.temperature.toFixed(1)}°C`}
          </Text>
        </View>
      )}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
        />
      }
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="battery-dead" 
            size={64} 
            color={theme.colors.gray[400]} 
          />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            Aucun historique
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.gray[600] }]}>
            L'historique de batterie apparaîtra ici
          </Text>
        </View>
      )}
    />
  );

  const renderAlerts = () => (
    <FlatList
      style={styles.tabContent}
      data={alerts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={[styles.alertItem, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.alertHeader}>
            <Ionicons 
              name={getAlertIcon(item.alertType) as any} 
              size={24} 
              color={getAlertColor(item.alertType)} 
            />
            <View style={styles.alertInfo}>
              <Text style={[styles.alertTitle, { color: theme.colors.text }]}>
                {getAlertTypeText(item.alertType)}
              </Text>
              <Text style={[styles.alertSubtitle, { color: theme.colors.gray[600] }]}>
                {item.batteryLevel}% • {formatDistanceToNow(item.timestamp)}
              </Text>
            </View>
            {!item.acknowledged && (
              <TouchableOpacity
                style={[styles.acknowledgeButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleAcknowledgeAlert(item.id)}
              >
                <Ionicons name="checkmark" size={16} color={theme.colors.white} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.alertTime, { color: theme.colors.gray[600] }]}>
            {formatDate(item.timestamp)} à {formatTime(item.timestamp)}
          </Text>
        </View>
      )}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
        />
      }
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="notifications-outline" 
            size={64} 
            color={theme.colors.gray[400]} 
          />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            Aucune alerte
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.gray[600] }]}>
            Les alertes de batterie apparaîtront ici
          </Text>
        </View>
      )}
    />
  );

  const renderSettings = () => (
    <ScrollView style={styles.tabContent}>
      {settings && (
        <>
          {/* Alert Thresholds */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Seuils d'alerte
            </Text>
            
            <View style={[styles.settingItem, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Batterie faible: {settings.lowBatteryThreshold}%
              </Text>
              <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                Alerte quand la batterie descend en dessous de ce niveau
              </Text>
            </View>
            
            <View style={[styles.settingItem, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Batterie critique: {settings.criticalBatteryThreshold}%
              </Text>
              <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                Alerte critique nécessitant une charge immédiate
              </Text>
            </View>
          </View>

          {/* Alert Settings */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Notifications
            </Text>
            
            <View style={[styles.settingToggle, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Alertes batterie faible
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                  Recevoir des notifications pour batterie faible
                </Text>
              </View>
              <Switch
                value={settings.enableLowBatteryAlerts}
                onValueChange={(value) => handleUpdateSettings({ enableLowBatteryAlerts: value })}
                trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
              />
            </View>
            
            <View style={[styles.settingToggle, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Alertes batterie critique
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                  Recevoir des notifications pour batterie critique
                </Text>
              </View>
              <Switch
                value={settings.enableCriticalBatteryAlerts}
                onValueChange={(value) => handleUpdateSettings({ enableCriticalBatteryAlerts: value })}
                trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
              />
            </View>
            
            <View style={[styles.settingToggle, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Alertes de charge
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.gray[600] }]}>
                  Recevoir des notifications quand la charge commence/finit
                </Text>
              </View>
              <Switch
                value={settings.enableChargingAlerts}
                onValueChange={(value) => handleUpdateSettings({ enableChargingAlerts: value })}
                trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Actions
            </Text>
            
            <Button
              title="Effacer l'historique"
              onPress={handleClearHistory}
              variant="outline"
              style={styles.actionButton}
            />
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
    analyticsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.MD,
    },
    analyticsCard: {
      flex: 1,
      minWidth: '45%',
      alignItems: 'center',
      padding: theme.spacing.LG,
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    analyticsValue: {
      fontSize: theme.fontSizes.XL,
      fontFamily: theme.fonts.BOLD,
      marginTop: theme.spacing.SM,
    },
    analyticsLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      textAlign: 'center',
      marginTop: theme.spacing.XS,
    },
    chartContainer: {
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      overflow: 'hidden',
    },
    chart: {
      marginVertical: 8,
      borderRadius: theme.sizes.CARD_RADIUS,
    },
    historyItem: {
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.SM,
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.SM,
      marginBottom: theme.spacing.XS,
    },
    historyLevel: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.BOLD,
      flex: 1,
    },
    historyTime: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    historyDetails: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    alertItem: {
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.SM,
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.SM,
      marginBottom: theme.spacing.XS,
    },
    alertInfo: {
      flex: 1,
    },
    alertTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    alertSubtitle: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginTop: 2,
    },
    alertTime: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
    },
    acknowledgeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingItem: {
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.SM,
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    settingToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.SM,
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
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
    actionButton: {
      marginTop: theme.spacing.SM,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.XL,
      paddingTop: theme.spacing.XXL,
    },
    emptyTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
      marginTop: theme.spacing.LG,
      marginBottom: theme.spacing.SM,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
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
        <Text style={styles.title}>Surveillance batterie</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabContainer}>
        {renderTabButton('overview', 'Vue d\'ensemble', 'stats-chart')}
        {renderTabButton('history', 'Historique', 'time')}
        {renderTabButton('alerts', 'Alertes', 'notifications')}
        {renderTabButton('settings', 'Paramètres', 'settings')}
      </View>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'history' && renderHistory()}
      {activeTab === 'alerts' && renderAlerts()}
      {activeTab === 'settings' && renderSettings()}
    </SafeAreaView>
  );
};

export default BatteryMonitoringScreen;