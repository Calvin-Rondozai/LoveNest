import { create } from 'zustand';

type ToastState = { message: string | null; show: (message: string, durationMs?: number) => void };

let hideTimer: ReturnType<typeof setTimeout>;

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message, durationMs = 1800) => {
    clearTimeout(hideTimer);
    set({ message });
    hideTimer = setTimeout(() => set({ message: null }), durationMs);
  },
}));
