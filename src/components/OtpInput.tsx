import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Animated, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary, danger, success } from '../theme';

export type OtpStatus = 'idle' | 'success' | 'error';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  status?: OtpStatus;
  length?: number;
  disabled?: boolean;
  errorMessage?: string;
};

// One hidden TextInput drives the visible boxes, so paste and SMS autofill
// work natively and backspace never has to jump between inputs.
export const OtpInput = ({ value, onChangeText, status = 'idle', length = 6, disabled, errorMessage = 'Incorrect code, please try again' }: Props) => {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'error') {
      Animated.sequence(
        [10, -10, 8, -8, 4, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true })),
      ).start();
    }
    if (status === 'success') {
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.08, duration: 120, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [status, shake, pop]);

  const boxColors = (index: number) => {
    const filled = index < value.length;
    if (status === 'success') return { border: success, bg: success, text: '#FFFFFF' };
    if (status === 'error') return { border: danger, bg: colors.surface, text: danger };
    const active = focused && !disabled && index === Math.min(value.length, length - 1);
    return { border: active || filled ? primary : colors.border, bg: filled ? colors.surfaceAlt : colors.surface, text: colors.text };
  };

  return (
    <View>
      <Animated.View style={[styles.row, { transform: [{ translateX: shake }, { scale: pop }] }]}>
        {Array.from({ length }, (_, i) => {
          const c = boxColors(i);
          return (
            <View key={i} style={[styles.box, { borderColor: c.border, backgroundColor: c.bg }]}>
              <Text style={[styles.digit, { color: c.text }]}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!disabled}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          autoFocus
          caretHidden
          style={styles.hiddenInput}
        />
      </Animated.View>

      {status === 'success' ? (
        <View style={styles.statusRow}>
          <Icon name="checkmark-circle" size={16} color={success} />
          <Text style={[styles.statusText, { color: success }]}>Code verified</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.statusRow}>
          <Icon name="close-circle" size={16} color={danger} />
          <Text style={[styles.statusText, { color: danger }]}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  box: {
    flex: 1,
    maxWidth: 54,
    aspectRatio: 0.85,
    borderWidth: 1.5,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: font.size.xl, fontFamily: font.sansBold },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md },
  statusText: { fontSize: font.size.sm, fontFamily: font.sansSemi },
});
