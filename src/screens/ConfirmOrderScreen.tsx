import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckoutHeader } from '../components/CheckoutHeader';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { PriceRow } from '../components/PriceRow';
import { InlineLink } from '../components/ConsentCheckbox';
import { useCheckout } from '../store/checkout';
import { useCart, cartSubtotal } from '../store/cart';
import { products, deliveryFee } from '../data/catalog';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary, onPrimary, danger } from '../theme';
import { RootStackParamList } from '../navigation/types';

/** Step 3: review everything and agree to the terms *before* choosing how to pay. */
export const ConfirmOrderScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { recipientName, address, apartment, city, recipientPhone, instructions } = useCheckout();
  const items = useCart((s) => s.items);
  const subtotal = cartSubtotal(items);
  const total = subtotal + deliveryFee;
  const [agreed, setAgreed] = useState(false);
  const [showAgreeError, setShowAgreeError] = useState(false);

  const onContinue = () => {
    if (!agreed) return setShowAgreeError(true);
    navigation.navigate('PaymentMethod');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      <CheckoutHeader title="Confirm Order" step={3} />
      <ScrollView contentContainerStyle={styles.body}>
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
            <Pressable onPress={() => navigation.navigate('Delivery')}>
              <Text style={styles.edit}>Edit</Text>
            </Pressable>
          </View>
          <Text style={[styles.bold, { color: colors.text }]}>{recipientName}</Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {address}
            {apartment ? `, ${apartment}` : ''}
          </Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>{city}</Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>{recipientPhone}</Text>
          {instructions ? <Text style={[styles.muted, { color: colors.textMuted }]}>Instructions: {instructions}</Text> : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Order Total</Text>
          <PriceRow label="Subtotal" value={`US$${subtotal.toFixed(2)}`} />
          <PriceRow label="Delivery Fee" value={`US$${deliveryFee.toFixed(2)}`} />
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
  muted: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: 2 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  agreeText: { flex: 1, fontSize: font.size.xs, fontFamily: font.sans },
  agreeError: { color: danger, fontSize: font.size.xs, fontFamily: font.sansMedium, marginTop: -spacing.xs, marginLeft: 28 },
  button: { marginHorizontal: spacing.md, marginBottom: spacing.md },
});
