import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginForm, RegisterForm, AuthState } from '../types';
import { webMockStorage, webMockSecureStore, webMockBiometrics, isWeb } from '../utils/platform';

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
  }, []);

  const initializeAuth = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Simuler un utilisateur connecté pour la démo web
      if (isWeb) {
        const demoUser: User = {
          id: 'demo-user-1',
          email: 'demo@terranokidsfind.com',
          name: 'Utilisateur Démo',
          phone: '+33123456789',
          role: 'parent',
          isPremium: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          familyId: 'demo-family-1',
        };

        setState({
          user: demoUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Logique native normale ici...
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Erreur d\'initialisation de l\'authentification:', error);
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Erreur d\'initialisation',
      });
    }
  };

  const login = async (credentials: LoginForm): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (isWeb) {
        // Simulation de connexion pour la démo web
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const demoUser: User = {
          id: 'demo-user-1',
          email: credentials.email,
          name: 'Utilisateur Démo',
          phone: '+33123456789',
          role: 'parent',
          isPremium: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          familyId: 'demo-family-1',
        };

        setState({
          user: demoUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      }

      // Logique native normale ici...
      return false;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Erreur de connexion',
      }));
      return false;
    }
  };

  const register = async (userData: RegisterForm): Promise<boolean> => {
    // Simulation pour le web
    if (isWeb) {
      return login({ email: userData.email, password: userData.password });
    }
    return false;
  };

  const logout = async (): Promise<void> => {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  const refreshToken = async (): Promise<boolean> => {
    return true;
  };

  const updateUser = async (userData: Partial<User>): Promise<boolean> => {
    if (state.user) {
      setState(prev => ({
        ...prev,
        user: { ...prev.user!, ...userData },
      }));
      return true;
    }
    return false;
  };

  const authenticateWithBiometrics = async (): Promise<boolean> => {
    return false; // Pas de biométrie sur le web
  };

  const checkBiometricAvailability = async (): Promise<boolean> => {
    return false;
  };

  const enableBiometricAuth = async (): Promise<boolean> => {
    return false;
  };

  const disableBiometricAuth = async (): Promise<void> => {
    setIsBiometricEnabled(false);
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  const contextValue: AuthContextType = {
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
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
