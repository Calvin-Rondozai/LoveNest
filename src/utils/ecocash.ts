import { Linking } from 'react-native';

/** EcoCash send-money USSD: *153*1*1*MERCHANT*AMOUNT# */
export function ussdCode(merchant: string, amountCents: number) {
  const digits = merchant.replace(/\D/g, '');
  return `*153*1*1*${digits}*${(amountCents / 100).toFixed(2)}#`;
}

export function formatMerchant(merchant: string) {
  const d = merchant.replace(/\D/g, '');
  if (d.length !== 10) return merchant;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

export async function openEcoCashUssd(merchant: string, amountCents: number) {
  const code = ussdCode(merchant, amountCents);
  const url = `tel:${code.replace(/#/g, '%23')}`;
  try {
    await Linking.openURL(url);
  } catch {
    // User can type the code from the on-screen instructions.
  }
}
