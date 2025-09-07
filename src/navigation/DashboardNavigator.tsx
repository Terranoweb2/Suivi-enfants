import React from 'react';
import { View, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../contexts/ThemeContext';
import { DashboardStackParamList } from '../types';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import SOSHistoryScreen from '../screens/dashboard/SOSHistoryScreen';
import RemoteSoundHistoryScreen from '../screens/dashboard/RemoteSoundHistoryScreen';

// Additional screens to be implemented
const ChildDetailsScreen = () => {
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
      }}>Détails enfant à venir</Text>
    </View>
  );
};

const AddChildScreen = () => {
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
      }}>Ajouter enfant à venir</Text>
    </View>
  );
};

const Stack = createStackNavigator<DashboardStackParamList>();

const DashboardNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="DashboardHome"
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
        name="DashboardHome"
        component={DashboardScreen}
        options={{
          title: 'Tableau de bord',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ChildDetails"
        component={ChildDetailsScreen}
        options={{
          title: 'Détails de l\'enfant',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="AddChild"
        component={AddChildScreen}
        options={{
          title: 'Ajouter un enfant',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="SOSHistory"
        component={SOSHistoryScreen}
        options={{
          title: 'Historique SOS',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RemoteSoundHistory"
        component={RemoteSoundHistoryScreen}
        options={{
          title: 'Historique des sons',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default DashboardNavigator;