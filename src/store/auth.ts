import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authClient } from '../lib/authClient';
import { getGoogleIdToken, GoogleSignInError, signOutGoogle } from '../lib/google';
import { POLICIES, RateLimitError, assertNotLimited, recordAttempt, clearAttempts } from '../utils/rateLimit';
import { sanitize } from '../utils/validation';

export { isValidEmail } from '../utils/validation';

export type User = {
  id: string;
  name: string;
  email: string;
  provider: 'password' | 'google';
  role: 'admin' | 'customer';
  mustChangePassword: boolean;
  acceptedTermsVersion: string;
};

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'rate_limited'
  | 'network'
  | 'suspended'
  | 'code_invalid'
  | 'code_expired'
  | 'code_locked'
  | 'session_expired'
  | 'cancelled'
  | 'unknown';

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'Incorrect email or password',
  email_taken: 'An account with this email already exists',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  network: "Can't reach LoveNest right now. Check your connection and try again.",
  suspended: 'This account is suspended. Contact LoveNest support.',
  code_invalid: 'Incorrect code, please try again',
  code_expired: 'This code has expired. Request a new one.',
  code_locked: 'Too many wrong codes. Request a new one.',
  session_expired: 'For your security, please sign out, sign in again and retry.',
  cancelled: 'Cancelled',
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
  if (status === 0) return new AuthError('network');
  if (status === 429) return new AuthError('rate_limited', 60_000);
  if (code.includes('BANNED')) return new AuthError('suspended', undefined, error?.message);
  if (code.includes('USER_ALREADY_EXISTS')) return new AuthError('email_taken');
  if (code === 'INVALID_OTP') return new AuthError('code_invalid');
  if (code === 'OTP_EXPIRED') return new AuthError('code_expired');
  if (code === 'TOO_MANY_ATTEMPTS') return new AuthError('code_locked');
  if (code.includes('SESSION') && (code.includes('FRESH') || code.includes('EXPIRED'))) return new AuthError('session_expired');
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || code === 'INVALID_PASSWORD' || status === 401) return new AuthError('invalid_credentials');
  if (status === 403 && error?.message) return new AuthError('suspended', undefined, error.message);
  return new AuthError(fallback, undefined, error?.message || undefined);
}

const toAuthError = (e: unknown): AuthError => {
  if (e instanceof AuthError) return e;
  if (e instanceof RateLimitError) return new AuthError('rate_limited', e.retryAfterMs, e.message);
  if (e instanceof GoogleSignInError) return new AuthError(e.reason === 'cancelled' ? 'cancelled' : 'unknown', undefined, e.message);
  if (e instanceof TypeError) return new AuthError('network');
  return new AuthError('unknown');
};

type ServerUser = { id: string; name: string; email: string; role?: string | null; mustChangePassword?: boolean | null; acceptedTermsVersion?: string | null };

const toUser = (u: ServerUser, provider: User['provider']): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  provider,
  role: u.role === 'admin' ? 'admin' : 'customer',
  mustChangePassword: Boolean(u.mustChangePassword),
  acceptedTermsVersion: u.acceptedTermsVersion ?? '',
});

const normalize = (email: string) => email.trim().toLowerCase();
const DEVICE = 'device';

type AuthState = {
  user: User | null;
  /** Re-checks the stored session with the server at startup. */
  restoreSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, termsVersion: string) => Promise<void>;
  signInWithGoogle: (termsVersion: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyResetCode: (email: string, code: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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

      restoreSession: async () => {
        if (!get().user) return;
        try {
          const { data, error } = await authClient.getSession();
          if (error) return; // offline or server down: keep the cached user for now
          if (!data) {
            wipeLocalData();
            set({ user: null });
            return;
          }
          set({ user: toUser(data.user as ServerUser, get().user?.provider ?? 'password') });
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
          set({ user: toUser(data.user as ServerUser, 'password') });
        } catch (e) {
          const err = toAuthError(e);
          if (err.code === 'invalid_credentials') {
            await recordAttempt(`login:${email}`, POLICIES.login);
            await recordAttempt(`login:${DEVICE}`, POLICIES.loginDevice);
          }
          throw err;
        }
      },

      signUp: async (rawName, rawEmail, password, termsVersion) => {
        try {
          await assertNotLimited(`signup:${DEVICE}`);
          const { data, error } = await authClient.signUp.email({
            email: normalize(rawEmail),
            password,
            name: sanitize(rawName),
            acceptedTermsVersion: termsVersion,
          });
          if (error || !data) throw fromServer(error);
          await recordAttempt(`signup:${DEVICE}`, POLICIES.signUp);
          set({ user: toUser(data.user as ServerUser, 'password') });
        } catch (e) {
          throw toAuthError(e);
        }
      },

      // The server records the current Terms version for new Google accounts.
      signInWithGoogle: async () => {
        try {
          const token = await getGoogleIdToken();
          const { error } = await authClient.signIn.social({ provider: 'google', idToken: { token } });
          if (error) throw fromServer(error);
          const session = await authClient.getSession();
          if (!session.data) throw new AuthError('unknown');
          set({ user: toUser(session.data.user as ServerUser, 'google') });
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
        await signOutGoogle();
        wipeLocalData();
        set({ user: null });
      },

      requestPasswordReset: async (rawEmail) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`reset:${email}`);
          // Succeeds whether or not the email has an account, so it never reveals who is registered.
          const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'forget-password' });
          if (error) throw fromServer(error);
          await recordAttempt(`reset:${email}`, POLICIES.resetRequest);
        } catch (e) {
          throw toAuthError(e);
        }
      },

      verifyResetCode: async (rawEmail, code) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`otp:${email}`);
          const { data, error } = await authClient.emailOtp.checkVerificationOtp({ email, type: 'forget-password', otp: code });
          if (error || !data?.success) throw error ? fromServer(error, 'code_invalid') : new AuthError('code_invalid');
          clearAttempts(`otp:${email}`);
        } catch (e) {
          const err = toAuthError(e);
          if (err.code === 'code_invalid' || err.code === 'code_locked') await recordAttempt(`otp:${email}`, POLICIES.otpVerify);
          throw err;
        }
      },

      resetPassword: async (rawEmail, code, password) => {
        const email = normalize(rawEmail);
        try {
          const { error } = await authClient.emailOtp.resetPassword({ email, otp: code, password });
          if (error) throw fromServer(error);
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

      deleteAccount: async (password) => {
        if (!get().user) return;
        try {
          const { error } = await authClient.deleteUser(password ? { password } : {});
          if (error) throw fromServer(error);
          await signOutGoogle();
          wipeLocalData();
          set({ user: null });
        } catch (e) {
          throw toAuthError(e);
        }
      },
    }),
    {
      name: 'lovenest.auth',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // Only the profile is cached for instant start-up; the session itself lives in SecureStore.
      partialize: (state) => ({ user: state.user }),
      // Sessions from the old demo build cannot be valid on the real server.
      migrate: () => ({ user: null }),
    },
  ),
);
