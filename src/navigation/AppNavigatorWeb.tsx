import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContextWeb';

// Import des écrans web
import WebLoginScreen from '../screens/WebLoginScreen';
import WebDemoScreen from '../screens/WebDemoScreen';

const Stack = createStackNavigator();

const AppNavigatorWeb: React.FC = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {user ? (
          <Stack.Screen 
            name="Demo" 
            component={WebDemoScreen}
            options={{ title: 'TerranoKidsFind - Dashboard' }}
          />
        ) : (
          <Stack.Screen 
            name="Login" 
            component={WebLoginScreen}
            options={{ title: 'TerranoKidsFind - Connexion' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigatorWeb;
