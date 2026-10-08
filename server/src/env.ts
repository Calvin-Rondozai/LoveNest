import { z } from 'zod';

// All configuration comes from environment variables, validated once at startup so a
// missing or malformed setting fails fast with a clear message instead of at runtime.

const list = z
  .string()
  .default('')
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const optional = z.string().trim().min(1).optional();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Stage 1: database. Local file in development, Turso URL + token in production.
  DATABASE_URL: z.string().min(1).default('file:./data/local.db'),
  DATABASE_AUTH_TOKEN: optional,

  // Stage 1: Better Auth.
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters. Generate one with: npx auth secret'),
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
  /** Web origins allowed to call the API with cookies, e.g. the admin dashboard. */
  ADMIN_ORIGINS: list,
  /** Deep-link scheme of the mobile app (app.json "scheme"). */
  APP_SCHEME: z.string().regex(/^[a-z][a-z0-9+.-]*$/).default('lovenest'),
  /** Current Terms/Privacy version (LEGAL_VERSION in the app's src/legal/content.ts). */
  LEGAL_VERSION: z.string().default('2026-10-08.2'),
  /** Delivery fee in cents charged on every order. */
  DELIVERY_FEE_CENTS: z.coerce.number().int().min(0).default(500),

  // Stage 2: email (Resend) and Google sign-in. Without Resend, codes are logged in development.
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default('LoveNest <onboarding@resend.dev>'),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  // Stage 3: product photos (Cloudinary).
  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,

  // Stage 4: payments (Paynow).
  PAYNOW_INTEGRATION_ID: optional,
  PAYNOW_INTEGRATION_KEY: optional,
  /** Paynow test mode only accepts payments initiated with the merchant account email. */
  PAYNOW_AUTH_EMAIL: optional,

  // Seeding the first admin (npm run db:seed).
  SEED_ADMIN_EMAIL: optional,
  SEED_ADMIN_PASSWORD: optional,
  SEED_ADMIN_NAME: z.string().default('LoveNest Admin'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid configuration. Fix these environment variables (see .env.example):\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
