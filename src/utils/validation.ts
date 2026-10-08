// Shared form rules. The backend must re-validate everything; these exist for
// fast feedback and to stop obviously bad data leaving the device.

export const LIMITS = {
  name: 60,
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  address: 120,
  apartment: 60,
  city: 60,
  instructions: 300,
} as const;

/** Trim, drop control characters and collapse runs of whitespace. */
export const sanitize = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]*$/u;

export const isValidEmail = (email: string) => {
  const value = email.trim();
  return value.length <= LIMITS.email && EMAIL_RE.test(value) && !value.includes('..');
};

export const emailError = (email: string) => {
  if (!email.trim()) return 'Enter your email address';
  return isValidEmail(email) ? null : 'Enter a valid email address';
};

export const nameError = (name: string, label = 'name') => {
  const value = sanitize(name);
  if (!value) return `Enter your ${label}`;
  if (value.length < 2) return `Your ${label} looks too short`;
  if (value.length > LIMITS.name) return `Keep it under ${LIMITS.name} characters`;
  if (!NAME_RE.test(value)) return 'Use letters, spaces, hyphens or apostrophes only';
  return null;
};

export type PasswordCheck = { label: string; met: boolean };

export const passwordChecks = (password: string): PasswordCheck[] => [
  { label: `At least ${LIMITS.passwordMin} characters`, met: password.length >= LIMITS.passwordMin },
  { label: 'One letter', met: /[A-Za-z]/.test(password) },
  { label: 'One number', met: /\d/.test(password) },
];

export const passwordError = (password: string, { email }: { email?: string } = {}) => {
  if (!password) return 'Enter a password';
  if (password.length > LIMITS.passwordMax) return `Keep it under ${LIMITS.passwordMax} characters`;
  if (/^\s|\s$/.test(password)) return 'Password cannot start or end with a space';
  const unmet = passwordChecks(password).find((c) => !c.met);
  if (unmet) return `Password needs: ${unmet.label.toLowerCase()}`;
  const local = email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return 'Password should not contain your email';
  return null;
};

export const confirmError = (password: string, confirm: string) => {
  if (!confirm) return 'Confirm your password';
  return confirm === password ? null : 'Passwords do not match';
};

/** Required free-text field with a min/max length. */
export const textError = (value: string, { label, min = 2, max }: { label: string; min?: number; max: number }) => {
  const clean = sanitize(value);
  if (!clean) return `Enter ${label}`;
  if (clean.length < min) return `${label[0].toUpperCase()}${label.slice(1)} looks too short`;
  if (clean.length > max) return `Keep it under ${max} characters`;
  return null;
};

export const optionalTextError = (value: string, max: number) =>
  sanitize(value).length > max ? `Keep it under ${max} characters` : null;

/** Drops null entries so `Object.keys(errors).length` means "has errors". */
export const compactErrors = <T extends Record<string, string | null | undefined>>(errors: T) =>
  Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Partial<Record<keyof T, string>>;
