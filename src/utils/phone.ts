// Expected digit count *after* the country code, for country codes we can confidently validate.
const COUNTRY_CODE_DIGITS: Record<string, number> = {
  '263': 9, // Zimbabwe
  '27': 9, // South Africa
  '260': 9, // Zambia
  '258': 9, // Mozambique
  '254': 9, // Kenya
  '234': 10, // Nigeria
  '44': 10, // United Kingdom
  '1': 10, // US / Canada
};

/** Numbers without a country code are treated as local to this country. */
const DEFAULT_COUNTRY_CODE = '263';
const LOCAL_DIGITS = COUNTRY_CODE_DIGITS[DEFAULT_COUNTRY_CODE];

const matchCountryCode = (digits: string) =>
  Object.keys(COUNTRY_CODE_DIGITS)
    .sort((a, b) => b.length - a.length)
    .find((c) => digits.startsWith(c));

type Parsed = { kind: 'local' | 'international'; digits: string };

/**
 * Accepts every common way of typing a number:
 *   0771 234 567 · 771234567 · 263771234567 · +263 77 123 4567 · 00263771234567
 */
const parse = (raw: string): Parsed | null => {
  const value = raw.trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (value.startsWith('+')) return { kind: 'international', digits };
  if (digits.startsWith('00')) return { kind: 'international', digits: digits.slice(2) };
  if (digits.startsWith('0')) return { kind: 'local', digits: digits.slice(1) };
  // Bare digits: international if it starts with a known code and is long enough, otherwise local.
  const code = matchCountryCode(digits);
  if (code && digits.length > LOCAL_DIGITS) return { kind: 'international', digits };
  return { kind: 'local', digits };
};

/** True once the number has exactly the expected digit count for its country (or a plausible generic length). */
export const isPhoneValid = (raw: string): boolean => {
  const parsed = parse(raw);
  if (!parsed) return false;
  if (parsed.kind === 'local') return parsed.digits.length === LOCAL_DIGITS;
  const code = matchCountryCode(parsed.digits);
  if (!code) return parsed.digits.length >= 8 && parsed.digits.length <= 15;
  return parsed.digits.slice(code.length).length === COUNTRY_CODE_DIGITS[code];
};

/** Inline, non-nagging error message: only complains once there's clearly too much input. */
export const phoneError = (raw: string): string | null => {
  const parsed = parse(raw);
  if (!parsed) return null;
  if (/[^\d\s()+-]/.test(raw)) return 'Use digits only';
  if (parsed.kind === 'local') return parsed.digits.length > LOCAL_DIGITS ? 'Too many digits for a phone number' : null;

  const code = matchCountryCode(parsed.digits);
  if (!code) return parsed.digits.length > 15 ? 'Enter a valid phone number' : null;
  return parsed.digits.slice(code.length).length > COUNTRY_CODE_DIGITS[code] ? `Too many digits for a +${code} number` : null;
};

/** Canonical +E.164 form for storage / the backend, e.g. "0771234567" → "+263771234567". */
export const toE164 = (raw: string): string => {
  const parsed = parse(raw);
  if (!parsed) return '';
  return parsed.kind === 'local' ? `+${DEFAULT_COUNTRY_CODE}${parsed.digits}` : `+${parsed.digits}`;
};
