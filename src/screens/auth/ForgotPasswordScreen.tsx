import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { authService } from '../../services/authService';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { VALIDATION } from '../../constants';

const ForgotPasswordScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setEmailError('L\'email est requis');
      return false;
    }
    
    if (!VALIDATION.EMAIL_REGEX.test(email)) {
      setEmailError('Format d\'email invalide');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleSendEmail = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      const response = await authService.forgotPassword(email);
      
      if (response.success) {
        setIsEmailSent(true);
        Alert.alert(
          'Email envoyé',
          'Un email de réinitialisation a été envoyé à votre adresse.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Erreur',
          response.error || 'Impossible d\'envoyer l\'email',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Une erreur s\'est produite',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigation.goBack();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.XL,
      paddingTop: theme.spacing.LG,
    },
    headerContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.XXL,
    },
    icon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.LG,
    },
    iconText: {
      fontSize: 36,
      color: theme.colors.white,
    },
    title: {
      fontSize: theme.fontSizes.HEADING_MD,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.SM,
    },
    subtitle: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    formContainer: {
      marginBottom: theme.spacing.XXL,
    },
    successContainer: {
      alignItems: 'center',
      paddingVertical: theme.spacing.XL,
    },
    successIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.LG,
    },
    successIconText: {
      fontSize: 24,
      color: theme.colors.white,
    },
    successTitle: {
      fontSize: theme.fontSizes.HEADING_SM,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.SM,
    },
    successText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: theme.spacing.LG,
    },
    buttonContainer: {
      marginTop: 'auto',
      paddingBottom: theme.spacing.XL,
    },
  });

  if (isEmailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scrollContainer}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Email envoyé !</Text>
            <Text style={styles.successText}>
              Nous avons envoyé un lien de réinitialisation à {email}.
              Vérifiez votre boîte de réception et suivez les instructions.
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button
              title="Retour à la connexion"
              onPress={handleBackToLogin}
              fullWidth
              variant="outline"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>🔑</Text>
          </View>
          <Text style={styles.title}>Mot de passe oublié ?</Text>
          <Text style={styles.subtitle}>
            Entrez votre adresse email et nous vous enverrons un lien 
            pour réinitialiser votre mot de passe.
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.formContainer}>
          <Input
            label="Adresse email"
            placeholder="votre@email.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError('');
            }}
            error={emailError}
            leftIcon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            testID="forgot-password-email-input"
          />

          <Button
            title="Envoyer le lien"
            onPress={handleSendEmail}
            loading={isLoading}
            fullWidth
            testID="send-reset-email-button"
          />
        </View>

        {/* Bouton retour */}
        <View style={styles.buttonContainer}>
          <Button
            title="Retour à la connexion"
            onPress={handleBackToLogin}
            variant="text"
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;