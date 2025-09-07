import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { batteryMonitoringService, BatteryAlert } from '../services/batteryMonitoringService';
import { BatteryInfo } from '../types';
import { formatDistanceToNow } from '../utils';

interface BatteryStatusProps {
  childId?: string;
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: any;
}

const BatteryStatus: React.FC<BatteryStatusProps> = ({
  childId,
  showDetails = false,
  size = 'medium',
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo | null>(null);
  const [alerts, setAlerts] = useState<BatteryAlert[]>([]);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    loadBatteryInfo();
    loadAlerts();

    // Set up battery monitoring listener
    const unsubscribe = batteryMonitoringService.addBatteryListener((info) => {
      setBatteryInfo(info);
    });

    // Start monitoring if not already active
    if (!batteryMonitoringService.isMonitoringActive()) {
      batteryMonitoringService.startBatteryMonitoring();
    }

    return () => {
      unsubscribe();
    };
  }, [childId]);

  useEffect(() => {
    // Start pulse animation for critical battery
    if (batteryInfo && batteryInfo.level <= 5 && !batteryInfo.isCharging) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [batteryInfo]);

  const loadBatteryInfo = () => {
    const info = batteryMonitoringService.getCurrentBatteryInfo();
    setBatteryInfo(info);
  };

  const loadAlerts = async () => {
    try {
      const alertHistory = await batteryMonitoringService.getAlertHistory(1);
      const unacknowledged = alertHistory.filter(alert => !alert.acknowledged);
      setAlerts(unacknowledged);
    } catch (error) {
      console.error('Error loading battery alerts:', error);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation(() => {
      pulseAnim.setValue(1);
    });
  };

  const getBatteryColor = (level: number, isCharging: boolean): string => {
    if (isCharging) return theme.colors.success;
    if (level <= 5) return '#FF4444';
    if (level <= 20) return theme.colors.warning;
    if (level <= 50) return theme.colors.secondary;
    return theme.colors.success;
  };

  const getBatteryIcon = (level: number, isCharging: boolean): string => {
    if (isCharging) return 'battery-charging';
    if (level <= 10) return 'battery-dead';
    if (level <= 25) return 'battery-quarter';
    if (level <= 50) return 'battery-half';
    if (level <= 75) return 'battery-three-quarters';
    return 'battery-full';
  };

  const getStatusText = (level: number, isCharging: boolean): string => {
    if (isCharging) return 'En charge';
    if (level <= 5) return 'Critique';
    if (level <= 20) return 'Faible';
    if (level <= 50) return 'Moyen';
    return 'Bon';
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (alerts.length > 0) {
      showBatteryAlert();
    }
  };

  const showBatteryAlert = () => {
    if (!batteryInfo) return;

    const { level, isCharging } = batteryInfo;
    let message = `Niveau de batterie: ${level}%\n`;
    message += `État: ${isCharging ? 'En charge' : 'Sur batterie'}\n`;
    
    if (alerts.length > 0) {
      message += `\n${alerts.length} alerte(s) non lue(s)`;
    }

    Alert.alert(
      'État de la batterie',
      message,
      [
        { text: 'OK', style: 'default' },
        alerts.length > 0 && {
          text: 'Marquer comme lu',
          onPress: () => acknowledgeAlerts(),
        },
      ].filter(Boolean) as any
    );
  };

  const acknowledgeAlerts = async () => {
    try {
      for (const alert of alerts) {
        await batteryMonitoringService.acknowledgeAlert(alert.id);
      }
      setAlerts([]);
    } catch (error) {
      console.error('Error acknowledging alerts:', error);
    }
  };

  const getComponentSize = () => {
    switch (size) {
      case 'small':
        return { iconSize: 20, textSize: theme.fontSizes.SM };
      case 'large':
        return { iconSize: 32, textSize: theme.fontSizes.LG };
      default:
        return { iconSize: 24, textSize: theme.fontSizes.MD };
    }
  };

  const componentSize = getComponentSize();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: size === 'small' ? theme.spacing.SM : theme.spacing.MD,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    loading: {
      opacity: 0.6,
    },
    batteryIcon: {
      marginRight: theme.spacing.SM,
    },
    batteryInfo: {
      flex: 1,
    },
    batteryLevel: {
      fontSize: componentSize.textSize,
      fontFamily: theme.fonts.BOLD,
      color: getBatteryColor(batteryInfo?.level || 0, batteryInfo?.isCharging || false),
    },
    batteryStatus: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
      marginTop: 2,
    },
    alertIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.error,
      marginLeft: theme.spacing.SM,
    },
    detailsContainer: {
      marginTop: theme.spacing.SM,
      paddingTop: theme.spacing.SM,
      borderTopWidth: 1,
      borderTopColor: theme.colors.gray[200],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    detailLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
    },
    detailValue: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
    },
    loadingText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      marginLeft: theme.spacing.SM,
    },
    pressable: {
      opacity: 0.8,
    },
  });

  if (!batteryInfo) {
    return (
      <View style={[styles.container, styles.loading, style]}>
        <Ionicons 
          name="battery-dead" 
          size={getComponentSize().iconSize} 
          color={theme.colors.gray[400]} 
        />
        <Text style={[styles.loadingText, { color: theme.colors.gray[600] }]}>
          Chargement...
        </Text>
      </View>
    );
  }

  const { level, isCharging } = batteryInfo;
  const batteryColor = getBatteryColor(level, isCharging);
  const batteryIcon = getBatteryIcon(level, isCharging);
  const statusText = getStatusText(level, isCharging);

  return (
    <TouchableOpacity 
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Animated.View 
        style={[
          styles.batteryIcon,
          { transform: [{ scale: pulseAnim }] }
        ]}
      >
        <Ionicons 
          name={batteryIcon as any}
          size={componentSize.iconSize}
          color={batteryColor}
        />
      </Animated.View>

      <View style={styles.batteryInfo}>
        <Text style={styles.batteryLevel}>{level}%</Text>
        <Text style={styles.batteryStatus}>{statusText}</Text>
        
        {showDetails && (
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>État:</Text>
              <Text style={styles.detailValue}>
                {isCharging ? 'En charge' : 'Sur batterie'}
              </Text>
            </View>
            
            {batteryInfo.temperature && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Température:</Text>
                <Text style={styles.detailValue}>
                  {batteryInfo.temperature.toFixed(1)}°C
                </Text>
              </View>
            )}
            
            {batteryInfo.health && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Santé:</Text>
                <Text style={styles.detailValue}>{batteryInfo.health}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {alerts.length > 0 && (
        <View style={styles.alertIndicator} />
      )}
    </TouchableOpacity>
  );
};

export default BatteryStatus;