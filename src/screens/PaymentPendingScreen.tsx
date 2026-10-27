import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { useOrders } from '../store/orders';
import { useCatalog } from '../store/catalog';
import { useToast } from '../store/toast';
import { ApiRequestError } from '../lib/api';
import { formatMerchant, openEcoCashUssd } from '../utils/ecocash';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

/** After EcoCash, the customer uploads a confirmation screenshot. */
export const PaymentPendingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orderId } = useRoute<RouteProp<RootStackParamList, 'PaymentPending'>>().params;
  const { colors } = useTheme();
  const order = useOrders((s) => s.orders.find((o) => o.id === orderId));
  const checkPayment = useOrders((s) => s.checkPayment);
  const uploadProof = useOrders((s) => s.uploadProof);
  const cancelOrder = useOrders((s) => s.cancelOrder);
  const merchant = useCatalog((s) => s.ecocashMerchant);
  const showToast = useToast((s) => s.show);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const status = order?.paymentStatus ?? 'pending';

  useEffect(() => {
    if (status === 'paid' && order) {
      navigation.reset({ index: 0, routes: [{ name: 'OrderSuccess', params: { orderNumber: order.orderNumber } }] });
    }
  }, [status, order, navigation]);

  const goToOrders = () =>
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Orders' } }] }));

  const dial = async () => {
    if (!merchant || !order) return;
    await openEcoCashUssd(merchant, Math.round(order.total * 100));
  };

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Allow photo access to upload the EcoCash screenshot.', 4000);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]?.uri) setLocalUri(result.assets[0].uri);
  };

  const submit = async () => {
    if (!localUri) {
      showToast('Choose a screenshot of the EcoCash confirmation first.', 4000);
      return;
    }
    setBusy(true);
    try {
      await uploadProof(orderId, localUri);
      showToast('Screenshot sent. We will confirm the payment shortly.', 3000);
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : 'Could not upload the screenshot.', 4000);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const confirmCancel = () =>
    Alert.alert('Cancel this order?', 'Your order will be cancelled and nothing will be charged.', [
      { text: 'Keep Order', style: 'cancel' },
      {
        text: 'Cancel Order',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelOrder(orderId);
            showToast('Order cancelled', 3000);
            goToOrders();
          } catch (e) {
            showToast(e instanceof ApiRequestError ? e.message : 'Could not cancel the order.', 4000);
          }
        },
      },
    ]);

  const waiting = status === 'pending_verification';
  const amount = order ? `US$${order.total.toFixed(2)}` : '';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <KeyboardSafe>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Icon name={waiting ? 'time-outline' : 'image-outline'} size={56} color={primary} />
          <Text style={[styles.title, { color: colors.text }]}>
            {waiting ? 'Payment pending verification' : 'Upload your EcoCash screenshot'}
          </Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>
            {waiting
              ? 'We have your screenshot. The shop will confirm the money arrived, then your order is placed.'
              : 'Send the amount to the EcoCash number below. Then upload a screenshot of the confirmation message.'}
          </Text>

          {order && merchant ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.meta, { color: colors.textMuted }]}>Send to</Text>
              <Text style={[styles.value, { color: colors.text }]}>{formatMerchant(merchant)}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>Amount</Text>
              <Text style={[styles.value, { color: colors.text }]}>{amount}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>Reference</Text>
              <Text style={[styles.value, { color: colors.text }]}>{order.orderNumber}</Text>
            </View>
          ) : null}

          {localUri ? <Image source={{ uri: localUri }} style={styles.preview} resizeMode="cover" /> : null}

          {waiting ? (
            <Button label="Check status" icon="refresh" variant="outline" onPress={() => checkPayment(orderId)} style={styles.wide} />
          ) : (
            <>
              <Button label="Open EcoCash again" icon="call-outline" variant="outline" onPress={dial} style={styles.wide} />
              <Button label={localUri ? 'Choose a different screenshot' : 'Choose screenshot'} icon="image-outline" variant="outline" onPress={pick} style={styles.wide} />
              <Button label={busy ? 'Uploading…' : 'Submit screenshot'} onPress={submit} disabled={busy || !localUri} style={styles.wide} />
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button label="View My Orders" variant="outline" icon="" onPress={goToOrders} />
          {order && order.status === 'placed' && status !== 'paid' ? (
            <Pressable onPress={confirmCancel} hitSlop={8} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel Order</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardSafe>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, textAlign: 'center', marginTop: spacing.md },
  message: { fontSize: font.size.sm, fontFamily: font.sans, textAlign: 'center', lineHeight: 21 },
  card: { alignSelf: 'stretch', borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md },
  meta: { fontSize: font.size.xs, fontFamily: font.sansMedium, marginTop: spacing.sm },
  value: { fontSize: font.size.md, fontFamily: font.sansBold },
  preview: { width: '100%', height: 220, borderRadius: radii.md, marginTop: spacing.md },
  wide: { alignSelf: 'stretch', marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  cancel: { alignSelf: 'center', paddingVertical: spacing.sm },
  cancelText: { color: primary, fontFamily: font.sansBold, fontSize: font.size.md },
});
