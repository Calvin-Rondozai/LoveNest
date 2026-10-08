import { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { useCheckout, PaymentMethod } from '../store/checkout';
import { useCart, cartSubtotal } from '../store/cart';
import { useOrders } from '../store/orders';
import { useNotifications } from '../store/notifications';
import { useToast } from '../store/toast';
import { POLICIES, assertNotLimited, recordAttempt, RateLimitError } from '../utils/rateLimit';
import { deliveryFee } from '../data/catalog';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

const methods: { id: PaymentMethod; label: string; sublabel: string; icon: string }[] = [
  { id: 'ecocash', label: 'Mobile Money', sublabel: 'EcoCash · Telecash', icon: 'phone-portrait-outline' },
  { id: 'cod', label: 'Cash on Delivery', sublabel: 'Pay when you receive', icon: 'cash-outline' },
];

const generateOrderNumber = () => `#LNG${Math.floor(100000 + Math.random() * 900000)}`;

/** Step 4 — the order was already reviewed and confirmed; choosing a method and paying is the last action. */
export const PaymentMethodScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { paymentMethod, update, reset } = useCheckout();
  const { items, clear } = useCart();
  const addOrder = useOrders((s) => s.addOrder);
  const pushNotification = useNotifications((s) => s.push);
  const showToast = useToast((s) => s.show);
  const total = cartSubtotal(items) + deliveryFee;

  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false); // guards double taps before React re-renders

  const pay = async () => {
    if (placingRef.current || items.length === 0) return;
    placingRef.current = true;
    setPlacing(true);
    try {
      await assertNotLimited('order:device');
      await recordAttempt('order:device', POLICIES.placeOrder);
    } catch (e) {
      showToast(e instanceof RateLimitError ? e.message : 'Could not place your order. Please try again.', 4000);
      placingRef.current = false;
      setPlacing(false);
      return;
    }
    // TODO(backend): create the order + start the mobile money payment with an idempotency key,
    // and only show success once the provider confirms the payment.
    const orderNumber = generateOrderNumber();
    addOrder({ orderNumber, total, placedAt: new Date().toISOString(), status: 'CONFIRMED' });
    pushNotification({
      title: 'Order placed successfully',
      body: `Your order ${orderNumber} (US$${total.toFixed(2)}) is confirmed. We'll let you know when it's on its way.`,
      icon: 'bag-check-outline',
      target: 'orders',
    });
    clear();
    reset();
    navigation.reset({ index: 0, routes: [{ name: 'OrderSuccess', params: { orderNumber } }] });
  };

  const amount = `US$${total.toFixed(2)}`;
  const payLabel = placing ? 'Processing…' : paymentMethod === 'cod' ? `Place Order · ${amount}` : `Pay ${amount}`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Payment" step={4} />
      <Text style={[styles.section, { color: colors.text }]}>Choose a payment method</Text>
      <View style={styles.list}>
        {methods.map((m) => {
          const selected = paymentMethod === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => update({ paymentMethod: m.id })}
              disabled={placing}
              style={[
                styles.row,
                { borderColor: selected ? primary : colors.border, backgroundColor: selected ? colors.surfaceAlt : colors.surface },
              ]}
            >
              <Icon name={m.icon} color={colors.text} size={22} />
              <View style={styles.info}>
                <Text style={[styles.label, { color: colors.text }]}>{m.label}</Text>
                <Text style={[styles.sublabel, { color: colors.textMuted }]}>{m.sublabel}</Text>
              </View>
              <View style={[styles.radio, { borderColor: selected ? primary : colors.border }]}>
                {selected && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Amount to pay</Text>
        <Text style={[styles.totalValue, { color: colors.text }]}>{amount}</Text>
      </View>

      <Text style={[styles.secureNote, { color: colors.textMuted }]}>
        {paymentMethod === 'cod'
          ? 'Have the exact amount ready when your gift arrives.'
          : 'You will receive a prompt on your phone to approve the payment.'}
      </Text>
      <View style={styles.spacer} />
      <Button label={payLabel} icon="lock-closed-outline" onPress={pay} disabled={placing} style={styles.button} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { fontSize: font.size.sm, fontFamily: font.sansBold, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
  info: { flex: 1 },
  label: { fontSize: font.size.sm, fontFamily: font.sansBold },
  sublabel: { fontSize: font.size.xs, fontFamily: font.sans },
  radio: { width: 20, height: 20, borderRadius: radii.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: primary },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  totalLabel: { fontSize: font.size.sm, fontFamily: font.sansMedium },
  totalValue: { fontSize: font.size.lg, fontFamily: font.sansBold },
  secureNote: { fontSize: font.size.xs, fontFamily: font.sans, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.lg },
  spacer: { flex: 1 },
  button: { marginHorizontal: spacing.md, marginBottom: spacing.md },
});
