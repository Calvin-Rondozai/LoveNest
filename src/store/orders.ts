import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../lib/api';
import { OrderStatus, STATUS_INFO } from '../data/orderStatus';
import { useNotifications } from './notifications';
import { onSignOut } from './auth';

export type OrderItem = { productId: string | null; name: string; price: number; quantity: number };
export type OrderEvent = { status: OrderStatus; at: string; note?: string };
export type PaymentMethod = 'ecocash' | 'onemoney' | 'cod';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/** Order as returned by the LoveNest API. */
export type Order = {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  recipientName: string;
  recipientPhone: string;
  address: string;
  apartment: string;
  city: string;
  instructions: string;
  history: OrderEvent[];
};

export type CheckoutRequest = {
  items: { productId: string; quantity: number }[];
  recipientName: string;
  recipientPhone: string;
  address: string;
  apartment: string;
  city: string;
  instructions: string;
  giftMessage: string;
  paymentMethod: PaymentMethod;
  paymentPhone?: string;
};

type OrdersState = {
  orders: Order[];
  refreshing: boolean;
  /** Places an order. Reusing `idempotencyKey` on retry never creates a duplicate. */
  createOrder: (input: CheckoutRequest, idempotencyKey: string) => Promise<Order>;
  /** Loads the latest orders and notifies the customer about anything that changed. */
  refresh: () => Promise<void>;
  /** Asks the server to re-check a mobile money payment with Paynow. */
  checkPayment: (orderId: string) => Promise<Order>;
  retryPayment: (orderId: string, method: Exclude<PaymentMethod, 'cod'>, phone: string) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<Order>;
};

function notifyChanges(previous: Order | undefined, next: Order) {
  if (!previous) return;
  const push = useNotifications.getState().push;
  if (previous.status !== next.status) {
    const info = STATUS_INFO[next.status];
    const note = [...next.history].reverse().find((h) => h.status === next.status)?.note;
    push({ title: `${info.label}: ${next.orderNumber}`, body: note ? `${info.customerMessage} ${note}` : info.customerMessage, icon: info.icon, target: 'orders' });
  }
  if (previous.paymentStatus !== 'paid' && next.paymentStatus === 'paid' && next.paymentMethod !== 'cod') {
    push({ title: `Payment received: ${next.orderNumber}`, body: `We received US$${next.total.toFixed(2)}. Thank you!`, icon: 'card-outline', target: 'orders' });
  }
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => {
      /** Replaces one order in the list, notifying about changes. */
      const upsert = (next: Order) => {
        const previous = get().orders.find((o) => o.id === next.id);
        notifyChanges(previous, next);
        set((s) => ({ orders: previous ? s.orders.map((o) => (o.id === next.id ? next : o)) : [next, ...s.orders] }));
        return next;
      };

      return {
        orders: [],
        refreshing: false,

        createOrder: async (input, idempotencyKey) => {
          const { order } = await apiRequest<{ order: Order }>('/api/orders', {
            method: 'POST',
            body: input,
            headers: { 'Idempotency-Key': idempotencyKey },
          });
          const placed = upsert(order);
          useNotifications.getState().push({
            title: 'Order placed successfully',
            body: `Your order ${order.orderNumber} (US$${order.total.toFixed(2)}) is placed. We'll keep you updated here.`,
            icon: 'bag-check-outline',
            target: 'orders',
          });
          return placed;
        },

        refresh: async () => {
          if (get().refreshing) return;
          set({ refreshing: true });
          try {
            const { orders } = await apiRequest<{ orders: Order[] }>('/api/orders');
            const previous = new Map(get().orders.map((o) => [o.id, o]));
            orders.forEach((o) => notifyChanges(previous.get(o.id), o));
            set({ orders });
          } finally {
            set({ refreshing: false });
          }
        },

        checkPayment: async (orderId) => {
          const { order } = await apiRequest<{ order: Order }>(`/api/orders/${orderId}/payment`);
          return upsert(order);
        },

        retryPayment: async (orderId, method, phone) => {
          const { order } = await apiRequest<{ order: Order }>(`/api/orders/${orderId}/pay`, {
            method: 'POST',
            body: { paymentMethod: method, paymentPhone: phone },
          });
          return upsert(order);
        },

        cancelOrder: async (orderId) => {
          const { order } = await apiRequest<{ order: Order }>(`/api/orders/${orderId}/cancel`, { method: 'POST' });
          return upsert(order);
        },
      };
    },
    {
      name: 'lovenest.orders',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ orders: s.orders }),
      // Orders from the old on-device demo do not exist on the server.
      migrate: () => ({ orders: [] }),
    },
  ),
);

// Orders are personal data: remove them from the device when the customer signs out.
onSignOut(() => useOrders.setState({ orders: [] }));
