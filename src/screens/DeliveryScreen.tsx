import { useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { FormField } from '../components/FormField';
import { PriceRow } from '../components/PriceRow';
import { Button } from '../components/Button';
import { useCheckout } from '../store/checkout';
import { deliveryFee } from '../data/catalog';
import { useTheme } from '../context/ThemeContext';
import { phoneError, isPhoneValid, toE164 } from '../utils/phone';
import { nameError, textError, optionalTextError, sanitize, compactErrors, LIMITS } from '../utils/validation';
import { font, spacing } from '../theme';
import { RootStackParamList } from '../navigation/types';

export const DeliveryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { recipientName, recipientPhone, address, apartment, city, instructions, update } = useCheckout();
  // Show errors only after the first Continue tap, then update them live as the user fixes fields.
  const [submitted, setSubmitted] = useState(false);

  const errors = compactErrors({
    recipientName: nameError(recipientName, "recipient's name"),
    recipientPhone: !recipientPhone.trim()
      ? 'Enter a phone number'
      : (phoneError(recipientPhone) ?? (isPhoneValid(recipientPhone) ? null : 'Enter a complete phone number')),
    address: textError(address, { label: 'an address', min: 5, max: LIMITS.address }),
    apartment: optionalTextError(apartment, LIMITS.apartment),
    city: textError(city, { label: 'a city or town', max: LIMITS.city }),
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
      city: sanitize(city),
      instructions: sanitize(instructions),
    });
    navigation.navigate('ConfirmOrder');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Delivery Details" step={2} />
      <ScrollView contentContainerStyle={styles.body}>
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
        <FormField
          label="City / Town"
          value={city}
          onChangeText={(v) => update({ city: v })}
          placeholder="e.g. Harare"
          autoCapitalize="words"
          maxLength={LIMITS.city}
          error={shown.city}
        />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  section: { fontSize: font.size.sm, fontFamily: font.sansBold, marginBottom: spacing.md, marginTop: spacing.xs },
  button: { marginHorizontal: spacing.md, marginBottom: spacing.md },
});
