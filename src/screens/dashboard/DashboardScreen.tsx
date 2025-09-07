import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { gpsTrackingService } from '../../services/gpsTrackingService';
import { sosService } from '../../services/sosService';
import { remoteSoundService, SoundTriggerRequest } from '../../services/remoteSoundService';
import { Child, Location, TrackingSession, SOSAlert } from '../../types';
import { formatTime, formatDistance, getTimeAgo, getBatteryColor } from '../../utils';
import SOSButton from '../../components/SOSButton';
import RemoteSoundControl from '../../components/RemoteSoundControl';
import BatteryStatus from '../../components/BatteryStatus';
import EnvironmentListeningControl from '../../components/EnvironmentListeningControl';
import ContactManagement from '../../components/ContactManagement';
import { callFilteringService } from '../../services/callFilteringService';

const { width: screenWidth } = Dimensions.get('window');

interface ChildStatus {
  child: Child;
  location: Location | null;
  battery: number;
  isOnline: boolean;
  lastSeen: Date;
  isInSafeZone: boolean;
}

interface DashboardScreenProps {
  navigation: any;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { currentLocation, safeZones } = useLocation();
  const { unreadCount } = useNotifications();
  
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState<ChildStatus[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrackingSession | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);

  useEffect(() => {
    loadChildrenStatus();
    checkTrackingStatus();
    
    // Set up location listener
    const unsubscribe = gpsTrackingService.addLocationListener((location) => {
      updateLocationStatus(location);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const loadChildrenStatus = async () => {
    try {
      // Mock data for now - in real app, this would come from user context or API
      const mockChildren: ChildStatus[] = [
        {
          child: {
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
          location: currentLocation,
          battery: 85,
          isOnline: true,
          lastSeen: new Date(),
          isInSafeZone: true,
        },
      ];
      
      setChildren(mockChildren);
    } catch (error) {
      console.error('Error loading children status:', error);
    }
  };

  const checkTrackingStatus = () => {
    const tracking = gpsTrackingService.isActivelyTracking();
    const session = gpsTrackingService.getCurrentSession();
    
    setIsTracking(tracking);
    setCurrentSession(session);
    
    if (session) {
      setTotalDistance(session.totalDistance);
    }
  };

  const updateLocationStatus = (location: Location) => {
    setChildren(prev => prev.map(child => ({
      ...child,
      location: child.child.id === location.childId ? location : child.location,
      lastSeen: child.child.id === location.childId ? new Date() : child.lastSeen,
    })));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadChildrenStatus();
      checkTrackingStatus();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleStartTracking = async (childId: string) => {
    try {
      const success = await gpsTrackingService.startTracking({ childId });
      if (success) {
        setIsTracking(true);
        Alert.alert('Suivi activé', 'Le suivi GPS a été activé avec succès');
      } else {
        Alert.alert('Erreur', 'Impossible d\'activer le suivi GPS');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite lors de l\'activation du suivi');
    }
  };

  const handleStopTracking = async () => {
    try {
      await gpsTrackingService.stopTracking();
      setIsTracking(false);
      setCurrentSession(null);
      Alert.alert('Suivi arrêté', 'Le suivi GPS a été arrêté');
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite lors de l\'arrêt du suivi');
    }
  };

  const handleEmergencyAlert = (child: Child) => {
    Alert.alert(
      'Alerte d\'urgence',
      `Envoyer une alerte SOS pour ${child.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Envoyer', 
          style: 'destructive',
          onPress: () => sendSOSAlert(child)
        },
      ]
    );
  };

  const sendSOSAlert = async (child: Child) => {
    try {
      const alert = await sosService.triggerSOSAlert(child.id, undefined);
      if (alert) {
        Alert.alert('Alerte envoyée', `Alerte SOS envoyée pour ${child.name}`);
      } else {
        Alert.alert('Erreur', 'Impossible d\'envoyer l\'alerte');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'alerte');
    }
  };

  const handleSOSTriggered = (alert: SOSAlert) => {
    console.log('SOS Alert triggered:', alert);
    // Refresh the dashboard to show emergency status
    onRefresh();
  };

  const handleSOSCancelled = () => {
    console.log('SOS Alert cancelled');
    // Refresh the dashboard
    onRefresh();
  };

  const handleRemoteSoundTriggered = (request: SoundTriggerRequest) => {
    console.log('Remote sound triggered:', request);
    // Show confirmation or update UI
  };

  const getLocationStatusIcon = (child: ChildStatus) => {
    if (!child.isOnline) return 'cloud-offline';
    if (!child.location) return 'location-outline';
    if (child.isInSafeZone) return 'shield-checkmark';
    return 'location';
  };

  const getLocationStatusColor = (child: ChildStatus) => {
    if (!child.isOnline) return theme.colors.gray[400];
    if (!child.location) return theme.colors.warning;
    if (child.isInSafeZone) return theme.colors.success;
    return theme.colors.primary;
  };

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
      elevation: 2,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    headerTitle: {
      fontSize: theme.fontSizes.HEADING_MD,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
    },
    notificationBadge: {
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: theme.colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.BOLD,
    },
    scrollContainer: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.LG,
    },
    section: {
      marginBottom: theme.spacing.LG,
    },
    sectionTitle: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.MD,
    },
    trackingCard: {
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
    trackingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.MD,
    },
    trackingTitle: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
    },
    trackingButton: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      minWidth: 80,
      alignItems: 'center',
    },
    trackingButtonActive: {
      backgroundColor: theme.colors.error,
    },
    trackingButtonInactive: {
      backgroundColor: theme.colors.success,
    },
    trackingButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.white,
    },
    trackingStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: theme.fontSizes.XL,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.primary,
    },
    statLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.XS,
    },
    childCard: {
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
    childHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.MD,
    },
    childAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.MD,
    },
    childAvatarText: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.white,
    },
    childInfo: {
      flex: 1,
    },
    childName: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
    },
    childStatus: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
    },
    childActions: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    childDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    },
    detail: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.SM,
      minWidth: '45%',
    },
    detailIcon: {
      marginRight: theme.spacing.SM,
    },
    detailText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
    },
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    quickAction: {
      alignItems: 'center',
      padding: theme.spacing.SM,
    },
    quickActionIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.SM,
    },
    quickActionText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    sosCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.XL,
      alignItems: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    sosContent: {
      alignItems: 'center',
      maxWidth: 300,
    },
    sosButton: {
      marginBottom: theme.spacing.LG,
    },
    sosDescription: {
      alignItems: 'center',
    },
    sosTitle: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.SM,
      textAlign: 'center',
    },
    sosSubtitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
      textAlign: 'center',
      lineHeight: 22,
    },
    soundCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    batteryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    viewDetailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.LG,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      marginTop: theme.spacing.MD,
      gap: theme.spacing.SM,
    },
    viewDetailsText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    listeningCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    premiumPrompt: {
      alignItems: 'center',
      padding: theme.spacing.XL,
    },
    premiumIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.warning + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.LG,
    },
    premiumTitle: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.BOLD,
      textAlign: 'center',
      marginBottom: theme.spacing.SM,
    },
    premiumDescription: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: theme.spacing.LG,
    },
    premiumButton: {
      paddingHorizontal: theme.spacing.XL,
      paddingVertical: theme.spacing.MD,
      borderRadius: theme.sizes.BUTTON_RADIUS,
    },
    premiumButtonText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.BOLD,
    },
    usageCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    contactCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    contactManagement: {
      marginBottom: theme.spacing.MD,
    },
    noChildrenContainer: {
      alignItems: 'center',
      padding: theme.spacing.XL,
    },
    noChildrenText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.gray[600],
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tableau de bord</Text>
          <Text style={styles.headerSubtitle}>
            {children.length} enfant{children.length > 1 ? 's' : ''} surveillé{children.length > 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.notificationBadge}>
          <Ionicons name="notifications" size={24} color={theme.colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Tracking Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suivi GPS</Text>
          <View style={styles.trackingCard}>
            <View style={styles.trackingHeader}>
              <Text style={styles.trackingTitle}>
                {isTracking ? 'Suivi actif' : 'Suivi arrêté'}
              </Text>
              <TouchableOpacity
                style={[
                  styles.trackingButton,
                  isTracking ? styles.trackingButtonActive : styles.trackingButtonInactive,
                ]}
                onPress={isTracking ? handleStopTracking : () => handleStartTracking(children[0]?.child.id)}
              >
                <Text style={styles.trackingButtonText}>
                  {isTracking ? 'Arrêter' : 'Démarrer'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {isTracking && currentSession && (
              <View style={styles.trackingStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {formatTime(currentSession.startTime)}
                  </Text>
                  <Text style={styles.statLabel}>Début</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {formatDistance(totalDistance)}
                  </Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {currentSession.locations.length}
                  </Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* SOS Emergency Button */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerte d'urgence</Text>
          <View style={styles.sosCard}>
            <View style={styles.sosContent}>
              <SOSButton
                size="large"
                onSOSTriggered={handleSOSTriggered}
                onSOSCancelled={handleSOSCancelled}
                style={styles.sosButton}
              />
              <View style={styles.sosDescription}>
                <Text style={styles.sosTitle}>Bouton d'urgence</Text>
                <Text style={styles.sosSubtitle}>
                  En cas d'urgence, maintenez le bouton appuyé pendant 3 secondes.
                  Une alerte sera automatiquement envoyée à vos contacts d'urgence.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Remote Sound Control */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son à distance</Text>
          <View style={styles.soundCard}>
            {children.length > 0 && (
              <RemoteSoundControl
                childId={children[0].child.id}
                childName={children[0].child.name}
                onSoundTriggered={handleRemoteSoundTriggered}
                disabled={!children[0].isOnline}
              />
            )}
            {children.length === 0 && (
              <View style={styles.noChildrenContainer}>
                <Text style={styles.noChildrenText}>
                  Aucun enfant connecté pour déclencher un son
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Battery Monitoring */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Surveillance batterie</Text>
          <View style={styles.batteryCard}>
            {children.length > 0 ? (
              <>
                <BatteryStatus 
                  childId={children[0].child.id}
                  showDetails={true}
                  size="large"
                  onPress={() => navigation.navigate('BatteryMonitoring', { childId: children[0].child.id })}
                />
                <TouchableOpacity
                  style={[styles.viewDetailsButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => navigation.navigate('BatteryMonitoring', { childId: children[0].child.id })}
                >
                  <Text style={[styles.viewDetailsText, { color: theme.colors.white }]}>
                    Voir les détails
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.white} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.noChildrenContainer}>
                <Text style={styles.noChildrenText}>
                  Aucun enfant connecté pour surveiller la batterie
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Environment Listening (Premium) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Écoute environnement ⚨ PREMIUM</Text>
          <View style={styles.listeningCard}>
            {children.length > 0 && user?.isPremium ? (
              <EnvironmentListeningControl
                childId={children[0].child.id}
                childName={children[0].child.name}
                onSessionStarted={(session) => console.log('Listening session started:', session)}
                onSessionEnded={(session) => console.log('Listening session ended:', session)}
                disabled={!children[0].isOnline}
              />
            ) : (
              <View style={styles.premiumPrompt}>
                <View style={styles.premiumIcon}>
                  <Ionicons name="headset" size={32} color={theme.colors.warning} />
                </View>
                <Text style={[styles.premiumTitle, { color: theme.colors.text }]}>
                  Écoute de l'environnement
                </Text>
                <Text style={[styles.premiumDescription, { color: theme.colors.gray[600] }]}>
                  {!user?.isPremium 
                    ? 'Fonctionnalité premium permettant d’écouter l’environnement de votre enfant en cas d’urgence ou de situation suspecte.'
                    : 'Aucun enfant connecté pour activer l’écoute de l’environnement'
                  }
                </Text>
                {!user?.isPremium && (
                  <TouchableOpacity
                    style={[styles.premiumButton, { backgroundColor: theme.colors.warning }]}
                    onPress={() => navigation.navigate('Premium')}
                  >
                    <Text style={[styles.premiumButtonText, { color: theme.colors.white }]}>
                      Passer à Premium
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Usage Control */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contrôle d'usage</Text>
          <View style={styles.usageCard}>
            {children.length > 0 ? (
              <UsageControlDashboard
                childId={children[0].child.id}
                childName={children[0].child.name}
                onNavigateToDetails={() => navigation.navigate('UsageControl', { childId: children[0].child.id })}
              />
            ) : (
              <View style={styles.noChildrenContainer}>
                <Text style={styles.noChildrenText}>
                  Aucun enfant connecté pour contrôler l'usage
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Contact Management & Call Filtering */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestion des contacts</Text>
          <View style={styles.contactCard}>
            {children.length > 0 ? (
              <>
                <ContactManagement 
                  childId={children[0].child.id}
                  onNavigateToDetails={() => navigation.navigate('CallFiltering', { childId: children[0].child.id })}
                  style={styles.contactManagement}
                />
                <TouchableOpacity
                  style={[styles.viewDetailsButton, { backgroundColor: theme.colors.secondary }]}
                  onPress={() => navigation.navigate('CallFiltering', { childId: children[0].child.id })}
                >
                  <Text style={[styles.viewDetailsText, { color: theme.colors.white }]}>
                    Filtrage d'appels
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.white} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.noChildrenContainer}>
                <Text style={styles.noChildrenText}>
                  Aucun enfant connecté pour gérer les contacts
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Children Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes enfants</Text>
          {children.map((childStatus) => (
            <View key={childStatus.child.id} style={styles.childCard}>
              <View style={styles.childHeader}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarText}>
                    {childStatus.child.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{childStatus.child.name}</Text>
                  <Text style={styles.childStatus}>
                    {childStatus.isOnline ? 'En ligne' : 'Hors ligne'} • 
                    {childStatus.location ? ' Localisé' : ' Position inconnue'}
                  </Text>
                </View>
                <View style={styles.childActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary + '20' }]}
                    onPress={() => {/* Navigate to map */}}
                  >
                    <Ionicons
                      name="map"
                      size={20}
                      color={theme.colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.error + '20' }]}
                    onPress={() => handleEmergencyAlert(childStatus.child)}
                  >
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color={theme.colors.error}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.childDetails}>
                <View style={styles.detail}>
                  <Ionicons
                    name={getLocationStatusIcon(childStatus)}
                    size={16}
                    color={getLocationStatusColor(childStatus)}
                    style={styles.detailIcon}
                  />
                  <Text style={styles.detailText}>
                    {childStatus.isInSafeZone ? 'Zone sûre' : 'Hors zone'}
                  </Text>
                </View>
                <View style={styles.detail}>
                  <Ionicons
                    name="battery-half"
                    size={16}
                    color={getBatteryColor(childStatus.battery)}
                    style={styles.detailIcon}
                  />
                  <Text style={styles.detailText}>{childStatus.battery}%</Text>
                </View>
                <View style={styles.detail}>
                  <Ionicons
                    name="time"
                    size={16}
                    color={theme.colors.textSecondary}
                    style={styles.detailIcon}
                  />
                  <Text style={styles.detailText}>
                    {getTimeAgo(childStatus.lastSeen)}
                  </Text>
                </View>
                <View style={styles.detail}>
                  <Ionicons
                    name="shield-checkmark"
                    size={16}
                    color={theme.colors.success}
                    style={styles.detailIcon}
                  />
                  <Text style={styles.detailText}>
                    {safeZones.length} zones
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions rapides</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Ionicons name="map" size={24} color={theme.colors.primary} />
              </View>
              <Text style={styles.quickActionText}>Voir la carte</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickAction}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.secondary + '20' }]}>
                <Ionicons name="business" size={24} color={theme.colors.secondary} />
              </View>
              <Text style={styles.quickActionText}>Zones sûres</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickAction}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.warning + '20' }]}>
                <Ionicons name="chatbubbles" size={24} color={theme.colors.warning} />
              </View>
              <Text style={styles.quickActionText}>Messages</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickAction}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.error + '20' }]}>
                <Ionicons name="alert-circle" size={24} color={theme.colors.error} />
              </View>
              <Text style={styles.quickActionText}>Alertes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardScreen;