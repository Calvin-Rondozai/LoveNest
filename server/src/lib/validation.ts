import { z } from 'zod';
import type { Context } from 'hono';
import { badRequest } from './errors.js';

// Mirrors the mobile app's src/utils/validation.ts and src/utils/phone.ts so the server
// accepts exactly what the app accepts. The server is the source of truth.

export const LIMITS = {
  name: 60,
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  address: 120,
  apartment: 60,
  city: 60,
  instructions: 300,
  giftMessage: 300,
  productName: 80,
  productDescription: 500,
  orderNote: 200,
} as const;

/** Trim, drop control characters and collapse runs of spaces. */
export const sanitize = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

const clean = (min: number, max: number, label: string) =>
  z
    .string()
    .transform(sanitize)
    .pipe(z.string().min(min, `${label} is too short.`).max(max, `${label} must be under ${max} characters.`));

const optionalClean = (max: number, label: string) =>
  z.string().default('').transform(sanitize).pipe(z.string().max(max, `${label} must be under ${max} characters.`));

export const personName = clean(2, LIMITS.name, 'Name').pipe(
  z.string().regex(/^[\p{L}][\p{L}\p{M} .'-]*$/u, 'Use letters, spaces, hyphens or apostrophes only.'),
);

export const emailAddress = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.email)
  .pipe(z.email('Enter a valid email address.'));

export const password = z
  .string()
  .min(LIMITS.passwordMin, `Use at least ${LIMITS.passwordMin} characters.`)
  .max(LIMITS.passwordMax)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number.');

// ---------- phone numbers ----------

const COUNTRY_DIGITS: Record<string, number> = { '263': 9, '27': 9, '260': 9, '258': 9, '254': 9, '234': 10, '44': 10, '1': 10 };
const DEFAULT_CC = '263';

const LOCAL_DIGITS = COUNTRY_DIGITS[DEFAULT_CC]!;
const matchCountryCode = (digits: string) =>
  Object.keys(COUNTRY_DIGITS)
    .sort((a, b) => b.length - a.length)
    .find((c) => digits.startsWith(c));

const international = (digits: string) => {
  const cc = matchCountryCode(digits);
  if (cc) return digits.length - cc.length === COUNTRY_DIGITS[cc] ? `+${digits}` : null;
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
};
const local = (digits: string) => (digits.length === LOCAL_DIGITS ? `+${DEFAULT_CC}${digits}` : null);

/**
 * Normalises any common way of typing a number to +E.164, or returns null if invalid:
 *   0771 234 567 · 771234567 · 263771234567 · +263 77 123 4567 · 00263771234567
 */
export function toE164(raw: string): string | null {
  const value = raw.trim();
  if (!value || /[^\d\s()+-]/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (value.startsWith('+')) return international(digits);
  if (digits.startsWith('00')) return international(digits.slice(2));
  if (digits.startsWith('0')) return local(digits.slice(1));
  // Bare digits: international if they start with a known code and are too long to be local.
  if (matchCountryCode(digits) && digits.length > LOCAL_DIGITS) return international(digits);
  return local(digits);
}

export const phoneNumber = z.string().transform((v, ctx) => {
  const e164 = toE164(v);
  if (!e164) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number.' });
    return z.NEVER;
  }
  return e164;
});

/** Zimbabwe mobile money numbers (EcoCash), in the local 07XXXXXXXX form Paynow expects. */
export const zimMobileMoneyNumber = phoneNumber.transform((e164, ctx) => {
  if (!/^\+2637[1-8]\d{7}$/.test(e164)) {
    ctx.addIssue({ code: 'custom', message: 'Enter a Zimbabwe mobile money number, for example 0771 234 567.' });
    return z.NEVER;
  }
  return e164;
});

export const localZimNumber = (e164: string) => `0${e164.slice(4)}`;

export const text = { clean, optionalClean };

/** Parses a JSON body with a zod schema, returning field-level errors in the standard shape. */
export async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest('Send a valid JSON body.');
  }
  return parseWith(schema, body);
}

export function parseWith<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw badRequest(Object.values(fields)[0] ?? 'Invalid request.', fields);
}
