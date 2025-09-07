import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONT_SIZES, FONTS, SPACING, SIZES } from '../constants';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
    white: string;
    black: string;
    gray: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    status: {
      online: string;
      offline: string;
      charging: string;
      lowBattery: string;
    };
    alert: {
      sos: string;
      zone: string;
      safe: string;
    };
  };
  fonts: typeof FONTS;
  fontSizes: typeof FONT_SIZES;
  spacing: typeof SPACING;
  sizes: typeof SIZES;
  isDark: boolean;
}

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const lightTheme: Theme = {
  colors: {
    primary: COLORS.PRIMARY,
    secondary: COLORS.SECONDARY,
    background: COLORS.BACKGROUND,
    surface: COLORS.SURFACE,
    text: COLORS.GRAY_900,
    textSecondary: COLORS.GRAY_600,
    border: COLORS.BORDER,
    error: COLORS.ERROR,
    warning: COLORS.WARNING,
    success: COLORS.SUCCESS,
    info: COLORS.INFO,
    white: COLORS.WHITE,
    black: COLORS.BLACK,
    gray: {
      50: COLORS.GRAY_50,
      100: COLORS.GRAY_100,
      200: COLORS.GRAY_200,
      300: COLORS.GRAY_300,
      400: COLORS.GRAY_400,
      500: COLORS.GRAY_500,
      600: COLORS.GRAY_600,
      700: COLORS.GRAY_700,
      800: COLORS.GRAY_800,
      900: COLORS.GRAY_900,
    },
    status: {
      online: COLORS.ONLINE,
      offline: COLORS.OFFLINE,
      charging: COLORS.CHARGING,
      lowBattery: COLORS.LOW_BATTERY,
    },
    alert: {
      sos: COLORS.SOS_RED,
      zone: COLORS.ALERT_ORANGE,
      safe: COLORS.SAFE_GREEN,
    },
  },
  fonts: FONTS,
  fontSizes: FONT_SIZES,
  spacing: SPACING,
  sizes: SIZES,
  isDark: false,
};

const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    background: COLORS.BLACK, // Noir profond pour le fond
    surface: COLORS.GRAY_800,
    text: COLORS.WHITE,
    textSecondary: COLORS.GRAY_300,
    border: COLORS.GRAY_700,
    primary: COLORS.PRIMARY, // Garde l'orange vibrant
    secondary: COLORS.SECONDARY, // Orange secondaire
    gray: {
      50: COLORS.GRAY_900,
      100: COLORS.GRAY_800,
      200: COLORS.GRAY_700,
      300: COLORS.GRAY_600,
      400: COLORS.GRAY_500,
      500: COLORS.GRAY_400,
      600: COLORS.GRAY_300,
      700: COLORS.GRAY_200,
      800: COLORS.GRAY_100,
      900: COLORS.GRAY_50,
    },
  },
  isDark: true,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  // Déterminer le thème actuel basé sur le mode et le schéma système
  const getCurrentTheme = (): Theme => {
    if (themeMode === 'auto') {
      return systemColorScheme === 'dark' ? darkTheme : lightTheme;
    }
    return themeMode === 'dark' ? darkTheme : lightTheme;
  };

  const [theme, setTheme] = useState<Theme>(getCurrentTheme());

  // Charger le mode de thème sauvegardé
  useEffect(() => {
    loadThemeMode();
  }, []);

  // Écouter les changements du schéma de couleurs système
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  // Mettre à jour le thème quand le mode ou le schéma système change
  useEffect(() => {
    setTheme(getCurrentTheme());
  }, [themeMode, systemColorScheme]);

  const loadThemeMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('themeMode');
      if (savedMode && ['light', 'dark', 'auto'].includes(savedMode)) {
        setThemeModeState(savedMode as ThemeMode);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du mode de thème:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du mode de thème:', error);
    }
  };

  const toggleTheme = () => {
    const currentIsDark = getCurrentTheme().isDark;
    setThemeMode(currentIsDark ? 'light' : 'dark');
  };

  const value: ThemeContextType = {
    theme,
    themeMode,
    setThemeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  }
  return context;
};

export default ThemeProvider;