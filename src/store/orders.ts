import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../lib/api';
import { API_URL } from '../config';
import { OrderStatus, PaymentStatus, STATUS_INFO, fulfillmentStarted } from '../data/orderStatus';
import { useNotifications } from './notifications';
import { onSignOut } from './auth';

export type OrderItem = { productId: string | null; name: string; price: number; quantity: number };
export type OrderEvent = { status: OrderStatus; at: string; note?: string };
export type PaymentMethod = 'ecocash';
export type { PaymentStatus };

/** Order as returned by the LoveNest API. */
export type Order = {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  paymentProof: string | null;
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
  checkPayment: (orderId: string) => Promise<Order>;
  uploadProof: (orderId: string, uri: string) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<Order>;
};

function notifyChanges(previous: Order | undefined, next: Order) {
  if (!previous) return;
  const push = useNotifications.getState().push;
  if (previous.status !== next.status && fulfillmentStarted(next)) {
    const info = STATUS_INFO[next.status];
    const note = [...next.history].reverse().find((h) => h.status === next.status)?.note;
    push({ title: `${info.label}: ${next.orderNumber}`, body: note ? `${info.customerMessage} ${note}` : info.customerMessage, icon: info.icon, target: 'orders' });
  }
  if (previous.paymentStatus !== 'paid' && next.paymentStatus === 'paid') {
    push({ title: `Order placed: ${next.orderNumber}`, body: `We received US$${next.total.toFixed(2)}. Your order is placed.`, icon: 'bag-check-outline', target: 'orders' });
  }
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => {
      /** Replaces one order in the list, notifying about changes. */
      const abs = (o: Order): Order => ({
        ...o,
        paymentProof: o.paymentProof && o.paymentProof.startsWith('/') ? `${API_URL}${o.paymentProof}` : o.paymentProof,
      });

      const upsert = (next: Order) => {
        const resolved = abs(next);
        const previous = get().orders.find((o) => o.id === resolved.id);
        notifyChanges(previous, resolved);
        set((s) => ({ orders: previous ? s.orders.map((o) => (o.id === resolved.id ? resolved : o)) : [resolved, ...s.orders] }));
        return resolved;
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
          return upsert(order);
        },

        refresh: async () => {
          if (get().refreshing) return;
          set({ refreshing: true });
          try {
            const { orders } = await apiRequest<{ orders: Order[] }>('/api/orders');
            const previous = new Map(get().orders.map((o) => [o.id, o]));
            const resolved = orders.map(abs);
            resolved.forEach((o) => notifyChanges(previous.get(o.id), o));
            set({ orders: resolved });
          } finally {
            set({ refreshing: false });
          }
        },

        checkPayment: async (orderId) => {
          const { order } = await apiRequest<{ order: Order }>(`/api/orders/${orderId}/payment`);
          return upsert(order);
        },

        uploadProof: async (orderId, uri) => {
          const form = new FormData();
          form.append('image', { uri, name: 'proof.jpg', type: 'image/jpeg' } as unknown as Blob);
          const { order } = await apiRequest<{ order: Order }>(`/api/orders/${orderId}/proof`, { method: 'POST', body: form });
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
