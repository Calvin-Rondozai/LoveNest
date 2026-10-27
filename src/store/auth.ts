import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authClient } from '../lib/authClient';
import { apiRequest, ApiRequestError } from '../lib/api';
import { POLICIES, RateLimitError, assertNotLimited, recordAttempt, clearAttempts } from '../utils/rateLimit';
import { sanitize } from '../utils/validation';
import { toE164 } from '../utils/phone';

export { isValidEmail } from '../utils/validation';

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  provider: 'password';
  role: 'admin' | 'customer';
  mustChangePassword: boolean;
  acceptedTermsVersion: string;
  emailVerified: boolean;
};

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'rate_limited'
  | 'network'
  | 'suspended'
  | 'session_expired'
  | 'cancelled'
  | 'wrong_answer'
  | 'recovery_unavailable'
  | 'unknown';

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'Incorrect email or password',
  email_taken: 'An account with this email already exists',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  network: "Can't reach LoveNest right now. Check your connection and try again.",
  suspended: 'This account is suspended. Contact LoveNest support.',
  session_expired: 'For your security, please sign out, sign in again and retry.',
  cancelled: 'Cancelled',
  wrong_answer: 'That answer does not match. Please try again.',
  recovery_unavailable: 'This account has no security question. Message LoveNest on WhatsApp to reset the password.',
  unknown: 'Something went wrong. Please try again.',
};

/** Every auth action rejects with an AuthError, whatever the cause. */
export class AuthError extends Error {
  constructor(public code: AuthErrorCode, public retryAfterMs?: number, message?: string) {
    super(message ?? MESSAGES[code]);
    this.name = 'AuthError';
  }
}

type BetterAuthError = { status?: number; code?: string; message?: string } | null | undefined;

/** Maps Better Auth client errors onto our codes. */
function fromServer(error: BetterAuthError, fallback: AuthErrorCode = 'unknown'): AuthError {
  const code = (error?.code ?? '').toUpperCase();
  const status = error?.status ?? 0;
  const message = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : undefined;
  if (status === 0) return new AuthError('network');
  if (status === 429) return new AuthError('rate_limited', 60_000);
  if (code.includes('BANNED')) return new AuthError('suspended', undefined, message);
  if (code.includes('USER_ALREADY_EXISTS')) return new AuthError('email_taken');
  if (code.includes('SESSION') && (code.includes('FRESH') || code.includes('EXPIRED'))) return new AuthError('session_expired');
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || code === 'INVALID_PASSWORD' || status === 401) return new AuthError('invalid_credentials');
  if (status === 403 && message) return new AuthError('suspended', undefined, message);
  // Prefer the server's message (e.g. invalid phone) over the generic fallback.
  if (message && (status === 400 || status >= 500 || fallback === 'unknown')) {
    return new AuthError(fallback, undefined, message);
  }
  return new AuthError(fallback, undefined, message);
}

const toAuthError = (e: unknown): AuthError => {
  if (e instanceof AuthError) return e;
  if (e instanceof RateLimitError) return new AuthError('rate_limited', e.retryAfterMs, e.message);
  if (e instanceof ApiRequestError) {
    if (e.status === 0) return new AuthError('network', undefined, e.message);
    if (e.status === 429) return new AuthError('rate_limited', e.retryAfterMs, e.message);
    if (e.code === 'wrong_answer') return new AuthError('wrong_answer', undefined, e.message);
    if (e.code === 'recovery_unavailable') return new AuthError('recovery_unavailable', undefined, e.message);
    return new AuthError('unknown', undefined, e.message);
  }
  if (e instanceof TypeError) return new AuthError('network');
  return new AuthError('unknown');
};

type ServerUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  mustChangePassword?: boolean | null;
  acceptedTermsVersion?: string | null;
  emailVerified?: boolean | null;
};

const toUser = (u: ServerUser): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone ?? '',
  provider: 'password',
  role: u.role === 'admin' ? 'admin' : 'customer',
  mustChangePassword: Boolean(u.mustChangePassword),
  acceptedTermsVersion: u.acceptedTermsVersion ?? '',
  emailVerified: Boolean(u.emailVerified),
});

const normalize = (email: string) => email.trim().toLowerCase();
const DEVICE = 'device';

type AuthState = {
  user: User | null;
  /** True after a successful sign-in on this device. Survives logout so Login is the return screen. */
  hasSignedInOnDevice: boolean;
  /** Email to pre-fill on Login after Create Account. Not persisted. */
  signupEmail: string | null;
  /** Re-checks the stored session with the server at startup. */
  restoreSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates the account, then returns to Login (no session). */
  signUp: (
    name: string,
    email: string,
    phone: string,
    password: string,
    termsVersion: string,
    securityQuestion: string,
    securityAnswer: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  lookupRecoveryQuestion: (email: string) => Promise<{ question: string }>;
  resetPassword: (email: string, answer: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (fields: { name: string; phone: string }) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
};

/** Registered by stores that hold personal data, so signing out wipes them from the device. */
const signOutListeners = new Set<() => void>();
export const onSignOut = (fn: () => void) => {
  signOutListeners.add(fn);
};
const wipeLocalData = () => signOutListeners.forEach((fn) => fn());

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      hasSignedInOnDevice: false,
      signupEmail: null,

      restoreSession: async () => {
        if (!get().user) return;
        try {
          const { data, error } = await authClient.getSession();
          if (error) return; // offline or server down: keep the cached user
          if (data?.user) {
            set({ user: toUser(data.user as ServerUser), hasSignedInOnDevice: true });
            return;
          }
          // Empty session: keep the cached profile so Login is not shown again until they log out.
          // API calls that need a live cookie still go through the server.
        } catch {
          // Network failure: keep the cached user.
        }
      },

      signIn: async (rawEmail, password) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`login:${email}`);
          await assertNotLimited(`login:${DEVICE}`);
          const { data, error } = await authClient.signIn.email({ email, password });
          if (error || !data) throw fromServer(error, 'invalid_credentials');
          clearAttempts(`login:${email}`);
          set({ user: toUser(data.user as ServerUser), hasSignedInOnDevice: true });
        } catch (e) {
          const err = toAuthError(e);
          if (err.code === 'invalid_credentials') {
            await recordAttempt(`login:${email}`, POLICIES.login);
            await recordAttempt(`login:${DEVICE}`, POLICIES.loginDevice);
          }
          throw err;
        }
      },

      signUp: async (rawName, rawEmail, rawPhone, password, termsVersion, securityQuestion, securityAnswer) => {
        try {
          await assertNotLimited(`signup:${DEVICE}`);
          const email = normalize(rawEmail);
          const phone = toE164(rawPhone) ?? rawPhone.trim();
          const { error } = await authClient.signUp.email({
            email,
            password,
            name: sanitize(rawName),
            phone,
            acceptedTermsVersion: termsVersion,
            securityQuestion,
            securityAnswer: sanitize(securityAnswer),
          } as Parameters<typeof authClient.signUp.email>[0] & { securityQuestion: string; securityAnswer: string });
          if (error) throw fromServer(error);
          await recordAttempt(`signup:${DEVICE}`, POLICIES.signUp);
          try {
            await authClient.signOut();
          } catch {
            // Session cookie is unused until they log in.
          }
          set({ user: null, hasSignedInOnDevice: true, signupEmail: email });
        } catch (e) {
          throw toAuthError(e);
        }
      },

      signOut: async () => {
        try {
          await authClient.signOut();
        } catch {
          // Offline: the local session is still cleared below.
        }
        wipeLocalData();
        set({ user: null, hasSignedInOnDevice: true });
      },

      lookupRecoveryQuestion: async (rawEmail) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`reset:${email}`);
          const data = await apiRequest<{ question: string }>('/api/recovery/lookup', { method: 'POST', body: { email }, auth: false });
          await recordAttempt(`reset:${email}`, POLICIES.resetRequest);
          return { question: data.question };
        } catch (e) {
          throw toAuthError(e);
        }
      },

      resetPassword: async (rawEmail, answer, password) => {
        const email = normalize(rawEmail);
        try {
          await apiRequest('/api/recovery/reset', { method: 'POST', body: { email, answer, password }, auth: false });
          clearAttempts(`login:${email}`);
        } catch (e) {
          throw toAuthError(e);
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        const user = get().user;
        if (!user) return;
        const key = `changepw:${user.email}`;
        try {
          await assertNotLimited(key);
          const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
          if (error) throw fromServer(error, 'invalid_credentials');
          clearAttempts(key);
          set({ user: { ...user, mustChangePassword: false } });
        } catch (e) {
          const err = toAuthError(e);
          if (err.code === 'invalid_credentials') {
            await recordAttempt(key, POLICIES.login);
            throw new AuthError('invalid_credentials', undefined, 'Your current password is incorrect');
          }
          throw err;
        }
      },

      updateProfile: async ({ name, phone }) => {
        const user = get().user;
        if (!user) return;
        try {
          const e164 = toE164(phone) ?? phone.trim();
          if (!e164 || !/^\+2637[1-8]\d{7}$/.test(e164)) {
            throw new AuthError('unknown', undefined, 'Enter a valid Zimbabwe phone number, for example 0771 234 567.');
          }
          const cleanName = sanitize(name);
          const { error } = await authClient.updateUser({ name: cleanName, phone: e164 });
          if (error) throw fromServer(error);
          // updateUser returns { status: true } without a user payload; refresh session for the saved fields.
          const session = await authClient.getSession();
          if (session.data?.user) {
            set({ user: toUser(session.data.user as ServerUser) });
            return;
          }
          set({ user: { ...user, name: cleanName, phone: e164 } });
        } catch (e) {
          throw toAuthError(e);
        }
      },

      deleteAccount: async (password) => {
        if (!get().user) return;
        try {
          const { error } = await authClient.deleteUser(password ? { password } : {});
          if (error) throw fromServer(error);
          wipeLocalData();
          set({ user: null, hasSignedInOnDevice: false });
        } catch (e) {
          throw toAuthError(e);
        }
      },
    }),
    {
      name: 'lovenest.auth',
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      // Profile and "has signed in on this device" stay on disk; the session cookie lives in SecureStore.
      partialize: (state) => ({ user: state.user, hasSignedInOnDevice: state.hasSignedInOnDevice }),
      migrate: (persisted) => {
        const prev = persisted as { user?: User | null; hasSignedInOnDevice?: boolean } | undefined;
        const user = prev?.user ?? null;
        return { user, hasSignedInOnDevice: Boolean(prev?.hasSignedInOnDevice || user) };
      },
    },
  ),
);
