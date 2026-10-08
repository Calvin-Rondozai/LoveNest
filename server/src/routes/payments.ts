import { Hono } from 'hono';
import { parseResultUpdate } from '../lib/paynow.js';
import { applyPaymentStatus } from '../services/orders.js';
import type { AppEnv } from '../app.js';

/**
 * Paynow's server calls this URL whenever a payment status changes. The body is form-encoded
 * and signed; anything with a bad hash is rejected. We always answer quickly with 200 for
 * valid messages so Paynow does not keep retrying.
 */
export const paymentRoutes = new Hono<AppEnv>().post('/paynow/result', async (c) => {
  const raw = await c.req.text();
  let status;
  try {
    status = parseResultUpdate(raw);
  } catch {
    return c.text('Invalid', 400);
  }
  await applyPaymentStatus(status);
  return c.text('OK');
});
