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

/** 0-based position on the happy path (cancelled orders keep the step they reached). */
export const stepIndex = (status: OrderStatus) => ORDER_STEPS.indexOf(status);

export const nextStatus = (status: OrderStatus): OrderStatus | null => {
  const i = stepIndex(status);
  return i >= 0 && i < ORDER_STEPS.length - 1 ? ORDER_STEPS[i + 1] : null;
};
