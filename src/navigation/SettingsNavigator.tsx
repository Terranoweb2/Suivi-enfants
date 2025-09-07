import React from 'react';
import { View, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../contexts/ThemeContext';
import { SettingsStackParamList } from '../types';

// Placeholder screens - to be implemented
const SettingsHomeScreen = () => {
  const { theme } = useTheme();
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: theme.colors.background 
    }}>
      <Text style={{ 
        fontSize: theme.fontSizes.HEADING_MD,
        fontFamily: theme.fonts.BOLD,
        color: theme.colors.text,
        marginBottom: theme.spacing.MD 
      }}>Paramètres à venir</Text>
      <Text style={{ 
        fontSize: theme.fontSizes.MD,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.XL
      }}>
        Profil, sécurité, notifications, confidentialité et support
      </Text>
    </View>
  );
};

const Stack = createStackNavigator<SettingsStackParamList>();

const SettingsNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="SettingsHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontFamily: theme.fonts.SEMIBOLD,
          fontSize: theme.fontSizes.HEADING_SM,
          color: theme.colors.text,
        },
        headerTintColor: theme.colors.primary,
      }}
    >
      <Stack.Screen
        name="SettingsHome"
        component={SettingsHomeScreen}
        options={{
          title: 'Paramètres',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default SettingsNavigator;