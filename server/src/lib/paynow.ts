import paynowSdk from 'paynow';
import { env, isProd } from '../env.js';

// Thin wrapper around the official Paynow SDK (https://github.com/paynow/Paynow-NodeJS-SDK):
// adds timeouts, turns silent failures into errors, verifies every message's SHA-512 hash,
// and maps Paynow statuses onto ours.
//
// Without PAYNOW_INTEGRATION_ID/KEY, development uses a simulator with Paynow's test numbers:
//   0771111111 paid after ~5 s   0772222222 paid after ~15 s
//   0773333333 cancelled          0774444444 insufficient balance (fails immediately)

export type MobileMethod = 'ecocash' | 'onemoney';
export type PaymentOutcome = 'paid' | 'failed' | 'refunded' | 'pending';

export type InitResult = { ok: true; pollUrl: string; instructions: string } | { ok: false; error: string };
export type StatusResult = { reference: string; amount: string; paynowReference: string; pollUrl: string; status: string; outcome: PaymentOutcome };

const TIMEOUT_MS = 20_000;
const live = Boolean(env.PAYNOW_INTEGRATION_ID && env.PAYNOW_INTEGRATION_KEY);

if (isProd && !live) {
  // eslint-disable-next-line no-console
  console.error('PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY are required in production.');
  process.exit(1);
}

const client = live ? new paynowSdk.Paynow(env.PAYNOW_INTEGRATION_ID, env.PAYNOW_INTEGRATION_KEY) : null;
if (client) {
  client.resultUrl = `${env.BETTER_AUTH_URL}/api/payments/paynow/result`;
  client.returnUrl = `${env.BETTER_AUTH_URL}/payments/return`;
}

export const paynowMode = live ? 'live' : 'simulated';

/** Paynow statuses: https://developers.paynow.co.zw (Status Update). */
export function outcomeOf(status: string): PaymentOutcome {
  const s = status.trim().toLowerCase();
  if (s === 'paid' || s === 'awaiting delivery' || s === 'delivered') return 'paid';
  if (s === 'cancelled' || s === 'failed' || s === 'disputed') return 'failed';
  if (s === 'refunded') return 'refunded';
  return 'pending'; // created, sent, or anything new
}

const withTimeout = <T>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Paynow did not respond in time.')), TIMEOUT_MS))]);

const amountString = (cents: number) => (cents / 100).toFixed(2);

export async function initiateMobilePayment(input: {
  reference: string;
  amountCents: number;
  phone: string; // local 07XXXXXXXX
  method: MobileMethod;
  customerEmail: string;
}): Promise<InitResult> {
  if (!client) return simulator.initiate(input);
  try {
    // Test mode only accepts the merchant's own email; live mode uses the customer's.
    const payment = client.createPayment(input.reference, env.PAYNOW_AUTH_EMAIL ?? input.customerEmail);
    // One line for the whole order so the amount is exact (no float sums of item prices).
    payment.add(`LoveNest order ${input.reference}`, Number(amountString(input.amountCents)));
    const res = await withTimeout(client.sendMobile(payment, input.phone, input.method));
    if (!res) return { ok: false, error: 'Could not reach Paynow. Please try again.' };
    if (!res.success || !res.pollUrl) return { ok: false, error: res.error || 'Paynow declined the payment request.' };
    return { ok: true, pollUrl: res.pollUrl, instructions: res.instructions || 'Approve the payment on your phone.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Payment could not be started.' };
  }
}

/**
 * Asks Paynow for the latest status (an empty POST to the poll URL). We make the request
 * ourselves because the SDK's pollTransaction drops the reference and amount, which we need
 * to match the payment to the order; parsing and hash checks still use the SDK.
 */
export async function pollPayment(pollUrl: string): Promise<StatusResult> {
  if (!client) return simulator.poll(pollUrl);
  const url = new URL(pollUrl);
  if (url.protocol !== 'https:' || !/(^|\.)paynow\.co\.zw$/.test(url.hostname)) throw new Error('Unexpected poll URL.');
  const res = await withTimeout(fetch(url, { method: 'POST' }));
  return verifiedStatus(await res.text());
}

/** Verifies and parses the form-encoded body Paynow POSTs to our result URL. */
export function parseResultUpdate(rawBody: string): StatusResult {
  if (!client) return simulator.parse();
  return verifiedStatus(rawBody);
}

function verifiedStatus(body: string): StatusResult {
  if (!client) throw new Error('Paynow is not configured.');
  const values = client.parseQuery(body);
  if ((values.status ?? '').toLowerCase() === 'error') throw new Error(values.error || 'Paynow returned an error.');
  if (!client.verifyHash(values)) throw new Error('Invalid Paynow hash.');
  return {
    reference: values.reference ?? '',
    amount: values.amount ?? '',
    paynowReference: values.paynowreference ?? '',
    pollUrl: values.pollurl ?? '',
    status: values.status ?? '',
    outcome: outcomeOf(values.status ?? ''),
  };
}

// ---------- development simulator ----------

type SimTxn = { reference: string; amount: string; createdAt: number; number: string };
const simTxns = new Map<string, SimTxn>();

const simulator = {
  initiate(input: { reference: string; amountCents: number; phone: string }): InitResult {
    if (input.phone === '0774444444') return { ok: false, error: 'Insufficient balance' };
    const pollUrl = `simulated://paynow/${encodeURIComponent(input.reference)}/${crypto.randomUUID()}`;
    simTxns.set(pollUrl, { reference: input.reference, amount: amountString(input.amountCents), createdAt: Date.now(), number: input.phone });
    return { ok: true, pollUrl, instructions: 'Development simulator: no real payment is made. Use 0771111111 to succeed or 0773333333 to cancel.' };
  },
  poll(pollUrl: string): StatusResult {
    const txn = simTxns.get(pollUrl);
    if (!txn) throw new Error('Unknown payment.');
    const age = Date.now() - txn.createdAt;
    let status = 'Sent';
    if (txn.number === '0773333333' && age > 5_000) status = 'Cancelled';
    else if (txn.number === '0772222222' ? age > 15_000 : age > 5_000) status = 'Paid';
    return { reference: txn.reference, amount: txn.amount, paynowReference: `SIM-${txn.reference}`, pollUrl, status, outcome: outcomeOf(status) };
  },
  parse(): StatusResult {
    throw new Error('Result updates are not used by the simulator.');
  },
};
