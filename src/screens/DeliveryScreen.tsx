import { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { FormField } from '../components/FormField';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { PriceRow } from '../components/PriceRow';
import { Button } from '../components/Button';
import { DELIVERY_CITY, useCheckout } from '../store/checkout';
import { useAuth } from '../store/auth';
import { useCart, cartSubtotal } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useTheme } from '../context/ThemeContext';
import { phoneError, isPhoneValid, toE164 } from '../utils/phone';
import { formatLocal } from '../utils/mobileMoney';
import { deliveryFeeFor } from '../utils/deliveryFee';
import { nameError, textError, optionalTextError, sanitize, compactErrors, LIMITS } from '../utils/validation';
import { font, radii, spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';

export const DeliveryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const items = useCart((s) => s.items);
  const products = useCatalog((s) => s.products);
  const deliveryFee = deliveryFeeFor(cartSubtotal(items, products));
  const { recipientName, recipientPhone, address, apartment, instructions, update } = useCheckout();
  // Prefill recipient from the signed-in account once; the customer can still edit.
  useEffect(() => {
    if (!user) return;
    const patch: { recipientName?: string; recipientPhone?: string } = {};
    if (!recipientName.trim() && user.name) patch.recipientName = user.name;
    if (!recipientPhone.trim() && user.phone) patch.recipientPhone = formatLocal(user.phone);
    if (Object.keys(patch).length) update(patch);
    // Only on first open of this checkout draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  // Show errors only after the first Continue tap, then update them live as the user fixes fields.
  const [submitted, setSubmitted] = useState(false);

  const errors = compactErrors({
    recipientName: nameError(recipientName, "recipient's name"),
    recipientPhone: !recipientPhone.trim()
      ? 'Enter a phone number'
      : (phoneError(recipientPhone) ?? (isPhoneValid(recipientPhone) ? null : 'Enter a complete phone number')),
    address: textError(address, { label: 'an address', min: 5, max: LIMITS.address }),
    apartment: optionalTextError(apartment, LIMITS.apartment),
    instructions: optionalTextError(instructions, LIMITS.instructions),
  });
  // Typing-time hints (e.g. too many phone digits) show before submit too.
  const shown = submitted ? errors : { recipientPhone: phoneError(recipientPhone) ?? undefined };

  const onContinue = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    update({
      recipientName: sanitize(recipientName),
      recipientPhone: toE164(recipientPhone),
      address: sanitize(address),
      apartment: sanitize(apartment),
      city: DELIVERY_CITY,
      instructions: sanitize(instructions),
    });
    navigation.navigate('ConfirmOrder');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Delivery Details" step={2} />
      <KeyboardSafe>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={[styles.section, { color: colors.text }]}>Recipient Information</Text>
        <FormField
          label="Full Name"
          value={recipientName}
          onChangeText={(v) => update({ recipientName: v })}
          placeholder="Recipient's name"
          autoCapitalize="words"
          maxLength={LIMITS.name}
          error={shown.recipientName}
        />
        <FormField
          label="Phone Number"
          value={recipientPhone}
          onChangeText={(v) => update({ recipientPhone: v })}
          placeholder="0771 234 567 or +263 77 123 4567"
          keyboardType="phone-pad"
          maxLength={20}
          error={shown.recipientPhone}
        />

        <Text style={[styles.section, { color: colors.text }]}>Delivery Address</Text>
        <FormField
          label="Address"
          value={address}
          onChangeText={(v) => update({ address: v })}
          placeholder="Street address"
          maxLength={LIMITS.address}
          error={shown.address}
        />
        <FormField
          label="Apartment / Suite (Optional)"
          value={apartment}
          onChangeText={(v) => update({ apartment: v })}
          placeholder="House / suite no."
          maxLength={LIMITS.apartment}
          error={shown.apartment}
        />
        <View style={[styles.cityNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cityLabel, { color: colors.textMuted }]}>City</Text>
          <Text style={[styles.cityValue, { color: colors.text }]}>{DELIVERY_CITY}</Text>
          <Text style={[styles.cityHint, { color: colors.textMuted }]}>Delivery is currently available in Mutare only.</Text>
        </View>
        <FormField
          label={`Delivery Instructions (Optional) · ${instructions.length}/${LIMITS.instructions}`}
          value={instructions}
          onChangeText={(v) => update({ instructions: v })}
          placeholder="Any notes for the driver"
          multiline
          maxLength={LIMITS.instructions}
          error={shown.instructions}
        />

        <PriceRow label="Delivery Fee" value={`US$${deliveryFee.toFixed(2)}`} />
      </ScrollView>
      <Button label="Review Order" onPress={onContinue} style={styles.button} />
      </KeyboardSafe>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  section: { fontSize: font.size.sm, fontFamily: font.sansBold, marginBottom: spacing.md, marginTop: spacing.xs },
  cityNote: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cityLabel: { fontSize: font.size.xs, fontFamily: font.sansMedium, marginBottom: 4 },
  cityValue: { fontSize: font.size.sm, fontFamily: font.sansBold },
  cityHint: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: 4, lineHeight: 16 },
  button: { marginHorizontal: spacing.md, marginBottom: spacing.md },
});
