import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, primary } from '../theme';

export const PriceRow = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textMuted }, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }, bold && styles.bold]}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  label: { fontSize: font.size.sm, fontFamily: font.sans },
  value: { fontSize: font.size.sm, fontFamily: font.sansSemi },
  bold: { fontSize: font.size.lg, color: primary, fontFamily: font.sansBold },
});
