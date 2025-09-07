import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import Button from '../components/Button';

const PremiumScreen: React.FC = () => {
  const { theme } = useTheme();

  const premiumFeatures = [
    {
      icon: 'infinite' as keyof typeof Ionicons.glyphMap,
      title: 'Zones de sécurité illimitées',
      description: 'Créez autant de zones sûres que nécessaire',
    },
    {
      icon: 'people' as keyof typeof Ionicons.glyphMap,
      title: 'Enfants illimités',
      description: 'Suivez tous vos enfants sans limite',
    },
    {
      icon: 'ear' as keyof typeof Ionicons.glyphMap,
      title: 'Écoute environnementale',
      description: 'Écoutez l\'environnement de votre enfant',
    },
    {
      icon: 'analytics' as keyof typeof Ionicons.glyphMap,
      title: 'Analyses avancées',
      description: 'Statistiques détaillées et rapports',
    },
    {
      icon: 'shield-checkmark' as keyof typeof Ionicons.glyphMap,
      title: 'Support prioritaire',
      description: 'Assistance dédiée 24h/24',
    },
    {
      icon: 'time' as keyof typeof Ionicons.glyphMap,
      title: 'Historique étendu',
      description: 'Conservez 1 an d\'historique',
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      paddingHorizontal: theme.spacing.XL,
    },
    headerContainer: {
      alignItems: 'center',
      paddingVertical: theme.spacing.XXL,
      backgroundColor: `${theme.colors.primary}10`,
      marginHorizontal: -theme.spacing.XL,
      marginBottom: theme.spacing.LG,
    },
    crownIcon: {
      fontSize: 60,
      marginBottom: theme.spacing.MD,
    },
    title: {
      fontSize: theme.fontSizes.HEADING_LG,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.primary,
      marginBottom: theme.spacing.SM,
    },
    subtitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    featuresContainer: {
      marginBottom: theme.spacing.XXL,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.MD,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${theme.colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.MD,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.text,
      marginBottom: theme.spacing.XS,
    },
    featureDescription: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
    },
    pricingContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.sizes.CARD_RADIUS,
      padding: theme.spacing.LG,
      marginBottom: theme.spacing.XL,
      ...theme.shadows ? { ...theme.shadows.MD } : {},
    },
    pricingTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.MD,
    },
    priceContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'baseline',
      marginBottom: theme.spacing.MD,
    },
    currency: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.primary,
    },
    price: {
      fontSize: theme.fontSizes.HEADING_LG,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.primary,
    },
    period: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
    },
    trialText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.success,
      textAlign: 'center',
      marginBottom: theme.spacing.MD,
    },
  });

  const handleUpgrade = () => {
    // Implémenter la logique d'achat
    console.log('Upgrade to premium');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.crownIcon}>👑</Text>
          <Text style={styles.title}>TerranoKidsFind Premium</Text>
          <Text style={styles.subtitle}>
            Débloquez toutes les fonctionnalités avancées{'\n'}
            pour une protection maximale
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {premiumFeatures.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons 
                  name={feature.icon} 
                  size={24} 
                  color={theme.colors.primary} 
                />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.pricingContainer}>
          <Text style={styles.pricingTitle}>Abonnement Premium</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.currency}>€</Text>
            <Text style={styles.price}>9,99</Text>
            <Text style={styles.period}>/mois</Text>
          </View>
          <Text style={styles.trialText}>
            ✨ 7 jours d'essai gratuit
          </Text>
          <Button
            title="Démarrer l'essai gratuit"
            onPress={handleUpgrade}
            fullWidth
            icon="star"
            style={{ backgroundColor: '#FFD700' }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PremiumScreen;