import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type OnboardingState = { seen: boolean; complete: () => void };

export const useOnboarding = create<OnboardingState>()(
  persist((set) => ({ seen: false, complete: () => set({ seen: true }) }), {
    name: 'lovenest.onboarding',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state) => ({ seen: state.seen }),
  }),
);
