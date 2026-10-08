import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { useOnboarding } from './onboarding';
import { useNotifications } from './notifications';

const stores = [useAuth, useOnboarding, useNotifications];

/** True once every persisted store has loaded from AsyncStorage, so the first screen is the right one. */
export const useStoresHydrated = () => {
  const [hydrated, setHydrated] = useState(() => stores.every((s) => s.persist.hasHydrated()));

  useEffect(() => {
    if (hydrated) return;
    const check = () => setHydrated(stores.every((s) => s.persist.hasHydrated()));
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, [hydrated]);

  return hydrated;
};
