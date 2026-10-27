import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser } from '../middleware/auth.js';
import { rateLimit } from '../lib/rate-limit.js';
import { badRequest } from '../lib/errors.js';
import { LIMITS, parseBody, phoneNumber, text } from '../lib/validation.js';
import { detectImageType, ImageTooLargeError, isAllowedImageType, MAX_IMAGE_BYTES } from '../lib/storage.js';
import { createOrder, customerCancel, listOrders, loadOrder, submitPaymentProof } from '../services/orders.js';
import type { AppEnv } from '../app.js';

const checkoutSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(20) }))
    .min(1, 'Your cart is empty.')
    .max(30),
  recipientName: text.clean(2, LIMITS.name, "Recipient's name"),
  recipientPhone: phoneNumber,
  address: text.clean(5, LIMITS.address, 'Address'),
  apartment: text.optionalClean(LIMITS.apartment, 'Apartment'),
  city: text.optionalClean(LIMITS.city, 'City'),
  instructions: text.optionalClean(LIMITS.instructions, 'Instructions'),
  giftMessage: text.optionalClean(LIMITS.giftMessage, 'Gift message'),
  paymentMethod: z.enum(['ecocash']),
  paymentPhone: z.string().optional(),
});

const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Customer order endpoints. Every query is scoped to the signed-in user. */
export const orderRoutes = new Hono<AppEnv>()
  .use('*', requireUser)
  .get('/', async (c) => {
    const orders = await listOrders({ userId: c.get('user')!.id, limit: 100 });
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
  .get('/:id/payment', async (c) => {
    const { dto } = await loadOrder({ id: c.req.param('id'), userId: c.get('user')!.id });
    return c.json({ order: dto });
  })
  .post('/:id/proof', rateLimit('payment-proof', { max: 8, windowMs: 15 * 60_000 }), async (c) => {
    const form = await c.req.formData();
    const file = form.get('image');
    if (!(file instanceof File)) throw badRequest('Attach a screenshot in the "image" field.');
    if (file.size > MAX_IMAGE_BYTES) throw badRequest('Use a screenshot smaller than 5 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type || !isAllowedImageType(type)) throw badRequest('Choose a JPG, PNG or WebP screenshot.');
    try {
      const order = await submitPaymentProof(c.req.param('id'), c.get('user')!.id, bytes, type);
      return c.json({ order });
    } catch (e) {
      if (e instanceof ImageTooLargeError) throw badRequest(e.message);
      throw e;
    }
  })
  .post('/:id/cancel', async (c) => {
    const order = await customerCancel(c.req.param('id'), c.get('user')!.id);
    return c.json({ order });
  });
