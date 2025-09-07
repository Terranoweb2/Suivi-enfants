import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  testID?: string;
}

const Input = forwardRef<TextInput, InputProps>(({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  secureTextEntry = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  variant = 'outlined',
  size = 'medium',
  testID,
  ...props
}, ref) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      marginBottom: theme.spacing.MD,
    };

    return baseStyle;
  };

  const getInputContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.sizes.BORDER_RADIUS,
      borderWidth: variant === 'outlined' ? 1 : 0,
    };

    // Taille
    switch (size) {
      case 'small':
        baseStyle.height = theme.sizes.BUTTON_HEIGHT_SM;
        baseStyle.paddingHorizontal = theme.spacing.SM;
        break;
      case 'large':
        baseStyle.height = theme.sizes.BUTTON_HEIGHT_LG;
        baseStyle.paddingHorizontal = theme.spacing.LG;
        break;
      default:
        baseStyle.height = theme.sizes.BUTTON_HEIGHT;
        baseStyle.paddingHorizontal = theme.spacing.MD;
    }

    // Variante et état
    if (disabled) {
      baseStyle.backgroundColor = theme.colors.gray[100];
      baseStyle.borderColor = theme.colors.gray[200];
    } else if (error) {
      baseStyle.backgroundColor = variant === 'filled' ? theme.colors.gray[50] : 'transparent';
      baseStyle.borderColor = theme.colors.error;
    } else if (isFocused) {
      baseStyle.backgroundColor = variant === 'filled' ? theme.colors.gray[50] : 'transparent';
      baseStyle.borderColor = theme.colors.primary;
    } else {
      baseStyle.backgroundColor = variant === 'filled' ? theme.colors.gray[50] : 'transparent';
      baseStyle.borderColor = theme.colors.border;
    }

    return baseStyle;
  };

  const getInputStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      flex: 1,
      fontFamily: theme.fonts.REGULAR,
      color: disabled ? theme.colors.gray[400] : theme.colors.text,
      paddingHorizontal: 0,
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

    // Espacement pour les icônes
    if (leftIcon) {
      baseStyle.marginLeft = theme.spacing.SM;
    }
    if (rightIcon || secureTextEntry) {
      baseStyle.marginRight = theme.spacing.SM;
    }

    return baseStyle;
  };

  const getLabelStyle = (): TextStyle => {
    return {
      fontFamily: theme.fonts.MEDIUM,
      fontSize: theme.fontSizes.SM,
      color: theme.colors.text,
      marginBottom: theme.spacing.XS,
    };
  };

  const getErrorStyle = (): TextStyle => {
    return {
      fontFamily: theme.fonts.REGULAR,
      fontSize: theme.fontSizes.XS,
      color: theme.colors.error,
      marginTop: theme.spacing.XS,
    };
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

  const getIconColor = (): string => {
    if (disabled) return theme.colors.gray[400];
    if (error) return theme.colors.error;
    if (isFocused) return theme.colors.primary;
    return theme.colors.gray[500];
  };

  const handleTogglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const renderRightIcon = () => {
    if (secureTextEntry) {
      return (
        <TouchableOpacity
          onPress={handleTogglePasswordVisibility}
          style={styles.iconContainer}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isPasswordVisible ? 'eye-off' : 'eye'}
            size={getIconSize()}
            color={getIconColor()}
          />
        </TouchableOpacity>
      );
    }

    if (rightIcon) {
      return (
        <TouchableOpacity
          onPress={onRightIconPress}
          style={styles.iconContainer}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={!onRightIconPress}
        >
          <Ionicons
            name={rightIcon}
            size={getIconSize()}
            color={getIconColor()}
          />
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <View style={[getContainerStyle(), containerStyle]}>
      {label && (
        <Text style={[getLabelStyle(), labelStyle]}>
          {label}
        </Text>
      )}
      
      <View style={getInputContainerStyle()}>
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={getIconSize()}
            color={getIconColor()}
            style={styles.leftIcon}
          />
        )}
        
        <TextInput
          ref={ref}
          style={[getInputStyle(), inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.gray[400]}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          testID={testID}
          {...props}
        />
        
        {renderRightIcon()}
      </View>
      
      {error && (
        <Text style={[getErrorStyle(), errorStyle]}>
          {error}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  iconContainer: {
    padding: 2,
  },
  leftIcon: {
    marginRight: 8,
  },
});

Input.displayName = 'Input';

export default Input;