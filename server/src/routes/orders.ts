import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser } from '../middleware/auth.js';
import { rateLimit } from '../lib/rate-limit.js';
import { badRequest } from '../lib/errors.js';
import { LIMITS, parseBody, phoneNumber, text, zimMobileMoneyNumber } from '../lib/validation.js';
import { createOrder, customerCancel, listOrders, loadOrder, refreshPayment, startMobilePayment } from '../services/orders.js';
import type { AppEnv } from '../app.js';

const checkoutSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(20) }))
      .min(1, 'Your cart is empty.')
      .max(30),
    recipientName: text.clean(2, LIMITS.name, "Recipient's name"),
    recipientPhone: phoneNumber,
    address: text.clean(5, LIMITS.address, 'Address'),
    apartment: text.optionalClean(LIMITS.apartment, 'Apartment'),
    // City is accepted for older clients but always stored as Mutare (delivery area for now).
    city: text.optionalClean(LIMITS.city, 'City'),
    instructions: text.optionalClean(LIMITS.instructions, 'Instructions'),
    giftMessage: text.optionalClean(LIMITS.giftMessage, 'Gift message'),
    paymentMethod: z.enum(['ecocash']),
    paymentPhone: zimMobileMoneyNumber,
  });

const paySchema = z.object({ paymentMethod: z.enum(['ecocash']), paymentPhone: zimMobileMoneyNumber });

const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Customer order endpoints. Every query is scoped to the signed-in user. */
export const orderRoutes = new Hono<AppEnv>()
  .use('*', requireUser)
  .get('/', async (c) => {
    const orders = await listOrders({ userId: c.get('user')!.id, limit: 100 });
    // Customers never see other people's names; strip the admin-only fields.
    return c.json({ orders: orders.map(({ customerName: _n, customerEmail: _e, ...o }) => o) });
  })
  .post('/', rateLimit('checkout', { max: 10, windowMs: 10 * 60_000 }), async (c) => {
    const key = c.req.header('Idempotency-Key') ?? '';
    if (!IDEMPOTENCY_RE.test(key)) throw badRequest('Missing or invalid Idempotency-Key header.');
    const input = await parseBody(c, checkoutSchema);
    const user = c.get('user')!;
    const order = await createOrder({ id: user.id, email: user.email }, input, key);
    return c.json({ order }, 201);
  })
  .get('/:id', async (c) => {
    const { dto } = await loadOrder({ id: c.req.param('id'), userId: c.get('user')!.id });
    return c.json({ order: dto });
  })
  .get('/:id/payment', rateLimit('payment-status', { max: 120, windowMs: 10 * 60_000 }), async (c) => {
    const order = await refreshPayment(c.req.param('id'), c.get('user')!.id);
    return c.json({ order });
  })
  .post('/:id/pay', rateLimit('payment-retry', { max: 5, windowMs: 10 * 60_000 }), async (c) => {
    const input = await parseBody(c, paySchema);
    const user = c.get('user')!;
    const result = await startMobilePayment(c.req.param('id'), { id: user.id, email: user.email }, input.paymentPhone, input.paymentMethod);
    const { dto } = await loadOrder({ id: c.req.param('id'), userId: user.id });
    return c.json({ order: dto, ...result });
  })
  .post('/:id/cancel', async (c) => {
    const order = await customerCancel(c.req.param('id'), c.get('user')!.id);
    return c.json({ order });
  });
