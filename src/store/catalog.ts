import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../lib/api';
import { API_URL } from '../config';
import { categories as bundledCategories, products as bundledProducts, deliveryFee as bundledFee, Category, Product } from '../data/catalog';
import { useCart } from './cart';

type ApiProduct = { id: string; name: string; description: string; price: number; categoryId: string; image: string | null; inStock: boolean; stock: number };

type CatalogState = {
  categories: Category[];
  products: Product[];
  deliveryFee: number;
  /** True once the live catalog has loaded at least once. Bundled items cannot be bought. */
  synced: boolean;
  loading: boolean;
  error: string | null;
  loadedAt: number;
  load: (options?: { force?: boolean }) => Promise<void>;
};

const STALE_MS = 2 * 60_000;

export const useCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      categories: bundledCategories,
      products: bundledProducts,
      deliveryFee: bundledFee,
      synced: false,
      loading: false,
      error: null,
      loadedAt: 0,

      load: async ({ force = false } = {}) => {
        if (get().loading) return;
        if (!force && get().synced && Date.now() - get().loadedAt < STALE_MS) return;
        set({ loading: true, error: null });
        try {
          const [config, cats, prods] = await Promise.all([
            apiRequest<{ deliveryFeeCents: number }>('/api/config', { auth: false }),
            apiRequest<{ categories: Category[] }>('/api/categories', { auth: false }),
            apiRequest<{ products: ApiProduct[] }>('/api/products', { auth: false }),
          ]);
          const products: Product[] = prods.products.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            categoryId: p.categoryId,
            // Photos stored by the API come back as /images/<id>; make them absolute.
            image: p.image && p.image.startsWith('/') ? `${API_URL}${p.image}` : p.image,
            inStock: p.inStock,
            stock: p.stock,
          }));
          set({ categories: cats.categories, products, deliveryFee: config.deliveryFeeCents / 100, synced: true, loadedAt: Date.now(), loading: false });
          // Drop cart lines for products that no longer exist (or are bundled placeholders).
          useCart.getState().prune(new Set(products.map((p) => p.id)));
        } catch (e) {
          set({ loading: false, error: e instanceof Error ? e.message : 'Could not load products.' });
        }
      },
    }),
    {
      name: 'lovenest.catalog',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ categories: s.categories, products: s.products, deliveryFee: s.deliveryFee, synced: s.synced, loadedAt: s.loadedAt }),
    },
  ),
);

export const useProduct = (id: string) => useCatalog((s) => s.products.find((p) => p.id === id));

/** Icon for products without a photo: their own icon, else their category's, else a gift. */
export const productIcon = (product: Product, categories: Category[]) => {
  if (product.icon) return { name: product.icon, set: product.iconSet ?? 'ion' };
  const cat = categories.find((c) => c.id === product.categoryId);
  return cat ? { name: cat.icon, set: cat.iconSet } : { name: 'gift-outline', set: 'ion' as const };
};
