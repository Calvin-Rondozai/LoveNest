import { create } from 'zustand';
import type { Product } from '../data/catalog';

type CartItem = { productId: string; quantity: number };

const MAX_PER_ITEM = 20; // matches the server's checkout limit

type CartState = {
  items: CartItem[];
  add: (productId: string, quantity?: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  /** Removes lines whose product is no longer sold. */
  prune: (validIds: Set<string>) => void;
  clear: () => void;
};

export const useCart = create<CartState>((set) => ({
  items: [],
  add: (productId, quantity = 1) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === productId);
      if (existing) {
        return {
          items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(MAX_PER_ITEM, i.quantity + quantity) } : i)),
        };
      }
      return { items: [...state.items, { productId, quantity: Math.min(MAX_PER_ITEM, quantity) }] };
    }),
  increment: (productId) =>
    set((state) => ({
      items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(MAX_PER_ITEM, i.quantity + 1) } : i)),
    })),
  decrement: (productId) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
    })),
  remove: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
  prune: (validIds) => set((state) => ({ items: state.items.filter((i) => validIds.has(i.productId)) })),
  clear: () => set({ items: [] }),
}));

/** Display subtotal; the server recalculates the real total at checkout. */
export const cartSubtotal = (items: CartItem[], products: Product[]) =>
  items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    return sum + (product ? product.price * i.quantity : 0);
  }, 0);
