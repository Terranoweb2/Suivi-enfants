import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { sosService } from '../services/sosService';
import { SOSAlert } from '../types';

interface SOSButtonProps {
  onSOSTriggered?: (alert: SOSAlert) => void;
  onSOSCancelled?: () => void;
  style?: any;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

const SOSButton: React.FC<SOSButtonProps> = ({
  onSOSTriggered,
  onSOSCancelled,
  style,
  size = 'large',
  disabled = false,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [isPressed, setIsPressed] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  
  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownAnim = useRef(new Animated.Value(1)).current;
  
  // Timer refs
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if emergency mode is active
    setIsEmergencyActive(sosService.isEmergencyActive());
    
    // Start pulse animation if emergency is active
    if (isEmergencyActive) {
      startPulseAnimation();
    }
    
    return () => {
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (isEmergencyActive) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isEmergencyActive]);

  const clearTimers = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
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

  const handlePressIn = () => {
    if (disabled || isTriggering) return;

    setIsPressed(true);
    
    // Scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();

    // Start countdown for SOS trigger (3 seconds hold)
    setCountdown(3);
    setIsTriggering(true);
    
    // Vibration feedback
    Vibration.vibrate(100);

    // Start countdown
    countdownTimer.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          triggerSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Countdown animation
    Animated.timing(countdownAnim, {
      toValue: 0,
      duration: 3000,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;

    setIsPressed(false);
    setIsTriggering(false);
    setCountdown(0);
    
    clearTimers();

    // Scale back animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    // Reset countdown animation
    countdownAnim.setValue(1);
  };

  const triggerSOS = async () => {
    try {
      clearTimers();
      setIsTriggering(false);
      setCountdown(0);
      
      // Strong vibration
      Vibration.vibrate([0, 500, 200, 500]);

      // Trigger SOS alert
      const childId = user?.id || '';
      const alert = await sosService.triggerSOSAlert(childId);
      
      if (alert) {
        setIsEmergencyActive(true);
        onSOSTriggered?.(alert);
        
        Alert.alert(
          '🚨 ALERTE SOS DÉCLENCHÉE',
          'Votre alerte d\'urgence a été envoyée aux contacts d\'urgence.',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          'Erreur',
          'Impossible d\'envoyer l\'alerte SOS. Vérifiez votre connexion.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error triggering SOS:', error);
      Alert.alert(
        'Erreur',
        'Une erreur s\'est produite lors de l\'envoi de l\'alerte.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const cancelEmergency = () => {
    Alert.alert(
      'Annuler l\'urgence',
      'Êtes-vous sûr de vouloir annuler l\'alerte d\'urgence ?',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui', 
          style: 'destructive',
          onPress: async () => {
            // Get active alerts and cancel them
            const activeAlerts = await sosService.getActiveAlerts(user?.id);
            for (const alert of activeAlerts) {
              await sosService.cancelSOSAlert(alert.id, user?.id || '');
            }
            
            setIsEmergencyActive(false);
            onSOSCancelled?.();
            
            Alert.alert(
              'Urgence annulée',
              'L\'alerte d\'urgence a été annulée.',
              [{ text: 'OK', style: 'default' }]
            );
          }
        },
      ]
    );
  };

  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return 80;
      case 'medium':
        return 120;
      case 'large':
      default:
        return 160;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 24;
      case 'medium':
        return 36;
      case 'large':
      default:
        return 48;
    }
  };

  const buttonSize = getButtonSize();
  const iconSize = getIconSize();

  const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    button: {
      width: buttonSize,
      height: buttonSize,
      borderRadius: buttonSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    normalButton: {
      backgroundColor: '#FF4444',
      borderWidth: 4,
      borderColor: '#FF6666',
    },
    emergencyButton: {
      backgroundColor: '#FF0000',
      borderWidth: 4,
      borderColor: '#FF3333',
    },
    disabledButton: {
      backgroundColor: theme.colors.gray[300],
      borderColor: theme.colors.gray[400],
    },
    pressedButton: {
      backgroundColor: '#CC0000',
    },
    countdownContainer: {
      position: 'absolute',
      top: -10,
      right: -10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.warning,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.white,
    },
    countdownText: {
      color: theme.colors.white,
      fontSize: 14,
      fontFamily: theme.fonts.BOLD,
    },
    emergencyText: {
      marginTop: theme.spacing.SM,
      textAlign: 'center',
      maxWidth: 200,
    },
    emergencyTitle: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.BOLD,
      color: '#FF0000',
      marginBottom: 4,
    },
    emergencySubtitle: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
    },
    instructionText: {
      marginTop: theme.spacing.SM,
      textAlign: 'center',
      maxWidth: 200,
    },
    instructionTitle: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: 4,
    },
    instructionSubtitle: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
    },
    cancelButton: {
      marginTop: theme.spacing.MD,
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.SM,
      backgroundColor: theme.colors.gray[600],
      borderRadius: theme.sizes.BUTTON_RADIUS,
    },
    cancelButtonText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
  });

  if (isEmergencyActive) {
    return (
      <Animated.View style={[styles.container, style, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={[styles.button, styles.emergencyButton]}
          onPress={cancelEmergency}
          activeOpacity={0.8}
        >
          <Ionicons name="warning" size={iconSize} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.emergencyText}>
          <Text style={styles.emergencyTitle}>URGENCE ACTIVE</Text>
          <Text style={styles.emergencySubtitle}>Appuyez pour annuler</Text>
        </View>
        
        <TouchableOpacity style={styles.cancelButton} onPress={cancelEmergency}>
          <Text style={styles.cancelButtonText}>Annuler l'urgence</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, style, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[
          styles.button,
          styles.normalButton,
          disabled && styles.disabledButton,
          isPressed && styles.pressedButton,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        <Ionicons 
          name="warning" 
          size={iconSize} 
          color={disabled ? theme.colors.gray[500] : "#FFFFFF"} 
        />
        
        {isTriggering && countdown > 0 && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}
      </TouchableOpacity>
      
      {!disabled && (
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>URGENCE</Text>
          <Text style={styles.instructionSubtitle}>
            Maintenez appuyé 3 sec
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

export default SOSButton;