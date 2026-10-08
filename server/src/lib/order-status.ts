import type { ORDER_STATUSES } from '../db/app-schema.js';

// Order lifecycle. Mirrors src/data/orderStatus.ts (app) and admin/js/orderStatus.js (dashboard).

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STEPS: OrderStatus[] = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Order placed',
  confirmed: 'Confirmed',
  preparing: 'Being prepared',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const isFinal = (s: OrderStatus) => s === 'delivered' || s === 'cancelled';

export const nextStatus = (s: OrderStatus): OrderStatus | null => {
  const i = ORDER_STEPS.indexOf(s);
  return i >= 0 && i < ORDER_STEPS.length - 1 ? ORDER_STEPS[i + 1]! : null;
};

/** Admins may move an order one step forward, or cancel it before delivery. */
export const canTransition = (from: OrderStatus, to: OrderStatus) =>
  !isFinal(from) && (to === 'cancelled' || to === nextStatus(from));
