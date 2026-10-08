import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { radii, spacing, font, primary, onPrimary } from '../theme';

type Variant = 'primary' | 'outline' | 'light' | 'inverseOutline';

const palette: Record<Variant, { bg: string; border?: string; text: string }> = {
  primary: { bg: primary, text: onPrimary },
  outline: { bg: 'transparent', border: primary, text: primary },
  light: { bg: onPrimary, text: primary },
  inverseOutline: { bg: 'transparent', border: onPrimary, text: onPrimary },
};

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: string;
  disabled?: boolean;
  style?: ViewStyle;
};

export const Button = ({ label, onPress, variant = 'primary', icon = 'arrow-forward', disabled, style }: Props) => {
  const colorSet = palette[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        { backgroundColor: colorSet.bg, borderColor: colorSet.border ?? 'transparent', borderWidth: colorSet.border ? 1.5 : 0 },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: colorSet.text }]}>{label}</Text>
      {icon ? <Icon name={icon} size={18} color={colorSet.text} /> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    borderRadius: radii.pill,
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: font.size.md, fontFamily: font.sansBold },
});
