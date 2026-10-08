import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../context/ThemeContext';
import { Order } from '../store/orders';
import { ORDER_STEPS, STATUS_INFO, stepIndex, OrderStatus } from '../data/orderStatus';
import { font, radii, spacing, primary, success } from '../theme';

export const statusColor = (status: OrderStatus, muted: string) =>
  status === 'delivered' ? success : status === 'cancelled' ? muted : primary;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Compact segmented bar for order lists. */
export const OrderProgressBar = ({ status }: { status: OrderStatus }) => {
  const { colors } = useTheme();
  const reached = stepIndex(status);
  const tint = statusColor(status, colors.textMuted);
  return (
    <View style={styles.bar} accessibilityRole="progressbar" accessibilityLabel={STATUS_INFO[status].label}>
      {ORDER_STEPS.map((step, i) => (
        <View key={step} style={[styles.segment, { backgroundColor: status !== 'cancelled' && i <= reached ? tint : colors.border }]} />
      ))}
    </View>
  );
};

/** Vertical timeline for the order details screen. */
export const OrderTimeline = ({ order }: { order: Order }) => {
  const { colors } = useTheme();
  const cancelled = order.status === 'cancelled';
  // For cancelled orders, show the steps they reached, then the cancellation.
  const reachedSteps = new Set(order.history.map((h) => h.status));
  const steps: OrderStatus[] = cancelled ? [...ORDER_STEPS.filter((s) => reachedSteps.has(s)), 'cancelled'] : ORDER_STEPS;
  const current = cancelled ? steps.length - 1 : stepIndex(order.status);

  return (
    <View>
      {steps.map((step, i) => {
        const done = i <= current;
        const isCurrent = i === current;
        const event = [...order.history].reverse().find((h) => h.status === step);
        const tint = step === 'cancelled' ? colors.textMuted : step === 'delivered' && done ? success : primary;
        const last = i === steps.length - 1;
        return (
          <View key={step} style={styles.stepRow}>
            <View style={styles.rail}>
              <View style={[styles.dot, { borderColor: done ? tint : colors.border, backgroundColor: done ? tint : 'transparent' }]}>
                {done ? <Icon name={step === 'cancelled' ? 'close' : 'checkmark'} size={12} color="#FFFFFF" /> : null}
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: i < current ? tint : colors.border }]} /> : null}
            </View>
            <View style={[styles.stepText, !last && styles.stepGap]}>
              <View style={styles.stepTitleRow}>
                <Icon name={STATUS_INFO[step].icon} size={16} color={done ? tint : colors.textMuted} />
                <Text style={[styles.stepTitle, { color: done ? colors.text : colors.textMuted }, isCurrent && styles.stepTitleCurrent]}>
                  {STATUS_INFO[step].label}
                </Text>
              </View>
              {event ? <Text style={[styles.stepTime, { color: colors.textMuted }]}>{formatTime(event.at)}</Text> : null}
              {event?.note ? <Text style={[styles.stepNote, { color: colors.text }]}>{event.note}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 4, marginTop: spacing.sm },
  segment: { flex: 1, height: 5, borderRadius: radii.pill },
  stepRow: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 24, marginVertical: 2 },
  stepText: { flex: 1, paddingTop: 1 },
  stepGap: { paddingBottom: spacing.md },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepTitle: { fontSize: font.size.sm, fontFamily: font.sansMedium },
  stepTitleCurrent: { fontFamily: font.sansBold },
  stepTime: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: 2 },
  stepNote: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: 4, lineHeight: 18 },
});
