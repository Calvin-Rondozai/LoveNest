import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { PriceRow } from '../components/PriceRow';
import { InlineLink } from '../components/ConsentCheckbox';
import { DELIVERY_CITY, useCheckout } from '../store/checkout';
import { useCart, cartSubtotal } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useTheme } from '../context/ThemeContext';
import { phoneError, isPhoneValid, toE164 } from '../utils/phone';
import { deliveryFeeFor } from '../utils/deliveryFee';
import { nameError, textError, optionalTextError, sanitize, compactErrors, LIMITS } from '../utils/validation';
import { font, radii, spacing, primary, onPrimary, danger } from '../theme';
import { RootStackParamList } from '../navigation/types';

/** Step 3: review everything (delivery is editable here) and agree before paying. */
export const ConfirmOrderScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const checkout = useCheckout();
  const { recipientName, address, city, recipientPhone, instructions, update } = checkout;
  const items = useCart((s) => s.items);
  const products = useCatalog((s) => s.products);
  const subtotal = cartSubtotal(items, products);
  const deliveryFee = deliveryFeeFor(subtotal);
  const total = subtotal + deliveryFee;
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [showAgreeError, setShowAgreeError] = useState(false);

  const saveDeliveryEdits = () => {
    const next = compactErrors({
      recipientName: nameError(recipientName, "recipient's name"),
      recipientPhone: !recipientPhone.trim()
        ? 'Enter a phone number'
        : (phoneError(recipientPhone) ?? (isPhoneValid(recipientPhone) ? null : 'Enter a complete phone number')),
      address: textError(address, { label: 'an address', min: 5, max: LIMITS.address }),
      instructions: optionalTextError(instructions, LIMITS.instructions),
    });
    setFieldErrors(next);
    if (Object.keys(next).length) return false;
    update({
      recipientName: sanitize(recipientName),
      recipientPhone: toE164(recipientPhone) ?? recipientPhone,
      address: sanitize(address),
      apartment: '',
      city: DELIVERY_CITY,
      instructions: sanitize(instructions),
    });
    setEditingDelivery(false);
    return true;
  };

  const onContinue = () => {
    if (editingDelivery && !saveDeliveryEdits()) return;
    if (!agreed) return setShowAgreeError(true);
    navigation.navigate('PaymentMethod');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Confirm Order" step={3} />
      <KeyboardSafe>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Items ({items.length})</Text>
            <Pressable onPress={() => navigation.navigate('Cart')}>
              <Text style={styles.edit}>Edit</Text>
            </Pressable>
          </View>
          {items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            if (!product) return null;
            return (
              <View key={item.productId} style={styles.itemRow}>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {product.name} <Text style={{ color: colors.textMuted }}>x{item.quantity}</Text>
                </Text>
                <Text style={[styles.itemPrice, { color: colors.text }]}>US${(product.price * item.quantity).toFixed(2)}</Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Delivery To</Text>
            <Pressable
              onPress={() => {
                if (editingDelivery) saveDeliveryEdits();
                else setEditingDelivery(true);
              }}
            >
              <Text style={styles.edit}>{editingDelivery ? 'Done' : 'Edit'}</Text>
            </Pressable>
          </View>

          {editingDelivery ? (
            <View>
              <FormField
                label="Full Name"
                value={recipientName}
                onChangeText={(v) => update({ recipientName: v })}
                autoCapitalize="words"
                maxLength={LIMITS.name}
                error={fieldErrors.recipientName}
              />
              <FormField
                label="Phone Number"
                value={recipientPhone}
                onChangeText={(v) => update({ recipientPhone: v })}
                keyboardType="phone-pad"
                maxLength={20}
                error={fieldErrors.recipientPhone}
              />
              <FormField
                label="Address"
                value={address}
                onChangeText={(v) => update({ address: v })}
                maxLength={LIMITS.address}
                error={fieldErrors.address}
              />
              <Text style={[styles.muted, { color: colors.textMuted }]}>City: {city || DELIVERY_CITY}</Text>
              <FormField
                label="Delivery Instructions (Optional)"
                value={instructions}
                onChangeText={(v) => update({ instructions: v })}
                multiline
                maxLength={LIMITS.instructions}
                error={fieldErrors.instructions}
              />
            </View>
          ) : (
            <>
              <Text style={[styles.bold, { color: colors.text }]}>{recipientName}</Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>{address}</Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>{city || DELIVERY_CITY}</Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>{recipientPhone}</Text>
              {instructions ? <Text style={[styles.muted, { color: colors.textMuted }]}>Instructions: {instructions}</Text> : null}
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Order Total</Text>
          <PriceRow label="Subtotal" value={`US$${subtotal.toFixed(2)}`} />
          <PriceRow
            label={subtotal < 50 ? 'Delivery Fee (under US$50)' : 'Delivery Fee (US$50+)'}
            value={`US$${deliveryFee.toFixed(2)}`}
          />
          <PriceRow label="Total Amount" value={`US$${total.toFixed(2)}`} bold />
        </View>

        <Pressable
          style={styles.agreeRow}
          onPress={() => {
            setAgreed((a) => !a);
            setShowAgreeError(false);
          }}
        >
          <View
            style={[
              styles.checkbox,
              { borderColor: showAgreeError ? danger : agreed ? primary : colors.border, backgroundColor: agreed ? primary : 'transparent' },
            ]}
          >
            {agreed && <Icon name="checkmark" size={14} color={onPrimary} />}
          </View>
          <Text style={[styles.agreeText, { color: colors.textMuted }]}>
            I have reviewed my order and agree to the{' '}
            <InlineLink label="Terms of Use" onPress={() => navigation.navigate('Legal', { doc: 'terms' })} /> and{' '}
            <InlineLink label="Returns & Refunds Policy" onPress={() => navigation.navigate('Legal', { doc: 'refunds' })} />.
          </Text>
        </Pressable>
        {showAgreeError ? <Text style={styles.agreeError}>Please confirm your order details to continue</Text> : null}
      </ScrollView>
      <Button label="Confirm & Continue to Payment" onPress={onContinue} style={styles.button} />
      </KeyboardSafe>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  card: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  cardTitle: { fontSize: font.size.sm, fontFamily: font.sansBold, marginBottom: spacing.xs },
  edit: { color: primary, fontFamily: font.sansSemi, fontSize: font.size.xs },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  itemName: { flex: 1, fontSize: font.size.sm, fontFamily: font.sans },
  itemPrice: { fontSize: font.size.sm, fontFamily: font.sansSemi },
  bold: { fontSize: font.size.sm, fontFamily: font.sansBold },
  muted: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: 2, marginBottom: spacing.sm },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  agreeText: { flex: 1, fontSize: font.size.xs, fontFamily: font.sans },
  agreeError: { color: danger, fontSize: font.size.xs, fontFamily: font.sansMedium, marginTop: -spacing.xs, marginLeft: 28 },
  button: { marginHorizontal: spacing.md, marginBottom: spacing.md },
});
