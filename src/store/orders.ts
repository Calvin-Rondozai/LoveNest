import { create } from 'zustand';

export type Order = { orderNumber: string; total: number; placedAt: string; status: 'CONFIRMED' };

type OrdersState = { orders: Order[]; addOrder: (order: Order) => void };

export const useOrders = create<OrdersState>((set) => ({
  orders: [],
  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
}));
