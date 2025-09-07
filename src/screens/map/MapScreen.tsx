import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { 
  Marker, 
  Circle, 
  Polyline, 
  PROVIDER_GOOGLE,
  Region,
  LatLng,
} from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocation } from '../../contexts/LocationContext';
import { useAuth } from '../../contexts/AuthContext';
import { gpsTrackingService } from '../../services/gpsTrackingService';
import { Location, SafeZone, Child } from '../../types';
import { formatTime, formatDistance, calculateDistance } from '../../utils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MapScreenProps {
  navigation: any;
}

const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { currentLocation, safeZones } = useLocation();
  
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 48.8566,
    longitude: 2.3522,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [followMode, setFollowMode] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(true);

  useEffect(() => {
    loadChildren();
    setupLocationListener();
    if (currentLocation) {
      centerMapOnLocation(currentLocation);
    }
  }, []);

  useEffect(() => {
    if (selectedChild && showHistory) {
      loadLocationHistory(selectedChild);
    }
  }, [selectedChild, showHistory]);

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
          lastLocation: currentLocation,
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
      if (mockChildren.length > 0) {
        setSelectedChild(mockChildren[0].id);
      }
    } catch (error) {
      console.error('Error loading children:', error);
    }
  };

  const setupLocationListener = () => {
    const unsubscribe = gpsTrackingService.addLocationListener((location) => {
      if (followMode && selectedChild === location.childId) {
        centerMapOnLocation(location);
      }
    });

    return unsubscribe;
  };

  const loadLocationHistory = async (childId: string) => {
    try {
      const history = await gpsTrackingService.getLocationHistory(childId, 1); // Last 1 day
      setLocationHistory(history);
    } catch (error) {
      console.error('Error loading location history:', error);
      setLocationHistory([]);
    }
  };

  const centerMapOnLocation = (location: Location) => {
    const newRegion: Region = {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }
    setRegion(newRegion);
  };

  const centerMapOnChild = (childId: string) => {
    const child = children.find(c => c.id === childId);
    if (child?.lastLocation) {
      centerMapOnLocation(child.lastLocation);
      setSelectedChild(childId);
    }
  };

  const toggleFollowMode = () => {
    setFollowMode(!followMode);
    if (!followMode && selectedChild) {
      const child = children.find(c => c.id === selectedChild);
      if (child?.lastLocation) {
        centerMapOnLocation(child.lastLocation);
      }
    }
  };

  const toggleMapType = () => {
    const types: Array<'standard' | 'satellite' | 'hybrid'> = ['standard', 'satellite', 'hybrid'];
    const currentIndex = types.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % types.length;
    setMapType(types[nextIndex]);
  };

  const getCurrentLocationFromDevice = async () => {
    try {
      const location = await gpsTrackingService.getCurrentLocation();
      if (location) {
        centerMapOnLocation(location);
      } else {
        Alert.alert('Erreur', 'Impossible d\'obtenir la localisation actuelle');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors de la localisation');
    }
  };

  const getChildMarkerColor = (child: Child): string => {
    if (!child.isOnline) return '#757575';
    if (child.batteryLevel < 15) return '#F44336';
    return theme.colors.primary;
  };

  const isChildInSafeZone = (child: Child): boolean => {
    if (!child.lastLocation) return false;
    
    return safeZones.some(zone => {
      if (!zone.isActive || zone.childId !== child.id) return false;
      
      const distance = calculateDistance(
        child.lastLocation!.latitude,
        child.lastLocation!.longitude,
        zone.latitude,
        zone.longitude
      );
      
      return distance <= zone.radius;
    });
  };

  const renderMarkers = () => {
    return children.map(child => {
      if (!child.lastLocation) return null;
      
      const isSelected = selectedChild === child.id;
      const isInSafeZone = isChildInSafeZone(child);
      
      return (
        <Marker
          key={child.id}
          coordinate={{
            latitude: child.lastLocation.latitude,
            longitude: child.lastLocation.longitude,
          }}
          title={child.name}
          description={`Batterie: ${child.batteryLevel}% • ${child.isOnline ? 'En ligne' : 'Hors ligne'}`}
          pinColor={getChildMarkerColor(child)}
          onPress={() => setSelectedChild(child.id)}
        >
          <View style={[
            styles.customMarker,
            { 
              backgroundColor: getChildMarkerColor(child),
              borderWidth: isSelected ? 3 : 1,
              borderColor: isSelected ? theme.colors.white : theme.colors.gray[300],
            }
          ]}>
            <Text style={styles.markerText}>
              {child.name.charAt(0)}
            </Text>
            {isInSafeZone && (
              <View style={styles.safeZoneIndicator}>
                <Ionicons name="shield-checkmark" size={12} color={theme.colors.success} />
              </View>
            )}
          </View>
        </Marker>
      );
    });
  };

  const renderSafeZones = () => {
    if (!showSafeZones) return null;
    
    return safeZones.map(zone => (
      <Circle
        key={zone.id}
        center={{
          latitude: zone.latitude,
          longitude: zone.longitude,
        }}
        radius={zone.radius}
        fillColor={`${zone.color}20`}
        strokeColor={zone.color}
        strokeWidth={2}
      />
    ));
  };

  const renderLocationHistory = () => {
    if (!showHistory || locationHistory.length < 2) return null;
    
    const coordinates: LatLng[] = locationHistory.map(location => ({
      latitude: location.latitude,
      longitude: location.longitude,
    }));
    
    return (
      <Polyline
        coordinates={coordinates}
        strokeColor={theme.colors.primary}
        strokeWidth={3}
        strokePattern={[5, 5]}
      />
    );
  };

  const selectedChildData = children.find(c => c.id === selectedChild);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    map: {
      flex: 1,
    },
    controlsContainer: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 30,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.LG,
    },
    controlButton: {
      backgroundColor: theme.colors.surface,
      width: 45,
      height: 45,
      borderRadius: 22.5,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadows?.MD,
    },
    controlButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    rightControls: {
      alignItems: 'flex-end',
      gap: theme.spacing.SM,
    },
    bottomPanel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.sizes.BORDER_RADIUS_LG,
      borderTopRightRadius: theme.sizes.BORDER_RADIUS_LG,
      padding: theme.spacing.LG,
      ...theme.shadows?.LG,
    },
    panelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.MD,
    },
    panelTitle: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
    },
    toggleButton: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      backgroundColor: theme.colors.primary + '20',
    },
    toggleButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    toggleButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.primary,
    },
    toggleButtonTextActive: {
      color: theme.colors.white,
    },
    childSelector: {
      flexDirection: 'row',
      marginBottom: theme.spacing.MD,
    },
    childButton: {
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      marginRight: theme.spacing.SM,
      backgroundColor: theme.colors.gray[100],
    },
    childButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    childButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.text,
    },
    childButtonTextActive: {
      color: theme.colors.white,
    },
    infoGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.MD,
    },
    infoItem: {
      alignItems: 'center',
      flex: 1,
    },
    infoValue: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.primary,
    },
    infoLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.XS,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.MD,
      paddingVertical: theme.spacing.SM,
      borderRadius: theme.sizes.BUTTON_RADIUS,
      backgroundColor: theme.colors.primary + '20',
    },
    actionButtonText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.primary,
      marginLeft: theme.spacing.XS,
    },
    customMarker: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    markerText: {
      color: theme.colors.white,
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.BOLD,
    },
    safeZoneIndicator: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: theme.colors.white,
      borderRadius: 8,
      width: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={true}
        rotateEnabled={true}
        pitchEnabled={true}
      >
        {renderMarkers()}
        {renderSafeZones()}
        {renderLocationHistory()}
      </MapView>

      {/* Map Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.rightControls}>
          <TouchableOpacity
            style={[styles.controlButton, followMode && styles.controlButtonActive]}
            onPress={toggleFollowMode}
          >
            <Ionicons 
              name="locate" 
              size={24} 
              color={followMode ? theme.colors.white : theme.colors.text} 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleMapType}
          >
            <Ionicons name="layers" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={getCurrentLocationFromDevice}
          >
            <Ionicons name="compass" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Info Panel */}
      <View style={styles.bottomPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Localisation en temps réel</Text>
          <TouchableOpacity
            style={[styles.toggleButton, showHistory && styles.toggleButtonActive]}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Text style={[
              styles.toggleButtonText, 
              showHistory && styles.toggleButtonTextActive
            ]}>
              Historique
            </Text>
          </TouchableOpacity>
        </View>

        {/* Child Selector */}
        <View style={styles.childSelector}>
          {children.map(child => (
            <TouchableOpacity
              key={child.id}
              style={[
                styles.childButton,
                selectedChild === child.id && styles.childButtonActive,
              ]}
              onPress={() => centerMapOnChild(child.id)}
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

        {/* Info Grid */}
        {selectedChildData && (
          <>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoValue}>
                  {selectedChildData.batteryLevel}%
                </Text>
                <Text style={styles.infoLabel}>Batterie</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoValue}>
                  {selectedChildData.isOnline ? 'En ligne' : 'Hors ligne'}
                </Text>
                <Text style={styles.infoLabel}>Statut</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoValue}>
                  {safeZones.filter(z => z.childId === selectedChildData.id).length}
                </Text>
                <Text style={styles.infoLabel}>Zones sûres</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoValue}>
                  {locationHistory.length}
                </Text>
                <Text style={styles.infoLabel}>Points</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="call" size={18} color={theme.colors.primary} />
                <Text style={styles.actionButtonText}>Appeler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubbles" size={18} color={theme.colors.primary} />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="alert-circle" size={18} color={theme.colors.primary} />
                <Text style={styles.actionButtonText}>Alerte</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

export default MapScreen;