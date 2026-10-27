import { useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { useCheckout } from '../store/checkout';
import { useCart, cartSubtotal } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useOrders } from '../store/orders';
import { useToast } from '../store/toast';
import { ApiRequestError } from '../lib/api';
import { deliveryFeeFor } from '../utils/deliveryFee';
import { formatMerchant, openEcoCashUssd } from '../utils/ecocash';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

/** Step 4: send EcoCash, then upload the confirmation screenshot. */
export const PaymentMethodScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const checkout = useCheckout();
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const products = useCatalog((s) => s.products);
  const merchant = useCatalog((s) => s.ecocashMerchant);
  const reloadCatalog = useCatalog((s) => s.load);
  const createOrder = useOrders((s) => s.createOrder);
  const showToast = useToast((s) => s.show);
  const subtotal = cartSubtotal(items, products);
  const deliveryFee = deliveryFeeFor(subtotal);
  const total = subtotal + deliveryFee;

  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);

  const pay = async () => {
    if (placingRef.current || items.length === 0) return;
    if (!merchant) {
      showToast('EcoCash number is not set yet. Please try again shortly.', 4000);
      reloadCatalog({ force: true });
      return;
    }
    placingRef.current = true;
    setPlacing(true);
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
        },
        checkout.idempotencyKey,
      );
      clearCart();
      checkout.reset();
      await openEcoCashUssd(merchant, Math.round(order.total * 100));
      navigation.reset({
        index: 0,
        routes: [{ name: 'PaymentPending', params: { orderId: order.id, method: 'ecocash', phone: '' } }],
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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Payment" step={4} />
      <KeyboardSafe>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.section, { color: colors.text }]}>Pay with EcoCash</Text>
          <View style={[styles.row, { borderColor: primary, backgroundColor: colors.surfaceAlt }]}>
            <Icon name="phone-portrait-outline" color={colors.text} size={22} />
            <View style={styles.info}>
              <Text style={[styles.label, { color: colors.text }]}>Send money</Text>
              <Text style={[styles.sublabel, { color: colors.textMuted }]}>EcoCash will open so you can enter your PIN</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Send to</Text>
            <Text style={[styles.cardValue, { color: colors.text }]}>{merchant ? formatMerchant(merchant) : 'Loading…'}</Text>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Amount</Text>
            <Text style={[styles.cardValue, { color: colors.text }]}>{amount}</Text>
          </View>

          <Text style={[styles.note, { color: colors.textMuted }]}>
            Pay opens EcoCash with this number and amount. After you pay, upload a screenshot of the confirmation. LoveNest never asks for your EcoCash PIN.
          </Text>
        </ScrollView>
        <Button
          label={placing ? 'Opening EcoCash…' : `Pay ${amount}`}
          icon="lock-closed-outline"
          onPress={pay}
          disabled={placing || items.length === 0}
          style={styles.button}
        />
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
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  cardLabel: { fontSize: font.size.xs, fontFamily: font.sansMedium, marginTop: spacing.sm },
  cardValue: { fontSize: font.size.lg, fontFamily: font.sansBold },
  note: { fontSize: font.size.xs, fontFamily: font.sans, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.lg, lineHeight: 18 },
  button: { marginHorizontal: spacing.md, marginBottom: spacing.md },
});
