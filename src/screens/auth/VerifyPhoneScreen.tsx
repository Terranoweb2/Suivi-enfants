import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { authService } from '../../services/authService';
import Button from '../../components/Button';

interface RouteParams {
  phone: string;
}

const VerifyPhoneScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { phone } = route.params as RouteParams;
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus sur le prochain input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Vérification automatique si tous les champs sont remplis
    if (newCode.every(digit => digit !== '') && text) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      Alert.alert('Erreur', 'Veuillez saisir le code à 6 chiffres');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.verifyPhone(phone, codeToVerify);
      
      if (response.success) {
        Alert.alert(
          'Téléphone vérifié',
          'Votre numéro de téléphone a été vérifié avec succès',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert(
          'Code incorrect',
          response.error || 'Le code saisi est incorrect',
          [{ text: 'OK' }]
        );
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Une erreur s\'est produite lors de la vérification',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    setIsLoading(true);
    try {
      // Ici vous pourriez appeler une API pour renvoyer le code
      // await authService.resendVerificationCode(phone);
      
      setResendTimer(60);
      setCanResend(false);
      Alert.alert(
        'Code renvoyé',
        'Un nouveau code de vérification a été envoyé',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Impossible de renvoyer le code',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phoneNumber: string) => {
    // Formatter le numéro pour l'affichage (masquer une partie)
    if (phoneNumber.length >= 4) {
      return phoneNumber.slice(0, 2) + '••••••' + phoneNumber.slice(-2);
    }
    return phoneNumber;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.XL,
    },
    headerContainer: {
      alignItems: 'center',
      marginTop: theme.spacing.XXL,
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
    phoneNumber: {
      fontSize: theme.fontSizes.LG,
      fontFamily: theme.fonts.SEMIBOLD,
      color: theme.colors.primary,
    },
    codeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: theme.spacing.XXL,
    },
    codeInput: {
      width: 45,
      height: 55,
      borderRadius: theme.sizes.BORDER_RADIUS,
      borderWidth: 2,
      borderColor: theme.colors.border,
      textAlign: 'center',
      fontSize: theme.fontSizes.XL,
      fontFamily: theme.fonts.BOLD,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
    },
    codeInputActive: {
      borderColor: theme.colors.primary,
    },
    codeInputFilled: {
      borderColor: theme.colors.success,
      backgroundColor: theme.colors.success + '10',
    },
    resendContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.XXL,
    },
    resendText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.REGULAR,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.SM,
    },
    resendButton: {
      padding: theme.spacing.SM,
    },
    resendButtonText: {
      fontSize: theme.fontSizes.MD,
      fontFamily: theme.fonts.SEMIBOLD,
      color: canResend ? theme.colors.primary : theme.colors.gray[400],
    },
    timerText: {
      fontSize: theme.fontSizes.SM,
      fontFamily: theme.fonts.MEDIUM,
      color: theme.colors.textSecondary,
    },
    buttonContainer: {
      marginTop: 'auto',
      paddingBottom: theme.spacing.XL,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>📱</Text>
        </View>
        <Text style={styles.title}>Vérification du téléphone</Text>
        <Text style={styles.subtitle}>
          Nous avons envoyé un code de vérification au numéro{'\n'}
          <Text style={styles.phoneNumber}>{formatPhone(phone)}</Text>
        </Text>
      </View>

      {/* Code inputs */}
      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.codeInput,
              digit ? styles.codeInputFilled : {},
            ]}
            value={digit}
            onChangeText={(text) => handleCodeChange(text, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            keyboardType="numeric"
            maxLength={1}
            autoFocus={index === 0}
            selectTextOnFocus
            testID={`code-input-${index}`}
          />
        ))}
      </View>

      {/* Resend code */}
      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>
          Vous n'avez pas reçu le code ?
        </Text>
        {canResend ? (
          <TouchableOpacity 
            onPress={handleResendCode}
            style={styles.resendButton}
            disabled={isLoading}
          >
            <Text style={styles.resendButtonText}>
              Renvoyer le code
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.timerText}>
            Renvoyer dans {resendTimer}s
          </Text>
        )}
      </View>

      {/* Verify button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Vérifier"
          onPress={() => handleVerifyCode()}
          loading={isLoading}
          disabled={code.some(digit => !digit)}
          fullWidth
          testID="verify-code-button"
        />
      </View>
    </SafeAreaView>
  );
};

export default VerifyPhoneScreen;