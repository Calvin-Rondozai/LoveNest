import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth, onSignOut } from './auth';
import { useCatalog } from './catalog';
import { useOrders } from './orders';
import { useCart } from './cart';
import { useCheckout } from './checkout';
import { useNotifications } from './notifications';

// Personal data on the device is wiped when the customer signs out or deletes their account.
onSignOut(() => {
  useCart.getState().clear();
  useCheckout.getState().reset();
  useNotifications.getState().clearAll();
});

/**
 * Keeps the app in step with the server: validates the saved session and loads the catalog
 * on launch, and refreshes products and orders whenever the app returns to the foreground.
 * Order status changes made in the admin dashboard become in-app notifications here.
 */
export function useAppSync() {
  const signedIn = useAuth((s) => s.user !== null);

  useEffect(() => {
    useAuth.getState().restoreSession();
    useCatalog.getState().load();
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    useOrders.getState().refresh().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      useCatalog.getState().load();
      useOrders.getState().refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [signedIn]);
}
