import { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { useCheckout, PaymentMethod } from '../store/checkout';
import { useCart, cartSubtotal } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useOrders } from '../store/orders';
import { useToast } from '../store/toast';
import { ApiRequestError } from '../lib/api';
import { toE164 } from '../utils/phone';
import { mobileMoneyError } from '../utils/mobileMoney';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

const methods: { id: PaymentMethod; label: string; sublabel: string; icon: string }[] = [
  { id: 'ecocash', label: 'EcoCash', sublabel: 'Approve with your EcoCash PIN', icon: 'phone-portrait-outline' },
  { id: 'onemoney', label: 'OneMoney', sublabel: 'Approve with your OneMoney PIN', icon: 'phone-portrait-outline' },
  { id: 'cod', label: 'Cash on Delivery', sublabel: 'Pay when your gift arrives', icon: 'cash-outline' },
];

/** Step 4: the order was reviewed and confirmed; choosing a method and paying is the last action. */
export const PaymentMethodScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const checkout = useCheckout();
  const { paymentMethod, paymentPhone, update } = checkout;
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const products = useCatalog((s) => s.products);
  const deliveryFee = useCatalog((s) => s.deliveryFee);
  const reloadCatalog = useCatalog((s) => s.load);
  const createOrder = useOrders((s) => s.createOrder);
  const showToast = useToast((s) => s.show);
  const total = cartSubtotal(items, products) + deliveryFee;

  const [placing, setPlacing] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const placingRef = useRef(false); // guards double taps before React re-renders
  const mobile = paymentMethod !== 'cod';

  const pay = async () => {
    if (placingRef.current || items.length === 0) return;
    if (mobile) {
      const problem = mobileMoneyError(paymentPhone);
      setPhoneError(problem);
      if (problem) return;
    }
    placingRef.current = true;
    setPlacing(true);
    const payerPhone = mobile ? (toE164(paymentPhone) ?? paymentPhone) : undefined;
    try {
      const order = await createOrder(
        {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          recipientName: checkout.recipientName,
          recipientPhone: checkout.recipientPhone,
          address: checkout.address,
          apartment: checkout.apartment,
          city: checkout.city,
          instructions: checkout.instructions,
          giftMessage: checkout.giftMessage,
          paymentMethod,
          ...(payerPhone ? { paymentPhone: payerPhone } : {}),
        },
        checkout.idempotencyKey,
      );
      clearCart();
      checkout.reset();
      if (order.paymentMethod === 'cod') {
        navigation.reset({ index: 0, routes: [{ name: 'OrderSuccess', params: { orderNumber: order.orderNumber } }] });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'PaymentPending', params: { orderId: order.id, method: order.paymentMethod, phone: payerPhone ?? '' } }],
        });
      }
    } catch (e) {
      placingRef.current = false;
      setPlacing(false);
      if (!(e instanceof ApiRequestError)) {
        showToast('Could not place your order. Please try again.', 4000);
        return;
      }
      if (e.code === 'out_of_stock' || e.code === 'product_unavailable') {
        reloadCatalog({ force: true });
        showToast(e.message, 4000);
        navigation.navigate('Cart');
      } else if (e.fields?.paymentPhone) {
        setPhoneError(e.fields.paymentPhone);
      } else if (e.fields) {
        showToast(`${Object.values(e.fields)[0]} Please check your delivery details.`, 4000);
        navigation.navigate('Delivery');
      } else if (e.code === 'unauthorized') {
        showToast('Please sign in again to place your order.', 4000);
      } else {
        showToast(e.message, 4000);
      }
    }
  };

  const amount = `US$${total.toFixed(2)}`;
  const payLabel = placing ? 'Placing order…' : mobile ? `Pay ${amount}` : `Place Order · ${amount}`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Payment" step={4} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, { color: colors.text }]}>Choose a payment method</Text>
        <View style={styles.list}>
          {methods.map((m) => {
            const selected = paymentMethod === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => update({ paymentMethod: m.id })}
                disabled={placing}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.row, { borderColor: selected ? primary : colors.border, backgroundColor: selected ? colors.surfaceAlt : colors.surface }]}
              >
                <Icon name={m.icon} color={colors.text} size={22} />
                <View style={styles.info}>
                  <Text style={[styles.label, { color: colors.text }]}>{m.label}</Text>
                  <Text style={[styles.sublabel, { color: colors.textMuted }]}>{m.sublabel}</Text>
                </View>
                <View style={[styles.radio, { borderColor: selected ? primary : colors.border }]}>{selected && <View style={styles.radioDot} />}</View>
              </Pressable>
            );
          })}
        </View>

        {mobile ? (
          <View style={styles.phone}>
            <FormField
              label={`${paymentMethod === 'ecocash' ? 'EcoCash' : 'OneMoney'} number`}
              icon="call-outline"
              value={paymentPhone}
              onChangeText={(v) => {
                update({ paymentPhone: v });
                if (phoneError) setPhoneError(null);
              }}
              placeholder="0771 234 567"
              keyboardType="phone-pad"
              maxLength={16}
              error={phoneError}
            />
          </View>
        ) : null}

        <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Amount to pay</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>{amount}</Text>
        </View>

        <Text style={[styles.note, { color: colors.textMuted }]}>
          {mobile
            ? 'You will get a prompt on this number. Enter your PIN to approve the payment. Payments are processed securely by Paynow.'
            : 'Have the exact amount ready when your gift arrives.'}
        </Text>
      </ScrollView>
      <Button label={payLabel} icon="lock-closed-outline" onPress={pay} disabled={placing || items.length === 0} style={styles.button} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingBottom: spacing.lg },
  section: { fontSize: font.size.sm, fontFamily: font.sansBold, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
  info: { flex: 1 },
  label: { fontSize: font.size.sm, fontFamily: font.sansBold },
  sublabel: { fontSize: font.size.xs, fontFamily: font.sans },
  radio: { width: 20, height: 20, borderRadius: radii.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: primary },
  phone: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  totalLabel: { fontSize: font.size.sm, fontFamily: font.sansMedium },
  totalValue: { fontSize: font.size.lg, fontFamily: font.sansBold },
  note: { fontSize: font.size.xs, fontFamily: font.sans, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.lg, lineHeight: 18 },
  button: { marginHorizontal: spacing.md, marginBottom: spacing.md },
});
