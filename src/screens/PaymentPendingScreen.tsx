import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { useOrders } from '../store/orders';
import { useToast } from '../store/toast';
import { ApiRequestError } from '../lib/api';
import { toE164 } from '../utils/phone';
import { formatLocal, mobileMoneyError, MOBILE_MONEY_LABEL } from '../utils/mobileMoney';
import { useTheme } from '../context/ThemeContext';
import { font, spacing, primary, success, danger } from '../theme';
import { RootStackParamList } from '../navigation/types';

const POLL_MS = 4000;
const GIVE_UP_MS = 3 * 60_000;

/** Waits for the customer to approve the mobile money prompt, polling the server for the result. */
export const PaymentPendingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { orderId, method, phone } = useRoute<RouteProp<RootStackParamList, 'PaymentPending'>>().params;
  const { colors } = useTheme();
  const order = useOrders((s) => s.orders.find((o) => o.id === orderId));
  const checkPayment = useOrders((s) => s.checkPayment);
  const retryPayment = useOrders((s) => s.retryPayment);
  const cancelOrder = useOrders((s) => s.cancelOrder);
  const showToast = useToast((s) => s.show);

  const [startedAt, setStartedAt] = useState(Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const [number, setNumber] = useState(phone ? formatLocal(phone) : '');
  const [numberError, setNumberError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const status = order?.paymentStatus ?? 'pending';
  const waiting = status === 'pending' && !timedOut;

  // Poll while waiting for approval.
  useEffect(() => {
    if (status !== 'pending' || timedOut) return;
    const id = setInterval(async () => {
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setTimedOut(true);
        return;
      }
      try {
        await checkPayment(orderId);
      } catch {
        // Keep waiting; a temporary network error is not a failed payment.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [status, timedOut, startedAt, orderId, checkPayment]);

  // Paid: show the success screen.
  useEffect(() => {
    if (status === 'paid' && order) {
      navigation.reset({ index: 0, routes: [{ name: 'OrderSuccess', params: { orderNumber: order.orderNumber } }] });
    }
  }, [status, order, navigation]);

  const goToOrders = () =>
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Orders' } }] }));

  const tryAgain = async () => {
    const problem = mobileMoneyError(number);
    setNumberError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await retryPayment(orderId, method, toE164(number) ?? number);
      setTimedOut(false);
      setStartedAt(Date.now());
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : 'Could not start the payment. Please try again.', 4000);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const checkNow = async () => {
    setBusy(true);
    try {
      await checkPayment(orderId);
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : 'Could not check the payment.', 4000);
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

  const failed = status === 'failed';
  const label = MOBILE_MONEY_LABEL[method];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Icon
          name={failed ? 'close-circle-outline' : timedOut ? 'time-outline' : 'phone-portrait-outline'}
          size={64}
          color={failed ? danger : timedOut ? colors.textMuted : primary}
        />
        <Text style={[styles.title, { color: colors.text }]}>
          {failed ? 'Payment not completed' : timedOut ? 'Still waiting for payment' : `Approve on your phone`}
        </Text>
        <Text style={[styles.message, { color: colors.textMuted }]}>
          {failed
            ? order?.paymentError || 'The payment was cancelled or declined.'
            : timedOut
              ? 'We have not received confirmation yet. If you approved the payment, check again in a moment.'
              : `We sent a ${label} prompt to ${phone ? formatLocal(phone) : 'your phone'}. Enter your PIN to pay${order ? ` US$${order.total.toFixed(2)}` : ''}.`}
        </Text>

        {waiting ? (
          <View style={styles.waitingRow}>
            <ActivityIndicator color={primary} />
            <Text style={[styles.waitingText, { color: colors.textMuted }]}>Waiting for confirmation…</Text>
          </View>
        ) : null}

        {order ? (
          <Text style={[styles.orderRef, { color: colors.textMuted }]}>
            Order {order.orderNumber}
            {status === 'paid' ? (
              <Text style={{ color: success }}> · Paid</Text>
            ) : null}
          </Text>
        ) : null}

        {failed ? (
          <View style={styles.retry}>
            <FormField
              label={`${label} number`}
              icon="call-outline"
              value={number}
              onChangeText={(v) => {
                setNumber(v);
                if (numberError) setNumberError(null);
              }}
              keyboardType="phone-pad"
              maxLength={16}
              error={numberError}
            />
            <Button label={busy ? 'Sending prompt…' : 'Try Again'} onPress={tryAgain} disabled={busy} />
          </View>
        ) : null}

        {timedOut && !failed ? <Button label={busy ? 'Checking…' : 'Check Again'} icon="refresh" onPress={checkNow} disabled={busy} style={styles.wide} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="View My Orders" variant="outline" icon="" onPress={goToOrders} />
        {order && order.status === 'placed' && status !== 'paid' ? (
          <Pressable onPress={confirmCancel} hitSlop={8} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel Order</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: font.size.xl, fontFamily: font.sansBold, textAlign: 'center', marginTop: spacing.md },
  message: { fontSize: font.size.sm, fontFamily: font.sans, textAlign: 'center', lineHeight: 21 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  waitingText: { fontSize: font.size.sm, fontFamily: font.sansMedium },
  orderRef: { fontSize: font.size.xs, fontFamily: font.sansSemi, marginTop: spacing.sm },
  retry: { alignSelf: 'stretch', marginTop: spacing.lg },
  wide: { alignSelf: 'stretch', marginTop: spacing.lg },
  footer: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  cancel: { alignSelf: 'center', paddingVertical: spacing.sm },
  cancelText: { color: primary, fontFamily: font.sansBold, fontSize: font.size.md },
});
