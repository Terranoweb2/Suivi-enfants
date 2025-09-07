import React from 'react';
import { View, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../contexts/ThemeContext';

// Placeholder screens - to be implemented
const MessagesScreen = () => {
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
      }}>Messages à venir</Text>
      <Text style={{ 
        fontSize: theme.fontSizes.MD,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.XL
      }}>
        Chat familial sécurisé avec messages, stickers et messages vocaux
      </Text>
    </View>
  );
};

const Stack = createStackNavigator();

const MessagesNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Messages"
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
        name="Messages"
        component={MessagesScreen}
        options={{
          title: 'Messages',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default MessagesNavigator;