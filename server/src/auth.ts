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
    revokeSessionsOnPasswordReset: true,
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
    },
  },

  account: {
    // A Google sign-in with the same verified email joins the existing account.
    accountLinking: { enabled: true, trustedProviders: ['google'] },
  },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {},

  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 15 * 60, max: 5 },
      '/sign-in/social': { window: 15 * 60, max: 10 },
      '/sign-up/email': { window: 60 * 60, max: 5 },
      '/email-otp/send-verification-otp': { window: 15 * 60, max: 3 },
      '/forget-password/email-otp': { window: 15 * 60, max: 3 },
      '/email-otp/check-verification-otp': { window: 15 * 60, max: 10 },
      '/email-otp/reset-password': { window: 15 * 60, max: 5 },
      '/change-password': { window: 15 * 60, max: 5 },
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
        const version = (ctx.body as { acceptedTermsVersion?: unknown } | undefined)?.acceptedTermsVersion;
        if (typeof version !== 'string' || !version.trim()) {
          throw new APIError('BAD_REQUEST', { message: 'You must accept the Terms of Use and Privacy Policy.' });
        }
      }
    }),
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          const social = ctx?.path?.startsWith('/sign-in/social') || ctx?.path?.startsWith('/callback/');
          const version = (user as { acceptedTermsVersion?: string }).acceptedTermsVersion ?? (social ? env.LEGAL_VERSION : undefined);
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
