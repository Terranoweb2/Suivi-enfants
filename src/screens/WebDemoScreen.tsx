import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContextWeb';
import { useLocation } from '../contexts/LocationContextWeb';
import { useNotifications } from '../contexts/NotificationContextWeb';

const WebDemoScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const { currentLocation, safeZones = [], startTracking, stopTracking, isTracking } = useLocation();
  const { notifications = [], unreadCount, sendNotification } = useNotifications();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 20,
    },
    header: {
      marginBottom: 30,
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    section: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 15,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    label: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    value: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '600',
    },
    button: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: theme.colors.secondary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.colors.success,
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    warningText: {
      color: theme.colors.warning,
      fontSize: 14,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 20,
      padding: 15,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
    },
  });

  const handleTestNotification = () => {
    sendNotification(
      'Test de Notification',
      'Ceci est une notification de test pour la version web de TerranoKidsFind.',
      'location_update'
    );
  };

  const handleToggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>TerranoKidsFind</Text>
        <Text style={styles.subtitle}>Version Web - Démonstration</Text>
      </View>

      {/* Informations utilisateur */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Profil Utilisateur</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Nom:</Text>
          <Text style={styles.value}>{user?.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{user?.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Rôle:</Text>
          <Text style={styles.value}>{user?.role === 'parent' ? 'Parent' : 'Enfant'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Statut:</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {user?.isPremium ? 'Premium' : 'Gratuit'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={logout}>
          <Text style={styles.secondaryButtonText}>Se Déconnecter</Text>
        </TouchableOpacity>
      </View>

      {/* Localisation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Localisation</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Latitude:</Text>
          <Text style={styles.value}>{currentLocation?.latitude.toFixed(4)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Longitude:</Text>
          <Text style={styles.value}>{currentLocation?.longitude.toFixed(4)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Adresse:</Text>
          <Text style={styles.value}>{currentLocation?.address}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Suivi:</Text>
          <View style={[styles.statusBadge, { backgroundColor: isTracking ? theme.colors.success : theme.colors.error }]}>
            <Text style={styles.statusText}>
              {isTracking ? 'Actif' : 'Inactif'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleToggleTracking}>
          <Text style={styles.buttonText}>
            {isTracking ? 'Arrêter le Suivi' : 'Démarrer le Suivi'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Zones de sécurité */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🛡️ Zones de Sécurité</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Zones configurées:</Text>
          <Text style={styles.value}>{safeZones?.length || 0}</Text>
        </View>
        {safeZones?.map((zone, index) => (
          <View key={zone.id} style={styles.infoRow}>
            <Text style={styles.label}>{zone.name}:</Text>
            <Text style={styles.value}>{zone.radius}m</Text>
          </View>
        )) || null}
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Non lues:</Text>
          <Text style={styles.value}>{unreadCount}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Total:</Text>
          <Text style={styles.value}>{notifications?.length || 0}</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleTestNotification}>
          <Text style={styles.buttonText}>Tester une Notification</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.warningText}>
        ⚠️ Cette version web est une démonstration. Les fonctionnalités complètes 
        (GPS, notifications push, biométrie) sont disponibles uniquement sur mobile.
      </Text>
    </ScrollView>
  );
};

export default WebDemoScreen;
