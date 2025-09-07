import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../contexts/ThemeContext';
import { MapStackParamList } from '../types';
import MapScreen from '../screens/map/MapScreen';
import SafeZonesScreen from '../screens/map/SafeZonesScreen';

const Stack = createStackNavigator<MapStackParamList>();

const MapNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="MapView"
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
        name="MapView"
        component={MapScreen}
        options={{
          title: 'Carte',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SafeZones"
        component={SafeZonesScreen}
        options={{
          title: 'Zones de sécurité',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
};

export default MapNavigator;