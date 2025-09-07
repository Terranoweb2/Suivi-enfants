import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { User, LoginForm, RegisterForm, ApiResponse, LoginResponse, AuthState } from '../types';
import { authService } from '../services/authService';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';

interface AuthContextType extends AuthState {
  login: (credentials: LoginForm) => Promise<boolean>;
  register: (userData: RegisterForm) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateUser: (userData: Partial<User>) => Promise<boolean>;
  authenticateWithBiometrics: () => Promise<boolean>;
  checkBiometricAvailability: () => Promise<boolean>;
  enableBiometricAuth: () => Promise<boolean>;
  disableBiometricAuth: () => Promise<void>;
  isBiometricEnabled: boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user_data',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  BIOMETRIC_CREDENTIALS: 'biometric_credentials',
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  useEffect(() => {
    initializeAuth();
    checkBiometricStatus();
  }, []);

  const initializeAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);

      if (token && userData) {
        const user = JSON.parse(userData);
        
        // Vérifier si le token est toujours valide
        const isValid = await authService.validateToken(token);
        
        if (isValid) {
          setState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          // Essayer de rafraîchir le token
          const refreshed = await refreshToken();
          if (!refreshed) {
            await clearAuthData();
          }
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'authentification:', error);
      setState(prev => ({ ...prev, isLoading: false, error: ERROR_MESSAGES.SERVER_ERROR }));
      await clearAuthData();
    }
  };

  const checkBiometricStatus = async () => {
    try {
      const enabled = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      setIsBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.error('Erreur lors de la vérification du statut biométrique:', error);
    }
  };

  const login = async (credentials: LoginForm): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response: ApiResponse<LoginResponse> = await authService.login(credentials);

      if (response.success && response.data) {
        const { user, token, refreshToken } = response.data;

        // Sauvegarder les données d'authentification
        await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: response.error || ERROR_MESSAGES.INVALID_CREDENTIALS 
        }));
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: ERROR_MESSAGES.NETWORK_ERROR 
      }));
      return false;
    }
  };

  const register = async (userData: RegisterForm): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response: ApiResponse<LoginResponse> = await authService.register(userData);

      if (response.success && response.data) {
        const { user, token, refreshToken } = response.data;

        // Sauvegarder les données d'authentification
        await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: response.error || ERROR_MESSAGES.SERVER_ERROR 
        }));
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: ERROR_MESSAGES.NETWORK_ERROR 
      }));
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Appeler l'API de déconnexion
      await authService.logout();
      
      // Nettoyer les données locales
      await clearAuthData();

      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Même en cas d'erreur, nettoyer les données locales
      await clearAuthData();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshTokenValue = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      
      if (!refreshTokenValue) {
        return false;
      }

      const response: ApiResponse<LoginResponse> = await authService.refreshToken(refreshTokenValue);

      if (response.success && response.data) {
        const { user, token, refreshToken: newRefreshToken } = response.data;

        // Sauvegarder les nouveaux tokens
        await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

        setState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        }));

        return true;
      } else {
        await clearAuthData();
        return false;
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      await clearAuthData();
      return false;
    }
  };

  const updateUser = async (userData: Partial<User>): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response: ApiResponse<User> = await authService.updateProfile(userData);

      if (response.success && response.data) {
        const updatedUser = response.data;
        
        // Mettre à jour les données locales
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));

        setState(prev => ({
          ...prev,
          user: updatedUser,
          isLoading: false,
          error: null,
        }));

        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: response.error || ERROR_MESSAGES.SERVER_ERROR 
        }));
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: ERROR_MESSAGES.NETWORK_ERROR 
      }));
      return false;
    }
  };

  const checkBiometricAvailability = async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Erreur lors de la vérification biométrique:', error);
      return false;
    }
  };

  const authenticateWithBiometrics = async (): Promise<boolean> => {
    try {
      const isAvailable = await checkBiometricAvailability();
      
      if (!isAvailable) {
        setState(prev => ({ 
          ...prev, 
          error: ERROR_MESSAGES.BIOMETRIC_NOT_AVAILABLE 
        }));
        return false;
      }

      const credentials = await SecureStore.getItemAsync(STORAGE_KEYS.BIOMETRIC_CREDENTIALS);
      
      if (!credentials) {
        setState(prev => ({ 
          ...prev, 
          error: 'Aucune donnée biométrique enregistrée' 
        }));
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Utilisez votre empreinte ou Face ID pour vous connecter',
        cancelLabel: 'Annuler',
        fallbackLabel: 'Utiliser le mot de passe',
      });

      if (result.success) {
        const { email, password } = JSON.parse(credentials);
        return await login({ email, password });
      } else {
        setState(prev => ({ 
          ...prev, 
          error: 'Authentification biométrique échouée' 
        }));
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de l\'authentification biométrique:', error);
      setState(prev => ({ 
        ...prev, 
        error: ERROR_MESSAGES.BIOMETRIC_NOT_AVAILABLE 
      }));
      return false;
    }
  };

  const enableBiometricAuth = async (): Promise<boolean> => {
    try {
      const isAvailable = await checkBiometricAvailability();
      
      if (!isAvailable) {
        setState(prev => ({ 
          ...prev, 
          error: ERROR_MESSAGES.BIOMETRIC_NOT_AVAILABLE 
        }));
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Activez l\'authentification biométrique',
        cancelLabel: 'Annuler',
      });

      if (result.success) {
        // Ici, vous devriez demander à l'utilisateur d'entrer ses identifiants
        // pour les sauvegarder de manière sécurisée
        // Pour cet exemple, nous supposons que c'est déjà fait
        
        await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
        setIsBiometricEnabled(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erreur lors de l\'activation biométrique:', error);
      return false;
    }
  };

  const disableBiometricAuth = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.BIOMETRIC_CREDENTIALS);
      setIsBiometricEnabled(false);
    } catch (error) {
      console.error('Erreur lors de la désactivation biométrique:', error);
    }
  };

  const clearAuthData = async (): Promise<void> => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
      ]);
    } catch (error) {
      console.error('Erreur lors du nettoyage des données d\'authentification:', error);
    }
  };

  const clearError = (): void => {
    setState(prev => ({ ...prev, error: null }));
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
    authenticateWithBiometrics,
    checkBiometricAvailability,
    enableBiometricAuth,
    disableBiometricAuth,
    isBiometricEnabled,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

export default AuthProvider;