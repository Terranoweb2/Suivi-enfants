import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import Button from '../components/Button';

const { width: screenWidth } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const onboardingData: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Bienvenue sur TerranoKidsFind',
    description: 'L\'application de sécurité familiale la plus avancée pour protéger vos enfants où qu\'ils soient.',
    icon: 'shield-checkmark',
    color: '#1E90FF',
  },
  {
    id: '2',
    title: 'Localisation en temps réel',
    description: 'Suivez la position de vos enfants en temps réel avec une précision GPS élevée et un historique détaillé.',
    icon: 'location',
    color: '#32CD32',
  },
  {
    id: '3',
    title: 'Zones de sécurité',
    description: 'Créez des zones sûres et recevez des alertes automatiques lorsque vos enfants entrent ou sortent.',
    icon: 'business',
    color: '#FF6B35',
  },
  {
    id: '4',
    title: 'Alerte SOS d\'urgence',
    description: 'Bouton panique pour envoyer immédiatement votre localisation et demander de l\'aide en cas d\'urgence.',
    icon: 'alert-circle',
    color: '#D32F2F',
  },
  {
    id: '5',
    title: 'Communication sécurisée',
    description: 'Chat familial chiffré, contrôle des appels et surveillance environnementale pour une protection complète.',
    icon: 'chatbubbles',
    color: '#9C27B0',
  },
];

const OnboardingScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    slideContainer: {
      width: screenWidth,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.XL,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.XXL,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    title: {
      fontSize: theme.fontSizes.HEADING_LG,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.MD,
    },
    description: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 28,
      marginBottom: theme.spacing.XXL,
    },
    bottomContainer: {
      paddingHorizontal: theme.spacing.XL,
      paddingBottom: theme.spacing.XL,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.LG,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginHorizontal: 4,
    },
    activeDot: {
      backgroundColor: theme.colors.primary,
    },
    inactiveDot: {
      backgroundColor: theme.colors.gray[300],
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    skipButton: {
      padding: theme.spacing.MD,
    },
    skipText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.textSecondary,
    },
    nextButton: {
      minWidth: 120,
    },
  });

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    // @ts-ignore
    navigation.navigate('Auth');
  };

  const onViewableItemsChanged = ({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  };

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slideContainer}>
      <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={60} color={theme.colors.white} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  const renderPagination = () => (
    <View style={styles.pagination}>
      {onboardingData.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentIndex ? styles.activeDot : styles.inactiveDot,
          ]}
        />
      ))}
    </View>
  );

  const isLastSlide = currentIndex === onboardingData.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={onboardingData}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      
      <View style={styles.bottomContainer}>
        {renderPagination()}
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
          
          <Button
            title={isLastSlide ? 'Commencer' : 'Suivant'}
            onPress={handleNext}
            style={styles.nextButton}
            icon={isLastSlide ? 'arrow-forward' : 'chevron-forward'}
            iconPosition="right"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;