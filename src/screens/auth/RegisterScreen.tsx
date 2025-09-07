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
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { RegisterForm } from '../../types';
import { VALIDATION } from '../../constants';

const RegisterScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { register, isLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState<RegisterForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'parent',
    acceptTerms: false,
  });
  const [formErrors, setFormErrors] = useState<Partial<RegisterForm>>({});

  useEffect(() => {
    clearError();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Erreur d\'inscription', error, [
        { text: 'OK', onPress: clearError },
      ]);
    }
  }, [error]);

  const validateForm = (): boolean => {
    const errors: Partial<RegisterForm> = {};

    // Validation du nom
    if (!formData.name.trim()) {
      errors.name = 'Le nom est requis';
    } else if (formData.name.length < VALIDATION.MIN_NAME_LENGTH) {
      errors.name = `Le nom doit contenir au moins ${VALIDATION.MIN_NAME_LENGTH} caractères`;
    } else if (formData.name.length > VALIDATION.MAX_NAME_LENGTH) {
      errors.name = `Le nom ne peut pas dépasser ${VALIDATION.MAX_NAME_LENGTH} caractères`;
    }

    // Validation de l'email
    if (!formData.email.trim()) {
      errors.email = 'L\'email est requis';
    } else if (!VALIDATION.EMAIL_REGEX.test(formData.email)) {
      errors.email = 'Format d\'email invalide';
    }

    // Validation du téléphone
    if (!formData.phone.trim()) {
      errors.phone = 'Le numéro de téléphone est requis';
    } else if (!VALIDATION.PHONE_REGEX.test(formData.phone)) {
      errors.phone = 'Format de téléphone invalide';
    }

    // Validation du mot de passe
    if (!formData.password.trim()) {
      errors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < VALIDATION.MIN_PASSWORD_LENGTH) {
      errors.password = `Le mot de passe doit contenir au moins ${VALIDATION.MIN_PASSWORD_LENGTH} caractères`;
    } else if (formData.password.length > VALIDATION.MAX_PASSWORD_LENGTH) {
      errors.password = `Le mot de passe ne peut pas dépasser ${VALIDATION.MAX_PASSWORD_LENGTH} caractères`;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre';
    }

    // Validation de la confirmation du mot de passe
    if (!formData.confirmPassword.trim()) {
      errors.confirmPassword = 'La confirmation du mot de passe est requise';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    // Validation des conditions d'utilisation
    if (!formData.acceptTerms) {
      errors.acceptTerms = 'Vous devez accepter les conditions d\'utilisation';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    const success = await register(formData);
    if (success) {
      // La navigation se fera automatiquement via le contexte d'authentification
    }
  };

  const handleLogin = () => {
    navigation.goBack();
  };

  const updateFormData = (field: keyof RegisterForm, value: string | boolean) => {
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
      marginTop: theme.spacing.LG,
      marginBottom: theme.spacing.LG,
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
    },
    formContainer: {
      marginBottom: theme.spacing.LG,
    },
    roleContainer: {
      marginBottom: theme.spacing.MD,
    },
    roleLabel: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.text,
      marginBottom: theme.spacing.XS,
    },
    roleButtons: {
      flexDirection: 'row',
      gap: theme.spacing.SM,
    },
    roleButton: {
      flex: 1,
      paddingVertical: theme.spacing.SM,
      paddingHorizontal: theme.spacing.MD,
      borderRadius: theme.sizes.BORDER_RADIUS,
      borderWidth: 1,
      alignItems: 'center',
    },
    roleButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    roleButtonInactive: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border,
    },
    roleButtonTextActive: {
      color: theme.colors.white,
      fontFamily: theme.fonts.SEMIBOLD,
      fontSize: theme.fontSizes.SM,
    },
    roleButtonTextInactive: {
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.MEDIUM,
      fontSize: theme.fontSizes.SM,
    },
    termsContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginVertical: theme.spacing.MD,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      marginRight: theme.spacing.SM,
      marginTop: 2,
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
    termsText: {
      flex: 1,
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    termsLink: {
      color: theme.colors.primary,
      fontFamily: theme.fonts.SEMIBOLD,
    },
    errorText: {
      fontSize: theme.fontSizes.XS,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.error,
      marginTop: theme.spacing.XS,
    },
    loginContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing.LG,
    },
    loginText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
    },
    loginLink: {
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
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>
              Rejoignez TerranoKidsFind pour protéger vos enfants
            </Text>
          </View>

          {/* Formulaire d'inscription */}
          <View style={styles.formContainer}>
            <Input
              label="Nom complet"
              placeholder="Votre nom"
              value={formData.name}
              onChangeText={(text) => updateFormData('name', text)}
              error={formErrors.name}
              leftIcon="person"
              autoCapitalize="words"
              testID="register-name-input"
            />

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
              testID="register-email-input"
            />

            <Input
              label="Numéro de téléphone"
              placeholder="+33 6 12 34 56 78"
              value={formData.phone}
              onChangeText={(text) => updateFormData('phone', text)}
              error={formErrors.phone}
              leftIcon="call"
              keyboardType="phone-pad"
              testID="register-phone-input"
            />

            {/* Sélection du rôle */}
            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>Je suis :</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    formData.role === 'parent' ? styles.roleButtonActive : styles.roleButtonInactive,
                  ]}
                  onPress={() => updateFormData('role', 'parent')}
                >
                  <Text style={[
                    formData.role === 'parent' ? styles.roleButtonTextActive : styles.roleButtonTextInactive,
                  ]}>
                    Parent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    formData.role === 'child' ? styles.roleButtonActive : styles.roleButtonInactive,
                  ]}
                  onPress={() => updateFormData('role', 'child')}
                >
                  <Text style={[
                    formData.role === 'child' ? styles.roleButtonTextActive : styles.roleButtonTextInactive,
                  ]}>
                    Enfant
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Input
              label="Mot de passe"
              placeholder="Choisissez un mot de passe"
              value={formData.password}
              onChangeText={(text) => updateFormData('password', text)}
              error={formErrors.password}
              leftIcon="lock-closed"
              secureTextEntry
              testID="register-password-input"
            />

            <Input
              label="Confirmer le mot de passe"
              placeholder="Confirmez votre mot de passe"
              value={formData.confirmPassword}
              onChangeText={(text) => updateFormData('confirmPassword', text)}
              error={formErrors.confirmPassword}
              leftIcon="lock-closed"
              secureTextEntry
              testID="register-confirm-password-input"
            />

            {/* Conditions d'utilisation */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  formData.acceptTerms ? styles.checkboxChecked : styles.checkboxUnchecked,
                ]}
                onPress={() => updateFormData('acceptTerms', !formData.acceptTerms)}
              >
                {formData.acceptTerms && (
                  <Text style={styles.checkboxText}>✓</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.termsText}>
                J'accepte les{' '}
                <Text style={styles.termsLink}>conditions d'utilisation</Text>
                {' '}et la{' '}
                <Text style={styles.termsLink}>politique de confidentialité</Text>
              </Text>
            </View>
            {formErrors.acceptTerms && (
              <Text style={styles.errorText}>{formErrors.acceptTerms}</Text>
            )}

            <Button
              title="Créer mon compte"
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
              style={{ marginTop: theme.spacing.MD }}
              testID="register-button"
            />
          </View>

          {/* Lien de connexion */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>
              Déjà un compte ?
            </Text>
            <TouchableOpacity onPress={handleLogin}>
              <Text style={styles.loginLink}>
                Se connecter
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterScreen;