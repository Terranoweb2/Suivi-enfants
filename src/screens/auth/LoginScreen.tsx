import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { LoginForm } from '../../types';
import { VALIDATION } from '../../constants';

const LoginScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { 
    login, 
    authenticateWithBiometrics, 
    checkBiometricAvailability, 
    isBiometricEnabled,
    isLoading,
    error,
    clearError,
  } = useAuth();

  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<LoginForm>>({});
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    checkBiometric();
    clearError();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Erreur de connexion', error, [
        { text: 'OK', onPress: clearError },
      ]);
    }
  }, [error]);

  const checkBiometric = async () => {
    const available = await checkBiometricAvailability();
    setBiometricAvailable(available);
  };

  const validateForm = (): boolean => {
    const errors: Partial<LoginForm> = {};

    if (!formData.email.trim()) {
      errors.email = 'L\'email est requis';
    } else if (!VALIDATION.EMAIL_REGEX.test(formData.email)) {
      errors.email = 'Format d\'email invalide';
    }

    if (!formData.password.trim()) {
      errors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < VALIDATION.MIN_PASSWORD_LENGTH) {
      errors.password = `Le mot de passe doit contenir au moins ${VALIDATION.MIN_PASSWORD_LENGTH} caractères`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    const success = await login(formData);
    if (success) {
      // La navigation se fera automatiquement via le contexte d'authentification
    }
  };

  const handleBiometricLogin = async () => {
    const success = await authenticateWithBiometrics();
    if (success) {
      // La navigation se fera automatiquement via le contexte d'authentification
    }
  };

  const handleForgotPassword = () => {
    // @ts-ignore
    navigation.navigate('ForgotPassword');
  };

  const handleRegister = () => {
    // @ts-ignore
    navigation.navigate('Register');
  };

  const updateFormData = (field: keyof LoginForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.XL,
    },
    headerContainer: {
      alignItems: 'center',
      marginTop: theme.spacing.XXL,
      marginBottom: theme.spacing.XXL,
    },
    logo: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.MD,
    },
    logoText: {
      fontSize: 40,
      color: theme.colors.white,
    },
    appName: {
      fontSize: theme.fontSizes.HEADING_LG,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.primary,
      marginBottom: theme.spacing.XS,
    },
    tagline: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    formContainer: {
      marginBottom: theme.spacing.LG,
    },
    title: {
      fontSize: theme.fontSizes.HEADING_MD,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.LG,
    },
    forgotPasswordContainer: {
      alignItems: 'center',
      marginTop: theme.spacing.MD,
      marginBottom: theme.spacing.LG,
    },
    forgotPasswordText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.primary,
    },
    biometricContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.LG,
    },
    biometricButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.SM,
    },
    biometricText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.LG,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.textSecondary,
      marginHorizontal: theme.spacing.MD,
    },
    registerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 'auto',
      paddingBottom: theme.spacing.XL,
    },
    registerText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
    },
    registerLink: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.primary,
      marginLeft: theme.spacing.XS,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header avec logo */}
          <View style={styles.headerContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>📡</Text>
            </View>
            <Text style={styles.appName}>TerranoKidsFind</Text>
            <Text style={styles.tagline}>
              Protégez et suivez vos enfants
            </Text>
          </View>

          {/* Formulaire de connexion */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Se connecter</Text>

            <Input
              label="Adresse email"
              placeholder="votre@email.com"
              value={formData.email}
              onChangeText={(text) => updateFormData('email', text)}
              error={formErrors.email}
              leftIcon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-email-input"
            />

            <Input
              label="Mot de passe"
              placeholder="Votre mot de passe"
              value={formData.password}
              onChangeText={(text) => updateFormData('password', text)}
              error={formErrors.password}
              leftIcon="lock-closed"
              secureTextEntry
              testID="login-password-input"
            />

            <TouchableOpacity 
              onPress={handleForgotPassword}
              style={styles.forgotPasswordContainer}
            >
              <Text style={styles.forgotPasswordText}>
                Mot de passe oublié ?
              </Text>
            </TouchableOpacity>

            <Button
              title="Se connecter"
              onPress={handleLogin}
              loading={isLoading}
              fullWidth
              testID="login-button"
            />
          </View>

          {/* Authentification biométrique */}
          {biometricAvailable && isBiometricEnabled && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.biometricContainer}>
                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometricLogin}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="finger-print" 
                    size={30} 
                    color={theme.colors.white} 
                  />
                </TouchableOpacity>
                <Text style={styles.biometricText}>
                  Connexion biométrique
                </Text>
              </View>
            </>
          )}

          {/* Lien d'inscription */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>
              Pas encore de compte ?
            </Text>
            <TouchableOpacity onPress={handleRegister}>
              <Text style={styles.registerLink}>
                S'inscrire
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;