import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { PriceRow } from '../components/PriceRow';
import { OrderTimeline, statusColor } from '../components/OrderProgress';
import { useOrders } from '../store/orders';
import { useToast } from '../store/toast';
import { STATUS_INFO } from '../data/orderStatus';
import { ApiRequestError } from '../lib/api';
import { openWhatsApp, WHATSAPP_DISPLAY } from '../utils/whatsapp';
import { useTheme } from '../context/ThemeContext';
import { font, radii, spacing, primary } from '../theme';
import { RootStackParamList } from '../navigation/types';

const PAYMENT_LABEL = { ecocash: 'EcoCash', onemoney: 'OneMoney', cod: 'Cash on Delivery' } as const;
const PAYMENT_STATUS = { pending: 'Awaiting payment', paid: 'Paid', failed: 'Payment failed', refunded: 'Refunded' } as const;

export const OrderDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { orderNumber } = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>().params;
  const order = useOrders((s) => s.orders.find((o) => o.orderNumber === orderNumber));
  const refresh = useOrders((s) => s.refresh);
  const checkPayment = useOrders((s) => s.checkPayment);
  const cancelOrder = useOrders((s) => s.cancelOrder);
  const showToast = useToast((s) => s.show);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      if (order && order.paymentMethod !== 'cod' && order.paymentStatus === 'pending') await checkPayment(order.id);
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.message : 'Could not refresh. Please try again.', 3000);
    } finally {
      setRefreshing(false);
    }
  };

  const confirmCancel = () => {
    if (!order) return;
    Alert.alert('Cancel this order?', 'Your order will be cancelled and nothing will be charged.', [
      { text: 'Keep Order', style: 'cancel' },
      {
        text: 'Cancel Order',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelOrder(order.id);
            showToast('Order cancelled', 3000);
          } catch (e) {
            showToast(e instanceof ApiRequestError ? e.message : 'Could not cancel the order.', 4000);
          }
        },
      },
    ]);
  };

  const contact = async () => {
    if (!(await openWhatsApp(`Hi LoveNest, I have a question about my order ${orderNumber}.`))) {
      showToast(`Couldn't open WhatsApp. Message us on ${WHATSAPP_DISPLAY}`, 4000);
    }
  };

  const header = (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
        <Icon name="arrow-back" color={colors.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Order Details</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!order) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
        {header}
        <View style={styles.missing}>
          <Icon name="alert-circle-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.missingText, { color: colors.textMuted }]}>This order could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const info = STATUS_INFO[order.status];
  const tint = statusColor(order.status, colors.textMuted);
  const lastNote = [...order.history].reverse().find((h) => h.note)?.note;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]} edges={['top']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} colors={[primary]} />}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.orderNumber, { color: colors.textMuted }]}>{order.orderNumber}</Text>
          <View style={styles.statusRow}>
            <Icon name={info.icon} size={26} color={tint} />
            <Text style={[styles.statusTitle, { color: colors.text }]}>{info.label}</Text>
          </View>
          <Text style={[styles.statusMessage, { color: colors.textMuted }]}>{info.customerMessage}</Text>
          {lastNote ? <Text style={[styles.note, { color: colors.text, borderLeftColor: tint }]}>{lastNote}</Text> : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Progress</Text>
          <OrderTimeline order={order} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Items</Text>
          {order.items.map((item) => (
            <View key={item.productId} style={styles.itemRow}>
              <Text style={[styles.itemName, { color: colors.text }]}>
                {item.name} <Text style={{ color: colors.textMuted }}>x{item.quantity}</Text>
              </Text>
              <Text style={[styles.itemPrice, { color: colors.text }]}>US${(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <PriceRow label="Subtotal" value={`US$${order.subtotal.toFixed(2)}`} />
          <PriceRow label="Delivery Fee" value={`US$${order.deliveryFee.toFixed(2)}`} />
          <PriceRow label="Total" value={`US$${order.total.toFixed(2)}`} bold />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Delivery To</Text>
          <Text style={[styles.bold, { color: colors.text }]}>{order.recipientName}</Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {order.address}
            {order.apartment ? `, ${order.apartment}` : ''}, {order.city}
          </Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>{order.recipientPhone}</Text>
          {order.instructions ? <Text style={[styles.muted, { color: colors.textMuted }]}>Instructions: {order.instructions}</Text> : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Payment</Text>
          <View style={styles.itemRow}>
            <Text style={[styles.itemName, { color: colors.text }]}>{PAYMENT_LABEL[order.paymentMethod]}</Text>
            <Text style={[styles.itemPrice, { color: colors.textMuted }]}>
              {order.paymentMethod === 'cod' && order.paymentStatus === 'pending' ? 'Pay on delivery' : PAYMENT_STATUS[order.paymentStatus]}
            </Text>
          </View>
        </View>

        {order.paymentMethod !== 'cod' && order.status !== 'cancelled' && (order.paymentStatus === 'pending' || order.paymentStatus === 'failed') ? (
          <Button
            label="Pay Now"
            icon="lock-closed-outline"
            onPress={() => navigation.navigate('PaymentPending', { orderId: order.id, method: order.paymentMethod as 'ecocash' | 'onemoney', phone: '' })}
          />
        ) : null}

        <Button label="Ask About This Order" icon="logo-whatsapp" variant="outline" onPress={contact} />

        {order.status === 'placed' && order.paymentStatus !== 'paid' ? (
          <Pressable onPress={confirmCancel} style={styles.devButton} hitSlop={8}>
            <Text style={[styles.cancelText]}>Cancel Order</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: font.size.lg, fontFamily: font.sansBold },
  headerSpacer: { width: 22 },
  body: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  orderNumber: { fontSize: font.size.xs, fontFamily: font.sansSemi },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  statusTitle: { fontSize: font.size.xl, fontFamily: font.sansBold },
  statusMessage: { fontSize: font.size.sm, fontFamily: font.sans, marginTop: 2 },
  note: { fontSize: font.size.sm, fontFamily: font.sans, marginTop: spacing.sm, paddingLeft: spacing.sm, borderLeftWidth: 3, lineHeight: 20 },
  cardTitle: { fontSize: font.size.sm, fontFamily: font.sansBold, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs, gap: spacing.sm },
  itemName: { flex: 1, fontSize: font.size.sm, fontFamily: font.sans },
  itemPrice: { fontSize: font.size.sm, fontFamily: font.sansSemi },
  divider: { height: 1, marginVertical: spacing.sm },
  bold: { fontSize: font.size.sm, fontFamily: font.sansBold },
  muted: { fontSize: font.size.xs, fontFamily: font.sans, marginTop: 2 },
  devButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  devText: { fontSize: font.size.xs, fontFamily: font.sansMedium },
  cancelText: { color: primary, fontSize: font.size.md, fontFamily: font.sansBold },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  missingText: { fontSize: font.size.sm, fontFamily: font.sans },
});
