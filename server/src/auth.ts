import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { admin, emailOTP } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { eq } from 'drizzle-orm';
import { db } from './db/client.js';
import * as schema from './db/schema.js';
import { env, isProd } from './env.js';
import { codeEmail, sendEmail } from './lib/email.js';
import { toE164 } from './lib/validation.js';

const OTP_PURPOSE = {
  'forget-password': 'reset your password',
  'sign-in': 'sign in',
  'email-verification': 'verify your email address',
  'change-email': 'confirm your new email address',
} as const;

export const auth = betterAuth({
  appName: 'LoveNest',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),

  trustedOrigins: [
    env.BETTER_AUTH_URL, // the admin dashboard is served from the API's own origin
    ...env.ADMIN_ORIGINS,
    `${env.APP_SCHEME}://`,
    ...(isProd ? [] : ['exp://**']),
  ],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
  },

  // After email-OTP verification, create a session so the app (and tests) can
  // continue without a separate sign-in. verify-email returns token: null otherwise.
  emailVerification: {
    autoSignInAfterVerification: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days; refreshed daily while the app is used
    updateAge: 60 * 60 * 24,
  },

  user: {
    deleteUser: { enabled: true },
    additionalFields: {
      mustChangePassword: { type: 'boolean', defaultValue: false, input: false },
      acceptedTermsVersion: { type: 'string', required: false },
      acceptedTermsAt: { type: 'date', required: false, input: false },
      phone: { type: 'string', required: false, input: true },
    },
  },

  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 15 * 60, max: 5 },
      '/sign-up/email': { window: 60 * 60, max: 5 },
      '/email-otp/send-verification-otp': { window: 15 * 60, max: 3 },
      '/email-otp/request-password-reset': { window: 15 * 60, max: 3 },
      '/forget-password/email-otp': { window: 15 * 60, max: 3 },
      '/email-otp/check-verification-otp': { window: 15 * 60, max: 10 },
      '/email-otp/verify-email': { window: 15 * 60, max: 10 },
      '/email-otp/reset-password': { window: 15 * 60, max: 5 },
      '/change-password': { window: 15 * 60, max: 5 },
      '/update-user': { window: 15 * 60, max: 10 },
      '/delete-user': { window: 15 * 60, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: isProd,
    // The dashboard is same-origin with the API, so Lax cookies work and resist CSRF.
    defaultCookieAttributes: { sameSite: 'lax' },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        const body = ctx.body as { acceptedTermsVersion?: unknown; phone?: unknown } | undefined;
        const version = body?.acceptedTermsVersion;
        if (typeof version !== 'string' || !version.trim()) {
          throw new APIError('BAD_REQUEST', { message: 'You must accept the Terms of Use and Privacy Policy.' });
        }
        const rawPhone = typeof body?.phone === 'string' ? body.phone : '';
        const e164 = toE164(rawPhone);
        if (!e164 || !/^\+2637[1-8]\d{7}$/.test(e164)) {
          throw new APIError('BAD_REQUEST', { message: 'Enter a valid Zimbabwe phone number, for example 0771 234 567.' });
        }
        // Normalise to E.164 before Better Auth stores the field.
        (ctx.body as { phone: string }).phone = e164;
      }
      if (ctx.path === '/update-user') {
        const body = ctx.body as { phone?: unknown } | undefined;
        if (body && 'phone' in body) {
          const rawPhone = typeof body.phone === 'string' ? body.phone : '';
          const e164 = toE164(rawPhone);
          if (!e164 || !/^\+2637[1-8]\d{7}$/.test(e164)) {
            throw new APIError('BAD_REQUEST', { message: 'Enter a valid Zimbabwe phone number, for example 0771 234 567.' });
          }
          (ctx.body as { phone: string }).phone = e164;
        }
      }
    }),
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const version = (user as { acceptedTermsVersion?: string }).acceptedTermsVersion;
          return { data: { ...user, acceptedTermsVersion: version ?? null, acceptedTermsAt: version ? new Date() : null } };
        },
      },
    },
    account: {
      update: {
        // Any successful password change (change, reset) clears the temporary-password flag.
        after: async (account) => {
          if (account.password) {
            await db.update(schema.user).set({ mustChangePassword: false }).where(eq(schema.user.id, account.userId));
          }
        },
      },
    },
  },

  plugins: [
    admin({ defaultRole: 'user', adminRoles: ['admin'], bannedUserMessage: 'This account is suspended. Contact LoveNest support.' }),
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        const { text, html } = codeEmail(otp, OTP_PURPOSE[type as keyof typeof OTP_PURPOSE] ?? 'continue');
        await sendEmail({ to: email, subject: `${otp} is your LoveNest code`, text, html });
      },
    }),
    expo(),
  ],
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;
