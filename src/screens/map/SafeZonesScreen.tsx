import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { geofencingService } from '../../services/geofencingService';
import { SafeZone, Child } from '../../types';
import { formatDistance, formatDate } from '../../utils';
import Button from '../../components/Button';
import Input from '../../components/Input';

interface SafeZonesScreenProps {
  navigation: any;
}

const SafeZonesScreen: React.FC<SafeZonesScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingZone, setEditingZone] = useState<SafeZone | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius: '200',
    entryNotification: true,
    exitNotification: true,
    color: '#32CD32',
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadSafeZones(),
      loadChildren(),
    ]);
  };

  const loadSafeZones = async () => {
    try {
      const zones = await geofencingService.getSafeZones();
      setSafeZones(zones);
    } catch (error) {
      console.error('Error loading safe zones:', error);
    }
  };

  const loadChildren = async () => {
    try {
      // Mock data - in real app, fetch from user context or API
      const mockChildren: Child[] = [
        {
          id: '1',
          name: 'Emma Martin',
          email: 'emma@example.com',
          phone: '+33612345678',
          role: 'child',
          profileImage: '',
          isPremium: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          parentId: user?.id || '',
          deviceId: 'device_1',
          batteryLevel: 85,
          isOnline: true,
          emergencyContacts: [],
          allowedContacts: [],
          blockedNumbers: [],
          screenTimeSettings: {
            dailyLimit: 120,
            bedtime: '21:00',
            wakeupTime: '07:00',
            blockedApps: [],
            allowedApps: [],
            parentalControlEnabled: true,
          },
          safeZones: [],
        },
      ];
      
      setChildren(mockChildren);
      if (mockChildren.length > 0 && !selectedChild) {
        setSelectedChild(mockChildren[0].id);
      }
    } catch (error) {
      console.error('Error loading children:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleCreateZone = () => {
    resetForm();
    setEditingZone(null);
    setShowCreateModal(true);
  };

  const handleEditZone = (zone: SafeZone) => {
    setFormData({
      name: zone.name,
      latitude: zone.latitude.toString(),
      longitude: zone.longitude.toString(),
      radius: zone.radius.toString(),
      entryNotification: zone.entryNotification,
      exitNotification: zone.exitNotification,
      color: zone.color,
    });
    setEditingZone(zone);
    setShowCreateModal(true);
  };

  const handleDeleteZone = (zone: SafeZone) => {
    Alert.alert(
      'Supprimer la zone',
      `Êtes-vous sûr de vouloir supprimer la zone "${zone.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: () => deleteZone(zone.id)
        },
      ]
    );
  };

  const deleteZone = async (zoneId: string) => {
    try {
      const success = await geofencingService.deleteSafeZone(zoneId);
      if (success) {
        await loadSafeZones();
        Alert.alert('Succès', 'Zone de sécurité supprimée');
      } else {
        Alert.alert('Erreur', 'Impossible de supprimer la zone');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const toggleZoneStatus = async (zone: SafeZone) => {
    try {
      const updatedZone = { ...zone, isActive: !zone.isActive };
      const success = await geofencingService.updateSafeZone(updatedZone);
      
      if (success) {
        await loadSafeZones();
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le statut de la zone');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    }
  };

  const validateForm = (): boolean => {
    const errors: any = {};

    if (!formData.name.trim()) {
      errors.name = 'Le nom est requis';
    }

    const lat = parseFloat(formData.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = 'Latitude invalide (-90 à 90)';
    }

    const lon = parseFloat(formData.longitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      errors.longitude = 'Longitude invalide (-180 à 180)';
    }

    const radius = parseInt(formData.radius);
    if (isNaN(radius) || radius < 50 || radius > 2000) {
      errors.radius = 'Rayon invalide (50m à 2km)';
    }

    if (!selectedChild) {
      errors.child = 'Sélectionnez un enfant';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const zoneData = {
        name: formData.name.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius: parseInt(formData.radius),
        childId: selectedChild,
        isActive: true,
        entryNotification: formData.entryNotification,
        exitNotification: formData.exitNotification,
        color: formData.color,
      };

      let success = false;
      if (editingZone) {
        success = await geofencingService.updateSafeZone({
          ...editingZone,
          ...zoneData,
        });
      } else {
        const result = await geofencingService.createSafeZone(zoneData);
        success = result !== null;
      }

      if (success) {
        setShowCreateModal(false);
        await loadSafeZones();
        Alert.alert('Succès', editingZone ? 'Zone mise à jour' : 'Zone créée');
      } else {
        Alert.alert('Erreur', 'Impossible de sauvegarder la zone');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      latitude: '',
      longitude: '',
      radius: '200',
      entryNotification: true,
      exitNotification: true,
      color: '#32CD32',
    });
    setFormErrors({});
  };

  const getZoneStatusColor = (zone: SafeZone): string => {
    return zone.isActive ? theme.colors.success : theme.colors.gray[400];
  };

  const getZoneIcon = (zone: SafeZone): keyof typeof Ionicons.glyphMap => {
    return zone.isActive ? 'shield-checkmark' : 'shield-outline';
  };

  const filteredZones = selectedChild 
    ? safeZones.filter(zone => zone.childId === selectedChild)
    : safeZones;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.MD,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: theme.fontSizes.HEADING_MD,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
    },
    addButton: {
      backgroundColor: theme.colors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
      padding: theme.spacing.LG,
    },
    childSelector: {
      marginBottom: theme.spacing.LG,
    },
    selectorLabel: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
    },
    childButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    childButton: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      marginRight: theme.spacing.SM,
      marginBottom: theme.spacing.SM,
      backgroundColor: theme.colors.gray[100],
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    childButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    childButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.text,
    },
    childButtonTextActive: {
      color: theme.colors.white,
    },
    zoneCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.MD,
      elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    },
    zoneHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.MD,
    },
    zoneInfo: {
      flex: 1,
    },
    zoneName: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.XS,
    },
    zoneDescription: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
    },
    zoneActions: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
    },
    actionButton: {
      width: 35,
      height: 35,
      borderRadius: 17.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    zoneDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.MD,
    },
    detail: {
      alignItems: 'center',
      flex: 1,
    },
    detailValue: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.primary,
    },
    detailLabel: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.XS,
    },
    notificationSettings: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: theme.spacing.LG,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    notificationText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.XS,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing.XXL,
    },
    emptyIcon: {
      marginBottom: theme.spacing.LG,
    },
    emptyTitle: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: theme.spacing.LG,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      margin: theme.spacing.LG,
      maxWidth: 400,
      width: '100%',
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.LG,
    },
    modalTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
    },
    closeButton: {
      padding: theme.spacing.SM,
    },
    formSection: {
      marginBottom: theme.spacing.LG,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.SM,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      marginRight: theme.spacing.SM,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    checkboxUnchecked: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    checkboxText: {
      color: theme.colors.white,
      fontSize: 12,
    },
    checkboxLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.text,
      flex: 1,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.MD,
    },
    modalButton: {
      flex: 1,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Zones de sécurité</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreateZone}>
          <Ionicons name="add" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Child Selector */}
        <View style={styles.childSelector}>
          <Text style={styles.selectorLabel}>Sélectionner un enfant :</Text>
          <View style={styles.childButtons}>
            {children.map(child => (
              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childButton,
                  selectedChild === child.id && styles.childButtonActive,
                ]}
                onPress={() => setSelectedChild(child.id)}
              >
                <Text style={[
                  styles.childButtonText,
                  selectedChild === child.id && styles.childButtonTextActive,
                ]}>
                  {child.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Safe Zones List */}
        {filteredZones.length > 0 ? (
          filteredZones.map(zone => (
            <View key={zone.id} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <View style={styles.zoneInfo}>
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <Text style={styles.zoneDescription}>
                    Créée le {formatDate(zone.createdAt)}
                  </Text>
                </View>
                <View style={styles.zoneActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: getZoneStatusColor(zone) + '20' }]}
                    onPress={() => toggleZoneStatus(zone)}
                  >
                    <Ionicons
                      name={getZoneIcon(zone)}
                      size={18}
                      color={getZoneStatusColor(zone)}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary + '20' }]}
                    onPress={() => handleEditZone(zone)}
                  >
                    <Ionicons name="create" size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.error + '20' }]}
                    onPress={() => handleDeleteZone(zone)}
                  >
                    <Ionicons name="trash" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.zoneDetails}>
                <View style={styles.detail}>
                  <Text style={styles.detailValue}>{formatDistance(zone.radius)}</Text>
                  <Text style={styles.detailLabel}>Rayon</Text>
                </View>
                <View style={styles.detail}>
                  <Text style={styles.detailValue}>{zone.latitude.toFixed(4)}</Text>
                  <Text style={styles.detailLabel}>Latitude</Text>
                </View>
                <View style={styles.detail}>
                  <Text style={styles.detailValue}>{zone.longitude.toFixed(4)}</Text>
                  <Text style={styles.detailLabel}>Longitude</Text>
                </View>
              </View>

              <View style={styles.notificationSettings}>
                <View style={styles.notificationItem}>
                  <Ionicons
                    name={zone.entryNotification ? 'notifications' : 'notifications-off'}
                    size={16}
                    color={zone.entryNotification ? theme.colors.success : theme.colors.gray[400]}
                  />
                  <Text style={styles.notificationText}>Entrée</Text>
                </View>
                <View style={styles.notificationItem}>
                  <Ionicons
                    name={zone.exitNotification ? 'notifications' : 'notifications-off'}
                    size={16}
                    color={zone.exitNotification ? theme.colors.warning : theme.colors.gray[400]}
                  />
                  <Text style={styles.notificationText}>Sortie</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="business-outline"
              size={64}
              color={theme.colors.gray[300]}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>Aucune zone de sécurité</Text>
            <Text style={styles.emptyDescription}>
              Créez votre première zone de sécurité pour être alerté lorsque votre enfant arrive ou quitte un endroit important.
            </Text>
            <Button
              title="Créer une zone"
              onPress={handleCreateZone}
              icon="add"
            />
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Input
                label="Nom de la zone"
                placeholder="Ex: Maison, École..."
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                error={formErrors.name}
              />

              <Input
                label="Latitude"
                placeholder="48.8566"
                value={formData.latitude}
                onChangeText={(text) => setFormData(prev => ({ ...prev, latitude: text }))}
                error={formErrors.latitude}
                keyboardType="numeric"
              />

              <Input
                label="Longitude"
                placeholder="2.3522"
                value={formData.longitude}
                onChangeText={(text) => setFormData(prev => ({ ...prev, longitude: text }))}
                error={formErrors.longitude}
                keyboardType="numeric"
              />

              <Input
                label="Rayon (mètres)"
                placeholder="200"
                value={formData.radius}
                onChangeText={(text) => setFormData(prev => ({ ...prev, radius: text }))}
                error={formErrors.radius}
                keyboardType="numeric"
              />

              <View style={styles.formSection}>
                <Text style={styles.selectorLabel}>Notifications :</Text>
                
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setFormData(prev => ({ ...prev, entryNotification: !prev.entryNotification }))}
                >
                  <View style={[
                    styles.checkbox,
                    formData.entryNotification ? styles.checkboxChecked : styles.checkboxUnchecked
                  ]}>
                    {formData.entryNotification && (
                      <Text style={styles.checkboxText}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Alerte d'entrée dans la zone</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setFormData(prev => ({ ...prev, exitNotification: !prev.exitNotification }))}
                >
                  <View style={[
                    styles.checkbox,
                    formData.exitNotification ? styles.checkboxChecked : styles.checkboxUnchecked
                  ]}>
                    {formData.exitNotification && (
                      <Text style={styles.checkboxText}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Alerte de sortie de la zone</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Annuler"
                onPress={() => setShowCreateModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title={editingZone ? 'Modifier' : 'Créer'}
                onPress={handleSubmit}
                loading={isSubmitting}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SafeZonesScreen;