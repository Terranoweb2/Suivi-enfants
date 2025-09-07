import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { remoteSoundService, SoundTriggerRequest } from '../services/remoteSoundService';
import Button from './Button';
import Input from './Input';

interface RemoteSoundControlProps {
  childId: string;
  childName: string;
  onSoundTriggered?: (request: SoundTriggerRequest) => void;
  disabled?: boolean;
}

const SOUND_TYPES = [
  { id: 'alarm', name: 'Alarme', icon: 'alarm', color: '#FF4444' },
  { id: 'whistle', name: 'Sifflet', icon: 'musical-note', color: '#FF9800' },
  { id: 'siren', name: 'Sirène', icon: 'warning', color: '#F44336' },
  { id: 'bell', name: 'Sonnette', icon: 'notifications', color: '#2196F3' },
  { id: 'custom', name: 'Personnalisé', icon: 'volume-high', color: '#9C27B0' },
] as const;

const DURATION_PRESETS = [
  { value: 10, label: '10 sec' },
  { value: 30, label: '30 sec' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
];

const RemoteSoundControl: React.FC<RemoteSoundControlProps> = ({
  childId,
  childName,
  onSoundTriggered,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSoundType, setSelectedSoundType] = useState<typeof SOUND_TYPES[number]['id']>('alarm');
  const [volume, setVolume] = useState(80);
  const [duration, setDuration] = useState(30);
  const [customMessage, setCustomMessage] = useState('');
  const [includeMessage, setIncludeMessage] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const handleTriggerSound = () => {
    if (disabled) return;
    setModalVisible(true);
  };

  const handleConfirmTrigger = async () => {
    try {
      setIsTriggering(true);

      const request = await remoteSoundService.triggerRemoteSound(
        childId,
        selectedSoundType,
        duration,
        volume,
        includeMessage && customMessage ? customMessage : undefined
      );

      if (request) {
        setModalVisible(false);
        onSoundTriggered?.(request);
        
        Alert.alert(
          '🔊 Son déclenché',
          `Le son "${SOUND_TYPES.find(s => s.id === selectedSoundType)?.name}" a été envoyé à ${childName}.`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        Alert.alert(
          'Erreur',
          'Impossible de déclencher le son. Vérifiez que l\'appareil est connecté.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Une erreur s\'est produite lors du déclenchement du son.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsTriggering(false);
    }
  };

  const handleQuickTrigger = async (soundType: typeof SOUND_TYPES[number]['id']) => {
    try {
      const request = await remoteSoundService.triggerRemoteSound(
        childId,
        soundType,
        30, // Default 30 seconds
        80  // Default 80% volume
      );

      if (request) {
        onSoundTriggered?.(request);
        Alert.alert(
          '🔊 Son déclenché',
          `Le son "${SOUND_TYPES.find(s => s.id === soundType)?.name}" a été envoyé à ${childName}.`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de déclencher le son.');
    }
  };

  const getSelectedSound = () => {
    return SOUND_TYPES.find(s => s.id === selectedSoundType) || SOUND_TYPES[0];
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes} min`;
  };

  const styles = StyleSheet.create({
    container: {
      padding: theme.spacing.MD,
    },
    triggerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.MD,
      paddingHorizontal: theme.spacing.LG,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    disabledButton: {
      backgroundColor: theme.colors.gray[300],
    },
    triggerButtonText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      marginLeft: theme.spacing.SM,
    },
    quickActions: {
      marginTop: theme.spacing.MD,
    },
    quickActionsTitle: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
    },
    quickActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.SM,
    },
    quickActionButton: {
      flex: 1,
      alignItems: 'center',
      padding: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      borderColor: theme.colors.gray[300],
    },
    quickActionIcon: {
      marginBottom: 4,
    },
    quickActionText: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
      textAlign: 'center',
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.XL,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.LG,
    },
    section: {
      marginBottom: theme.spacing.LG,
    },
    sectionTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
    },
    soundTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.SM,
    },
    soundTypeButton: {
      flexBasis: '48%',
      alignItems: 'center',
      padding: theme.spacing.MD,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 2,
      borderColor: theme.colors.gray[300],
    },
    soundTypeButtonSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '10',
    },
    soundTypeIcon: {
      marginBottom: theme.spacing.SM,
    },
    soundTypeName: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
      textAlign: 'center',
    },
    sliderContainer: {
      marginVertical: theme.spacing.SM,
    },
    sliderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.SM,
    },
    sliderLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
    },
    sliderValue: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.primary,
      minWidth: 60,
      textAlign: 'right',
    },
    durationPresets: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.SM,
      marginTop: theme.spacing.SM,
    },
    durationPreset: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      borderWidth: 1,
      borderColor: theme.colors.gray[300],
    },
    durationPresetSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    durationPresetText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
    },
    durationPresetTextSelected: {
      color: theme.colors.white,
    },
    messageSection: {
      marginTop: theme.spacing.MD,
    },
    messageToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.SM,
    },
    messageToggleText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
      marginLeft: theme.spacing.SM,
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

  return (
    <View style={styles.container}>
      {/* Main Trigger Button */}
      <TouchableOpacity
        style={[styles.triggerButton, disabled && styles.disabledButton]}
        onPress={handleTriggerSound}
        disabled={disabled}
      >
        <Ionicons name="volume-high" size={24} color={theme.colors.white} />
        <Text style={styles.triggerButtonText}>Déclencher un son</Text>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.quickActionsTitle}>Actions rapides</Text>
        <View style={styles.quickActionsRow}>
          {SOUND_TYPES.slice(0, 3).map((soundType) => (
            <TouchableOpacity
              key={soundType.id}
              style={styles.quickActionButton}
              onPress={() => handleQuickTrigger(soundType.id)}
              disabled={disabled}
            >
              <Ionicons
                name={soundType.icon as any}
                size={20}
                color={soundType.color}
                style={styles.quickActionIcon}
              />
              <Text style={styles.quickActionText}>{soundType.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Configuration Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Déclencher un son sur l'appareil de {childName}</Text>

            {/* Sound Type Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Type de son</Text>
              <View style={styles.soundTypeGrid}>
                {SOUND_TYPES.map((soundType) => (
                  <TouchableOpacity
                    key={soundType.id}
                    style={[
                      styles.soundTypeButton,
                      selectedSoundType === soundType.id && styles.soundTypeButtonSelected,
                    ]}
                    onPress={() => setSelectedSoundType(soundType.id)}
                  >
                    <Ionicons
                      name={soundType.icon as any}
                      size={24}
                      color={selectedSoundType === soundType.id ? theme.colors.primary : soundType.color}
                      style={styles.soundTypeIcon}
                    />
                    <Text style={styles.soundTypeName}>{soundType.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Volume Control */}
            <View style={styles.section}>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Volume</Text>
                <Text style={styles.sliderValue}>{volume}%</Text>
              </View>
              <Slider
                style={styles.sliderContainer}
                minimumValue={20}
                maximumValue={100}
                value={volume}
                onValueChange={setVolume}
                step={10}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.gray[300]}
                thumbStyle={{ backgroundColor: theme.colors.primary }}
              />
            </View>

            {/* Duration Control */}
            <View style={styles.section}>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Durée</Text>
                <Text style={styles.sliderValue}>{formatDuration(duration)}</Text>
              </View>
              <Slider
                style={styles.sliderContainer}
                minimumValue={5}
                maximumValue={300}
                value={duration}
                onValueChange={setDuration}
                step={5}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.gray[300]}
                thumbStyle={{ backgroundColor: theme.colors.primary }}
              />
              <View style={styles.durationPresets}>
                {DURATION_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.value}
                    style={[
                      styles.durationPreset,
                      duration === preset.value && styles.durationPresetSelected,
                    ]}
                    onPress={() => setDuration(preset.value)}
                  >
                    <Text style={[
                      styles.durationPresetText,
                      duration === preset.value && styles.durationPresetTextSelected,
                    ]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Optional Message */}
            <View style={styles.messageSection}>
              <View style={styles.messageToggle}>
                <Switch
                  value={includeMessage}
                  onValueChange={setIncludeMessage}
                  trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
                  thumbColor={theme.colors.white}
                />
                <Text style={styles.messageToggleText}>Ajouter un message</Text>
              </View>
              {includeMessage && (
                <Input
                  placeholder="Message optionnel pour l'enfant..."
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  numberOfLines={2}
                />
              )}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
              />
              <Button
                title="Déclencher"
                onPress={handleConfirmTrigger}
                loading={isTriggering}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default RemoteSoundControl;