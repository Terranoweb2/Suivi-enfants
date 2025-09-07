import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Chargement...',
  showLogo = true,
}) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.XL,
    },
    logoContainer: {
      marginBottom: theme.spacing.XXL,
      alignItems: 'center',
    },
    logo: {
      width: 120,
      height: 120,
      marginBottom: theme.spacing.MD,
    },
    appName: {
      fontSize: theme.fontSizes.HEADING_LG,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.primary,
      textAlign: 'center',
    },
    tagline: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.XS,
    },
    loadingContainer: {
      alignItems: 'center',
    },
    spinner: {
      marginBottom: theme.spacing.MD,
    },
    message: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      {showLogo && (
        <View style={styles.logoContainer}>
          {/* Placeholder pour le logo - à remplacer par l'image réelle */}
          <View style={[styles.logo, {
            backgroundColor: theme.colors.primary,
            borderRadius: 60,
            justifyContent: 'center',
            alignItems: 'center',
          }]}>
            <Text style={{
              fontSize: 48,
              color: theme.colors.white,
            }}>
              📡
            </Text>
          </View>
          <Text style={styles.appName}>TerranoKidsFind</Text>
          <Text style={styles.tagline}>
            Protégez et suivez vos enfants
          </Text>
        </View>
      )}
      
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={styles.spinner}
        />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
};

export default LoadingScreen;