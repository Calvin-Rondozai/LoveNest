import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing } from '../theme';

type Props = { label: string; onPress: () => void; loading?: boolean; disabled?: boolean };

export const GoogleButton = ({ label, onPress, loading, disabled }: Props) => {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.surface, borderColor: colors.border },
        (pressed || disabled) && styles.dim,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <Icon name="logo-google" size={18} color="#EA4335" />
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
};

export const OrDivider = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <Text style={[styles.or, { color: colors.textMuted }]}>or</Text>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    minHeight: 54,
  },
  dim: { opacity: 0.6 },
  label: { fontSize: font.size.md, fontFamily: font.sansSemi },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  line: { flex: 1, height: 1 },
  or: { fontSize: font.size.sm, fontFamily: font.sans },
});
