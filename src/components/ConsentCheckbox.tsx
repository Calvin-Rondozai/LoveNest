import { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, primary, onPrimary, danger } from '../theme';

type Props = { checked: boolean; onToggle: () => void; children: ReactNode; error?: string | null };

/** Checkbox with rich label text; nest <Text onPress> inside children for inline links. */
export const ConsentCheckbox = ({ checked, onToggle, children, error }: Props) => {
  const { colors } = useTheme();
  const borderColor = error ? danger : checked ? primary : colors.border;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onToggle}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          style={[styles.box, { borderColor, backgroundColor: checked ? primary : 'transparent' }]}
        >
          {checked && <Icon name="checkmark" size={14} color={onPrimary} />}
        </Pressable>
        <Text style={[styles.text, { color: colors.textMuted }]} onPress={onToggle}>
          {children}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

export const InlineLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Text style={styles.link} onPress={onPress} suppressHighlighting>
    {label}
  </Text>
);

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  text: { flex: 1, fontSize: font.size.xs, fontFamily: font.sans, lineHeight: 19 },
  link: { color: primary, fontFamily: font.sansSemi },
  error: { fontSize: font.size.xs, fontFamily: font.sansMedium, color: danger, marginTop: spacing.xs, marginLeft: 28 },
});
