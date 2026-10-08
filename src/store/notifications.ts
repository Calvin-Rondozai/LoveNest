import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-app notification centre (bell on Home). When the backend exists, merge
// server-sent updates (order dispatched, delivered…) into `items` the same way.

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  icon: string;
  createdAt: string;
  read: boolean;
  /** Where tapping it should go. */
  target?: 'orders' | 'market';
};

type NotificationsState = {
  items: AppNotification[];
  push: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
};

const MAX_ITEMS = 50;

const welcome: AppNotification = {
  id: 'welcome',
  title: 'Welcome to LoveNest',
  body: 'Browse gifts for every moment and get them delivered with love.',
  icon: 'heart-outline',
  createdAt: new Date().toISOString(),
  read: false,
  target: 'market',
};

export const useNotifications = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [welcome],
      push: (n) =>
        set((s) => ({
          items: [
            { ...n, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), read: false },
            ...s.items,
          ].slice(0, MAX_ITEMS),
        })),
      markRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
      remove: (id) => set((s) => ({ items: s.items.filter((n) => n.id !== id) })),
      clearAll: () => set({ items: [] }),
    }),
    { name: 'lovenest.notifications', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ items: s.items }) },
  ),
);

export const useUnreadCount = () => useNotifications((s) => s.items.filter((n) => !n.read).length);
