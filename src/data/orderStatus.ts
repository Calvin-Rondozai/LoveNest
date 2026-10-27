// Order lifecycle shared by the app, the admin dashboard (admin/js/orderStatus.js)
// and, later, the server. Keep all three in sync.

export type OrderStatus = 'placed' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

/** The happy path, in order. `cancelled` can be reached from any step before delivery. */
export const ORDER_STEPS: OrderStatus[] = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

export const STATUS_INFO: Record<OrderStatus, { label: string; icon: string; customerMessage: string }> = {
  placed: { label: 'Order placed', icon: 'receipt-outline', customerMessage: 'We have received your order.' },
  confirmed: { label: 'Confirmed', icon: 'checkmark-circle-outline', customerMessage: 'Your order is confirmed.' },
  preparing: { label: 'Being prepared', icon: 'gift-outline', customerMessage: 'We are preparing and wrapping your gift.' },
  out_for_delivery: { label: 'Out for delivery', icon: 'bicycle-outline', customerMessage: 'Your gift is on its way.' },
  delivered: { label: 'Delivered', icon: 'home-outline', customerMessage: 'Your gift has been delivered.' },
  cancelled: { label: 'Cancelled', icon: 'close-circle-outline', customerMessage: 'Your order was cancelled.' },
};

export const isFinal = (status: OrderStatus) => status === 'delivered' || status === 'cancelled';

export type PaymentStatus = 'pending' | 'pending_verification' | 'paid' | 'failed' | 'refunded';

type StatusView = { status: OrderStatus; paymentStatus: PaymentStatus };

/** Payment must succeed before the shop treats the order as placed. */
export const fulfillmentStarted = (order: StatusView) =>
  order.status !== 'placed' || order.paymentStatus === 'paid' || order.paymentStatus === 'refunded';

/** Customer-facing label. Unpaid and failed checkouts are not "Order placed". */
export const customerStatus = (order: StatusView) => {
  if (order.status === 'cancelled') return STATUS_INFO.cancelled;
  if (order.status === 'placed' && order.paymentStatus === 'pending') {
    return {
      label: 'Awaiting payment',
      icon: 'time-outline',
      customerMessage: 'Send the EcoCash amount shown, then upload a screenshot of the confirmation.',
    };
  }
  if (order.status === 'placed' && order.paymentStatus === 'pending_verification') {
    return {
      label: 'Payment pending verification',
      icon: 'time-outline',
      customerMessage: 'We received your screenshot and are checking that the EcoCash payment arrived.',
    };
  }
  if (order.status === 'placed' && order.paymentStatus === 'failed') {
    return {
      label: 'Payment failed',
      icon: 'close-circle-outline',
      customerMessage: 'Payment was not completed, so this order is not placed. You can try paying again or cancel.',
    };
  }
  return STATUS_INFO[order.status];
};

/** 0-based position on the happy path (cancelled orders keep the step they reached). */
export const stepIndex = (status: OrderStatus) => ORDER_STEPS.indexOf(status);

/** Progress before payment succeeds is empty so "Order placed" is not marked done. */
export const progressIndex = (order: StatusView) => {
  if (order.status === 'cancelled') return -1;
  if (!fulfillmentStarted(order)) return -1;
  return stepIndex(order.status);
};

export const nextStatus = (status: OrderStatus): OrderStatus | null => {
  const i = stepIndex(status);
  return i >= 0 && i < ORDER_STEPS.length - 1 ? ORDER_STEPS[i + 1] : null;
};
