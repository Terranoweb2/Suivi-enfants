import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

// Import conditionnel du hook d'authentification
const useAuth = Platform.OS === 'web'
  ? require('../contexts/AuthContextWeb').useAuth
  : require('../contexts/AuthContext').useAuth;

// Navigation Components
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoadingScreen from '../screens/LoadingScreen';
import WebDemoScreen from '../screens/WebDemoScreen';
import WebLoginScreen from '../screens/WebLoginScreen';

// Types
import { RootStackParamList } from '../types';

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useTheme();

  const navigationTheme = {
    dark: theme.isDark,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              opacity: current.progress,
            },
          }),
        }}
      >
        {isAuthenticated && user ? (
          // Utilisateur authentifié
          <Stack.Screen
            name="Main"
            component={Platform.OS === 'web' ? WebDemoScreen : MainTabNavigator}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
        ) : (
          // Utilisateur non authentifié
          <>
            {Platform.OS === 'web' ? (
              <Stack.Screen
                name="Auth"
                component={WebLoginScreen}
                options={{
                  animationTypeForReplace: 'push',
                }}
              />
            ) : (
              <>
                <Stack.Screen
                  name="OnBoarding"
                  component={OnboardingScreen}
                  options={{
                    animationTypeForReplace: 'pop',
                  }}
                />
                <Stack.Screen
                  name="Auth"
                  component={AuthNavigator}
                  options={{
                    animationTypeForReplace: 'push',
                  }}
                />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;