/** EcoCash send-money USSD: *153*1*1*MERCHANT*AMOUNT# */

export function merchantLocal(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (/^07[1-8]\d{7}$/.test(digits)) return digits;
  if (/^2637[1-8]\d{7}$/.test(digits)) return `0${digits.slice(3)}`;
  return null;
}

export function ussdCode(merchant: string, amountCents: number) {
  return `*153*1*1*${merchant}*${(amountCents / 100).toFixed(2)}#`;
}
