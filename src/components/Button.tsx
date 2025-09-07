import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  testID?: string;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
  testID,
}) => {
  const { theme } = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: theme.sizes.BUTTON_RADIUS,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    };

    // Taille
    switch (size) {
      case 'small':
        baseStyle.height = theme.sizes.BUTTON_HEIGHT_SM;
        baseStyle.paddingHorizontal = theme.spacing.MD;
        break;
      case 'large':
        baseStyle.height = theme.sizes.BUTTON_HEIGHT_LG;
        baseStyle.paddingHorizontal = theme.spacing.XL;
        break;
      default:
        baseStyle.height = theme.sizes.BUTTON_HEIGHT;
        baseStyle.paddingHorizontal = theme.spacing.LG;
    }

    // Variante
    switch (variant) {
      case 'primary':
        baseStyle.backgroundColor = disabled ? theme.colors.gray[300] : theme.colors.primary;
        baseStyle.borderColor = disabled ? theme.colors.gray[300] : theme.colors.primary;
        break;
      case 'secondary':
        baseStyle.backgroundColor = disabled ? theme.colors.gray[200] : theme.colors.secondary;
        baseStyle.borderColor = disabled ? theme.colors.gray[200] : theme.colors.secondary;
        break;
      case 'outline':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderColor = disabled ? theme.colors.gray[300] : theme.colors.primary;
        break;
      case 'text':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderColor = 'transparent';
        baseStyle.paddingHorizontal = theme.spacing.SM;
        break;
      case 'danger':
        baseStyle.backgroundColor = disabled ? theme.colors.gray[300] : theme.colors.error;
        baseStyle.borderColor = disabled ? theme.colors.gray[300] : theme.colors.error;
        break;
    }

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontFamily: theme.fonts.SEMIBOLD,
      textAlign: 'center',
    };

    // Taille du texte
    switch (size) {
      case 'small':
        baseStyle.fontSize = theme.fontSizes.SM;
        break;
      case 'large':
        baseStyle.fontSize = theme.fontSizes.LG;
        break;
      default:
        baseStyle.fontSize = theme.fontSizes.MD;
    }

    // Couleur du texte
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        baseStyle.color = disabled ? theme.colors.gray[500] : theme.colors.white;
        break;
      case 'outline':
        baseStyle.color = disabled ? theme.colors.gray[400] : theme.colors.primary;
        break;
      case 'text':
        baseStyle.color = disabled ? theme.colors.gray[400] : theme.colors.primary;
        break;
    }

    return baseStyle;
  };

  const getIconColor = (): string => {
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        return disabled ? theme.colors.gray[500] : theme.colors.white;
      case 'outline':
      case 'text':
        return disabled ? theme.colors.gray[400] : theme.colors.primary;
      default:
        return theme.colors.primary;
    }
  };

  const getIconSize = (): number => {
    switch (size) {
      case 'small':
        return theme.sizes.ICON_SM;
      case 'large':
        return theme.sizes.ICON_LG;
      default:
        return theme.sizes.ICON_MD;
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'small'}
          color={getIconColor()}
        />
      );
    }

    const textComponent = (
      <Text style={[getTextStyle(), textStyle]} numberOfLines={1}>
        {title}
      </Text>
    );

    if (!icon) {
      return textComponent;
    }

    const iconComponent = (
      <Ionicons
        name={icon}
        size={getIconSize()}
        color={getIconColor()}
        style={iconPosition === 'left' ? { marginRight: theme.spacing.SM } : { marginLeft: theme.spacing.SM }}
      />
    );

    return (
      <View style={styles.content}>
        {iconPosition === 'left' && iconComponent}
        {textComponent}
        {iconPosition === 'right' && iconComponent}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      testID={testID}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Button;