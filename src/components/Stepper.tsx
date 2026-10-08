import { Fragment } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, primary, onPrimary } from '../theme';

const STEPS = ['Cart', 'Delivery', 'Confirm', 'Payment'];

export const Stepper = ({ current }: { current: number }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.dotsRow}>
        {STEPS.map((label, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          const highlighted = done || active;
          return (
            <Fragment key={label}>
              <View
                style={[
                  styles.dot,
                  { borderColor: highlighted ? primary : colors.border, backgroundColor: highlighted ? primary : colors.surface },
                ]}
              >
                {done ? (
                  <Icon name="checkmark" size={14} color={onPrimary} />
                ) : (
                  <Text style={[styles.dotLabel, { color: active ? onPrimary : colors.textMuted }]}>{step}</Text>
                )}
              </View>
              {step < STEPS.length && <View style={[styles.line, { backgroundColor: done ? primary : colors.border }]} />}
            </Fragment>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {STEPS.map((label, i) => (
          <Text key={label} style={[styles.label, { color: i + 1 === current ? primary : colors.textMuted }]}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  dotsRow: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLabel: { fontSize: font.size.xs, fontFamily: font.sansBold },
  line: { flex: 1, height: 2, marginHorizontal: 4 },
  labelsRow: { flexDirection: 'row', marginTop: spacing.xs },
  label: { flex: 1, fontSize: 10, fontFamily: font.sansMedium, textAlign: 'center' },
});
