import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';

// Stack Navigators
import DashboardNavigator from './DashboardNavigator';
import MapNavigator from './MapNavigator';
import MessagesNavigator from './MessagesNavigator';
import SettingsNavigator from './SettingsNavigator';
import PremiumScreen from '../screens/PremiumScreen';

// Types
import { MainTabParamList } from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator: React.FC = () => {
  const { theme } = useTheme();
  const { unreadCount } = useNotifications();

  const getTabBarIcon = (routeName: string, focused: boolean, size: number) => {
    let iconName: keyof typeof Ionicons.glyphMap;

    switch (routeName) {
      case 'Dashboard':
        iconName = focused ? 'home' : 'home-outline';
        break;
      case 'Map':
        iconName = focused ? 'map' : 'map-outline';
        break;
      case 'Messages':
        iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
        break;
      case 'Settings':
        iconName = focused ? 'settings' : 'settings-outline';
        break;
      case 'Premium':
        iconName = focused ? 'star' : 'star-outline';
        break;
      default:
        iconName = 'help-outline';
    }

    return (
      <Ionicons
        name={iconName}
        size={size}
        color={focused ? theme.colors.primary : theme.colors.gray[500]}
      />
    );
  };

  const screenOptions = ({ route }: { route: any }) => ({
    tabBarIcon: ({ focused, size }: { focused: boolean; size: number }) =>
      getTabBarIcon(route.name, focused, size),
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.gray[500],
    tabBarStyle: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
      elevation: 8,
      shadowOffset: {
        width: 0,
        height: -2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      height: 60,
      paddingBottom: 8,
      paddingTop: 8,
    },
    tabBarLabelStyle: {
      fontFamily: theme.fonts.MEDIUM,
      fontSize: theme.fontSizes.XS,
      marginTop: 2,
    },
    headerShown: false,
  });

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={screenOptions}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardNavigator}
        options={{
          title: 'Accueil',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.alert.sos,
            color: theme.colors.white,
            fontSize: theme.fontSizes.XS,
            fontFamily: theme.fonts.BOLD,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapNavigator}
        options={{
          title: 'Carte',
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        options={{
          title: 'Messages',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.alert.sos,
            color: theme.colors.white,
            fontSize: theme.fontSizes.XS,
            fontFamily: theme.fonts.BOLD,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          title: 'Paramètres',
        }}
      />
      <Tab.Screen
        name="Premium"
        component={PremiumScreen}
        options={{
          title: 'Premium',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons
              name={focused ? 'star' : 'star-outline'}
              size={size}
              color={focused ? '#FFD700' : theme.colors.gray[500]}
            />
          ),
          tabBarActiveTintColor: '#FFD700',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;