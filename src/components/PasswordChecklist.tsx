import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { passwordChecks } from '../utils/validation';
import { font, spacing, success } from '../theme';

/** Live password requirements shown under a new-password field. */
export const PasswordChecklist = ({ password }: { password: string }) => {
  const { colors } = useTheme();
  if (!password) return null;
  return (
    <View style={styles.wrap}>
      {passwordChecks(password).map((c) => (
        <View key={c.label} style={styles.row}>
          <Icon name={c.met ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={c.met ? success : colors.textMuted} />
          <Text style={[styles.text, { color: c.met ? success : colors.textMuted }]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 2, marginTop: -spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: font.size.xs, fontFamily: font.sansMedium },
});
