import { toE164 } from './phone';

export type MobileMoneyMethod = 'ecocash' | 'onemoney';

export const MOBILE_MONEY_LABEL: Record<MobileMoneyMethod, string> = { ecocash: 'EcoCash', onemoney: 'OneMoney' };

/** Zimbabwe mobile money numbers (07X XXX XXXX). Mirrors the server's rule. */
export function mobileMoneyError(raw: string): string | null {
  if (!raw.trim()) return 'Enter the mobile money number that will pay';
  const e164 = toE164(raw);
  if (!e164 || !/^\+2637[1-8]\d{7}$/.test(e164)) return 'Enter a Zimbabwe mobile number, for example 0771 234 567';
  return null;
}

/** "+263771234567" to "077 123 4567" for display. */
export const formatLocal = (e164: string) => {
  const local = e164.startsWith('+263') ? `0${e164.slice(4)}` : e164;
  return local.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
};
