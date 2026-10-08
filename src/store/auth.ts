import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { POLICIES, RateLimitError, assertNotLimited, recordAttempt, clearAttempts } from '../utils/rateLimit';
import { sanitize } from '../utils/validation';

export { isValidEmail } from '../utils/validation';

export type User = {
  name: string;
  email: string;
  provider: 'password' | 'google';
  /** Version of the Terms/Privacy Policy the user accepted, and when. */
  acceptedTermsVersion: string;
  acceptedAt: string;
};

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'rate_limited'
  | 'network'
  | 'code_invalid'
  | 'code_expired'
  | 'code_locked'
  | 'unknown';

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'Incorrect email or password',
  email_taken: 'An account with this email already exists',
  rate_limited: 'Too many attempts. Please try again later.',
  network: "Can't reach LoveNest right now. Check your connection and try again.",
  code_invalid: 'Incorrect code, please try again',
  code_expired: 'This code has expired. Request a new one.',
  code_locked: 'Too many wrong codes. Request a new one.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * Every auth action rejects with an AuthError, so screens never care whether the
 * failure came from this mock, a backend 4xx/429, or the network being down.
 */
export class AuthError extends Error {
  constructor(public code: AuthErrorCode, public retryAfterMs?: number, message?: string) {
    super(message ?? MESSAGES[code]);
    this.name = 'AuthError';
  }
}

const toAuthError = (e: unknown): AuthError => {
  if (e instanceof AuthError) return e;
  if (e instanceof RateLimitError) return new AuthError('rate_limited', e.retryAfterMs, e.message);
  // fetch() rejects with a TypeError when the server is unreachable.
  if (e instanceof TypeError) return new AuthError('network');
  return new AuthError('unknown');
};

// ---------------------------------------------------------------------------
// Mock backend — replace `api` with real HTTP calls. Keep the contract: resolve
// on success, throw AuthError on failure (map HTTP 429 → 'rate_limited' with the
// Retry-After header, 401 → 'invalid_credentials', 409 → 'email_taken').
// ---------------------------------------------------------------------------

type Account = { name: string; email: string; password: string };
type ResetCode = { code: string; expiresAt: number; attempts: number };

const CODE_TTL_MS = 10 * 60_000;
const MAX_CODE_ATTEMPTS = 5;

// In memory only so plain-text passwords never hit device storage.
const accounts = new Map<string, Account>();
const resetCodes = new Map<string, ResetCode>();

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (email: string) => email.trim().toLowerCase();

const api = {
  signIn: async (email: string, password: string) => {
    await delay();
    const account = accounts.get(email);
    if (!account || account.password !== password) throw new AuthError('invalid_credentials');
    return { name: account.name, email: account.email };
  },
  signUp: async (name: string, email: string, password: string) => {
    await delay();
    if (accounts.has(email)) throw new AuthError('email_taken');
    accounts.set(email, { name, email, password });
    return { name, email };
  },
  // Real Google Sign-In needs a development build + Google Cloud OAuth client
  // (see https://docs.expo.dev/guides/google-authentication/).
  signInWithGoogle: async () => {
    await delay();
    return { name: 'Google User', email: 'google.user@gmail.com' };
  },
  // Always "succeeds" so the response never reveals whether an account exists.
  // Returns the code only so the demo can show it; a real server emails it.
  requestPasswordReset: async (email: string) => {
    await delay();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(email, { code, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });
    return code;
  },
  verifyResetCode: async (email: string, code: string) => {
    await delay(400);
    const entry = resetCodes.get(email);
    if (!entry) throw new AuthError('code_expired');
    if (Date.now() > entry.expiresAt) {
      resetCodes.delete(email);
      throw new AuthError('code_expired');
    }
    if (entry.code !== code) {
      entry.attempts += 1;
      if (entry.attempts >= MAX_CODE_ATTEMPTS) {
        resetCodes.delete(email);
        throw new AuthError('code_locked');
      }
      throw new AuthError('code_invalid');
    }
  },
  resetPassword: async (email: string, password: string) => {
    await delay();
    const existing = accounts.get(email);
    accounts.set(email, { name: existing?.name ?? email.split('@')[0], email, password });
    resetCodes.delete(email);
  },
  deleteAccount: async (email: string, password?: string) => {
    await delay();
    const account = accounts.get(email);
    if (password !== undefined && account && account.password !== password) throw new AuthError('invalid_credentials');
    accounts.delete(email);
  },
};

// ---------------------------------------------------------------------------

type AuthState = {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, termsVersion: string) => Promise<void>;
  signInWithGoogle: (termsVersion: string) => Promise<void>;
  signOut: () => void;
  requestPasswordReset: (email: string) => Promise<string>;
  verifyResetCode: (email: string, code: string) => Promise<void>;
  resetPassword: (email: string, password: string) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
};

const DEVICE = 'device';

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,

      signIn: async (rawEmail, password) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`login:${email}`);
          await assertNotLimited(`login:${DEVICE}`);
          const { name } = await api.signIn(email, password);
          clearAttempts(`login:${email}`);
          // Existing accounts accepted the terms at sign-up; the backend should return that record.
          set({ user: { name, email, provider: 'password', acceptedTermsVersion: '', acceptedAt: '' } });
        } catch (e) {
          const err = toAuthError(e);
          // Only real wrong-password responses count — an outage must not lock people out.
          if (err.code === 'invalid_credentials') {
            await recordAttempt(`login:${email}`, POLICIES.login);
            await recordAttempt(`login:${DEVICE}`, POLICIES.loginDevice);
          }
          throw err;
        }
      },

      signUp: async (rawName, rawEmail, password, termsVersion) => {
        const email = normalize(rawEmail);
        const name = sanitize(rawName);
        try {
          await assertNotLimited(`signup:${DEVICE}`);
          await api.signUp(name, email, password);
          await recordAttempt(`signup:${DEVICE}`, POLICIES.signUp);
          set({ user: { name, email, provider: 'password', acceptedTermsVersion: termsVersion, acceptedAt: new Date().toISOString() } });
        } catch (e) {
          const err = toAuthError(e);
          if (err.code === 'email_taken') await recordAttempt(`signup:${DEVICE}`, POLICIES.signUp);
          throw err;
        }
      },

      signInWithGoogle: async (termsVersion) => {
        try {
          const { name, email } = await api.signInWithGoogle();
          set({ user: { name, email, provider: 'google', acceptedTermsVersion: termsVersion, acceptedAt: new Date().toISOString() } });
        } catch (e) {
          throw toAuthError(e);
        }
      },

      signOut: () => set({ user: null }),

      requestPasswordReset: async (rawEmail) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`reset:${email}`);
          const code = await api.requestPasswordReset(email);
          await recordAttempt(`reset:${email}`, POLICIES.resetRequest);
          return code;
        } catch (e) {
          throw toAuthError(e);
        }
      },

      verifyResetCode: async (rawEmail, code) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`otp:${email}`);
          await api.verifyResetCode(email, code);
          clearAttempts(`otp:${email}`);
        } catch (e) {
          const err = toAuthError(e);
          if (err.code === 'code_invalid' || err.code === 'code_locked') await recordAttempt(`otp:${email}`, POLICIES.otpVerify);
          throw err;
        }
      },

      resetPassword: async (rawEmail, password) => {
        const email = normalize(rawEmail);
        try {
          await api.resetPassword(email, password);
          clearAttempts(`login:${email}`);
        } catch (e) {
          throw toAuthError(e);
        }
      },

      deleteAccount: async (password) => {
        const user = get().user;
        if (!user) return;
        try {
          await api.deleteAccount(user.email, password);
          set({ user: null });
        } catch (e) {
          throw toAuthError(e);
        }
      },
    }),
    {
      name: 'lovenest.auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
