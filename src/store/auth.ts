import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authClient } from '../lib/authClient';
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
  | 'email_not_verified'
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
  email_not_verified: 'Verify your email with the code we sent you before signing in.',
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
  const message = typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : undefined;
  if (status === 0) return new AuthError('network');
  if (status === 429) return new AuthError('rate_limited', 60_000);
  if (code.includes('BANNED')) return new AuthError('suspended', undefined, message);
  if (code.includes('USER_ALREADY_EXISTS')) return new AuthError('email_taken');
  if (code.includes('EMAIL_NOT_VERIFIED') || code.includes('NOT_VERIFIED')) return new AuthError('email_not_verified');
  if (code === 'INVALID_OTP') return new AuthError('code_invalid');
  if (code === 'OTP_EXPIRED') return new AuthError('code_expired');
  if (code === 'TOO_MANY_ATTEMPTS') return new AuthError('code_locked');
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
  /** Re-checks the stored session with the server at startup. */
  restoreSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates the account and emails a verification code. Does not sign the user in yet. */
  signUp: (name: string, email: string, phone: string, password: string, termsVersion: string) => Promise<void>;
  /** Confirms the email code after sign-up (or after a blocked sign-in). Signs the user in. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  /** Sends a fresh email-verification code. */
  requestEmailVerification: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyResetCode: (email: string, code: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
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
          set({ user: toUser(data.user as ServerUser) });
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
          set({ user: toUser(data.user as ServerUser) });
        } catch (e) {
          const err = toAuthError(e);
          if (err.code === 'invalid_credentials') {
            await recordAttempt(`login:${email}`, POLICIES.login);
            await recordAttempt(`login:${DEVICE}`, POLICIES.loginDevice);
          }
          if (err.code === 'email_not_verified') {
            try {
              await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
            } catch {
              // Still throw email_not_verified so the screen can open VerifyOtp.
            }
          }
          throw err;
        }
      },

      signUp: async (rawName, rawEmail, rawPhone, password, termsVersion) => {
        try {
          await assertNotLimited(`signup:${DEVICE}`);
          const phone = toE164(rawPhone) ?? rawPhone.trim();
          const { error } = await authClient.signUp.email({
            email: normalize(rawEmail),
            password,
            name: sanitize(rawName),
            phone,
            acceptedTermsVersion: termsVersion,
          });
          if (error) throw fromServer(error);
          await recordAttempt(`signup:${DEVICE}`, POLICIES.signUp);
          // Account exists but is not signed in until the email code is verified.
        } catch (e) {
          throw toAuthError(e);
        }
      },

      requestEmailVerification: async (rawEmail) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`reset:${email}`);
          const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
          if (error) throw fromServer(error);
          await recordAttempt(`reset:${email}`, POLICIES.resetRequest);
        } catch (e) {
          throw toAuthError(e);
        }
      },

      verifyEmailCode: async (rawEmail, code) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`otp:${email}`);
          const { data, error } = await authClient.emailOtp.verifyEmail({ email, otp: code });
          if (error || !data) throw error ? fromServer(error, 'code_invalid') : new AuthError('code_invalid');
          clearAttempts(`otp:${email}`);
          const session = await authClient.getSession();
          if (session.data?.user) {
            set({ user: toUser(session.data.user as ServerUser) });
            return;
          }
          // Some builds return the user on verifyEmail without a separate session fetch.
          if ((data as { user?: ServerUser }).user) {
            set({ user: toUser((data as { user: ServerUser }).user) });
            return;
          }
          throw new AuthError('unknown', undefined, 'Email verified. Please sign in.');
        } catch (e) {
          const err = toAuthError(e);
          if (err.code === 'code_invalid' || err.code === 'code_locked') await recordAttempt(`otp:${email}`, POLICIES.otpVerify);
          throw err;
        }
      },

      signOut: async () => {
        try {
          await authClient.signOut();
        } catch {
          // Offline: the local session is still cleared below.
        }
        wipeLocalData();
        set({ user: null });
      },

      requestPasswordReset: async (rawEmail) => {
        const email = normalize(rawEmail);
        try {
          await assertNotLimited(`reset:${email}`);
          // Dedicated reset endpoint (no form CSRF). Always returns success so accounts are not revealed.
          const { error } = await authClient.emailOtp.requestPasswordReset({ email });
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
          set({ user: null });
        } catch (e) {
          throw toAuthError(e);
        }
      },
    }),
    {
      name: 'lovenest.auth',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      // Only the profile is cached for instant start-up; the session itself lives in SecureStore.
      partialize: (state) => ({ user: state.user }),
      migrate: () => ({ user: null }),
    },
  ),
);
