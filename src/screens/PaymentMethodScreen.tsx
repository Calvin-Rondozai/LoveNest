import { useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { useCheckout } from '../store/checkout';
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

/** Step 4: pay with EcoCash. The order was reviewed and confirmed in the previous step. */
export const PaymentMethodScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const checkout = useCheckout();
  const { paymentPhone, update } = checkout;
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

  const pay = async () => {
    if (placingRef.current || items.length === 0) return;
    const problem = mobileMoneyError(paymentPhone);
    setPhoneError(problem);
    if (problem) return;
    placingRef.current = true;
    setPlacing(true);
    const payerPhone = toE164(paymentPhone) ?? paymentPhone;
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
          paymentMethod: 'ecocash',
          paymentPhone: payerPhone,
        },
        checkout.idempotencyKey,
      );
      clearCart();
      checkout.reset();
      navigation.reset({
        index: 0,
        routes: [{ name: 'PaymentPending', params: { orderId: order.id, method: 'ecocash', phone: payerPhone } }],
      });
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
  const payLabel = placing ? 'Placing order…' : `Pay ${amount}`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Payment" step={4} />
      <KeyboardSafe>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={[styles.section, { color: colors.text }]}>Pay with EcoCash</Text>
        <View style={[styles.row, { borderColor: primary, backgroundColor: colors.surfaceAlt }]}>
          <Icon name="phone-portrait-outline" color={colors.text} size={22} />
          <View style={styles.info}>
            <Text style={[styles.label, { color: colors.text }]}>EcoCash</Text>
            <Text style={[styles.sublabel, { color: colors.textMuted }]}>Approve with your EcoCash PIN</Text>
          </View>
        </View>

        <View style={styles.phone}>
          <FormField
            label="EcoCash number"
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

        <View style={[styles.totalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Amount to pay</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>{amount}</Text>
        </View>

        <Text style={[styles.note, { color: colors.textMuted }]}>
          You will get a prompt on this number. Enter your PIN to approve the payment. Payments are processed securely by Paynow.
        </Text>
      </ScrollView>
      <Button label={payLabel} icon="lock-closed-outline" onPress={pay} disabled={placing || items.length === 0} style={styles.button} />
      </KeyboardSafe>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingBottom: spacing.lg },
  section: { fontSize: font.size.sm, fontFamily: font.sansBold, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
  },
  info: { flex: 1 },
  label: { fontSize: font.size.sm, fontFamily: font.sansBold },
  sublabel: { fontSize: font.size.xs, fontFamily: font.sans },
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
