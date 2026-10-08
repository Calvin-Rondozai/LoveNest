import { create } from 'zustand';
import { products } from '../data/catalog';

type CartItem = { productId: string; quantity: number };

type CartState = {
  items: CartItem[];
  add: (productId: string) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>((set) => ({
  items: [],
  add: (productId) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === productId);
      if (existing) {
        return { items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i)) };
      }
      return { items: [...state.items, { productId, quantity: 1 }] };
    }),
  increment: (productId) =>
    set((state) => ({ items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i)) })),
  decrement: (productId) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
    })),
  remove: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
  clear: () => set({ items: [] }),
}));

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    return sum + (product ? product.price * i.quantity : 0);
  }, 0);
