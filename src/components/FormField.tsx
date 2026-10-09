import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, danger } from '../theme';

type Props = {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  error?: string | null;
  icon?: string;
  secure?: boolean;
  editable?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
  onBlur?: () => void;
};

export const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline,
  error,
  icon,
  secure,
  editable = true,
  autoCapitalize,
  autoComplete,
  maxLength,
  onBlur,
}: Props) => {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
          secureTextEntry={secure && hidden}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          maxLength={maxLength}
          onBlur={onBlur}
          autoCorrect={secure || keyboardType === 'email-address' ? false : undefined}
          style={[
            styles.input,
            {
              borderColor: error ? danger : colors.border,
              color: colors.text,
              backgroundColor: editable ? colors.surface : colors.surfaceAlt,
            },
            multiline && styles.multiline,
            icon && styles.withIcon,
            secure && styles.withToggle,
          ]}
        />
        {icon ? (
          <View style={styles.leadingIcon} pointerEvents="none">
            <Icon name={icon} size={18} color={colors.textMuted} />
          </View>
        ) : null}
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} style={styles.toggle}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontSize: font.size.xs, fontFamily: font.sansMedium, marginBottom: spacing.xs },
  inputWrap: { justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: font.size.md,
    fontFamily: font.sans,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  withIcon: { paddingLeft: 42 },
  withToggle: { paddingRight: 44 },
  leadingIcon: { position: 'absolute', left: 14 },
  toggle: { position: 'absolute', right: 14 },
  error: { fontSize: font.size.xs, fontFamily: font.sansMedium, color: danger, marginTop: spacing.xs },
});
