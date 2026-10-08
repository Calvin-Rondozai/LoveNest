import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { order, orderEvent, orderItem, product, user } from '../db/schema.js';
import { env } from '../env.js';
import { ApiError, conflict, notFound } from '../lib/errors.js';
import { canTransition, STATUS_LABEL, type OrderStatus } from '../lib/order-status.js';
import { initiateMobilePayment, pollPayment, type MobileMethod, type StatusResult } from '../lib/paynow.js';
import { localZimNumber } from '../lib/validation.js';
import { orderDto } from './serializers.js';

export type CheckoutInput = {
  items: { productId: string; quantity: number }[];
  recipientName: string;
  recipientPhone: string;
  address: string;
  apartment: string;
  city?: string;
  instructions: string;
  giftMessage: string;
  paymentMethod: 'ecocash';
  paymentPhone: string; // E.164 EcoCash number
};

/** Delivery area for now. The app no longer asks for a city. */
export const DELIVERY_CITY = 'Mutare';

type Customer = { id: string; email: string };

// ---------- reading ----------

export async function loadOrder(where: { id: string; userId?: string }) {
  const conditions = [eq(order.id, where.id)];
  if (where.userId) conditions.push(eq(order.userId, where.userId));
  const [o] = await db.select().from(order).where(and(...conditions));
  if (!o) throw notFound('Order');
  const [items, events] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, o.id)),
    db.select().from(orderEvent).where(eq(orderEvent.orderId, o.id)),
  ]);
  return { order: o, dto: orderDto(o, items, events) };
}

export async function listOrders(filter: { id?: string; userId?: string; statuses?: OrderStatus[]; limit?: number }) {
  const conditions = [];
  if (filter.id) conditions.push(eq(order.id, filter.id));
  if (filter.userId) conditions.push(eq(order.userId, filter.userId));
  if (filter.statuses?.length) conditions.push(inArray(order.status, filter.statuses));
  const orders = await db
    .select({ order, customerName: user.name, customerEmail: user.email })
    .from(order)
    .leftJoin(user, eq(order.userId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(order.createdAt))
    .limit(filter.limit ?? 200);
  if (!orders.length) return [];

  const ids = orders.map((o) => o.order.id);
  const [items, events] = await Promise.all([
    db.select().from(orderItem).where(inArray(orderItem.orderId, ids)),
    db.select().from(orderEvent).where(inArray(orderEvent.orderId, ids)),
  ]);
  return orders.map(({ order: o, customerName, customerEmail }) => ({
    ...orderDto(
      o,
      items.filter((i) => i.orderId === o.id),
      events.filter((e) => e.orderId === o.id),
    ),
    customerName: customerName ?? 'Deleted account',
    customerEmail: customerEmail ?? '',
  }));
}

// ---------- checkout ----------

const newOrderNumber = () => `LNG${Math.floor(100000 + Math.random() * 900000)}`;

/**
 * Creates an order from product ids and quantities. Prices and stock come from the database,
 * never from the client. Stock is reserved in the same transaction. Retrying with the same
 * idempotency key returns the original order instead of creating another.
 */
export async function createOrder(customer: Customer, input: CheckoutInput, idempotencyKey: string) {
  const [existing] = await db.select().from(order).where(eq(order.idempotencyKey, idempotencyKey));
  if (existing) {
    if (existing.userId !== customer.id) throw conflict('idempotency_conflict', 'This request id was already used.');
    return (await loadOrder({ id: existing.id })).dto;
  }

  // Merge duplicate lines for the same product.
  const quantities = new Map<string, number>();
  for (const line of input.items) quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);

  const products = await db.select().from(product).where(inArray(product.id, [...quantities.keys()]));
  const missing = [...quantities.keys()].filter((id) => !products.some((p) => p.id === id && p.visible));
  if (missing.length) throw new ApiError(409, 'product_unavailable', 'Some items are no longer available. Please review your cart.');

  const lines = products.map((p) => ({ product: p, quantity: quantities.get(p.id)! }));
  const short = lines.find((l) => l.product.stock < l.quantity);
  if (short) throw new ApiError(409, 'out_of_stock', `Only ${short.product.stock} of ${short.product.name} left.`);

  const subtotalCents = lines.reduce((sum, l) => sum + l.product.priceCents * l.quantity, 0);
  const deliveryFeeCents = env.DELIVERY_FEE_CENTS;
  const totalCents = subtotalCents + deliveryFeeCents;

  let orderId = '';
  for (let attempt = 0; attempt < 5 && !orderId; attempt++) {
    try {
      orderId = await db.transaction(async (tx) => {
        // Reserve stock; the WHERE guard makes concurrent checkouts safe.
        for (const l of lines) {
          const res = await tx
            .update(product)
            .set({ stock: sql`${product.stock} - ${l.quantity}` })
            .where(and(eq(product.id, l.product.id), gte(product.stock, l.quantity), eq(product.visible, true)));
          if (res.rowsAffected !== 1) throw new ApiError(409, 'out_of_stock', `${l.product.name} just sold out.`);
        }
        const [created] = await tx
          .insert(order)
          .values({
            orderNumber: newOrderNumber(),
            userId: customer.id,
            paymentMethod: input.paymentMethod,
            subtotalCents,
            deliveryFeeCents,
            totalCents,
            recipientName: input.recipientName,
            recipientPhone: input.recipientPhone,
            address: input.address,
            apartment: input.apartment,
            city: DELIVERY_CITY,
            instructions: input.instructions,
            giftMessage: input.giftMessage,
            idempotencyKey,
            paymentPhone: input.paymentPhone,
          })
          .returning({ id: order.id });
        await tx.insert(orderItem).values(
          lines.map((l) => ({ orderId: created!.id, productId: l.product.id, name: l.product.name, priceCents: l.product.priceCents, quantity: l.quantity })),
        );
        await tx.insert(orderEvent).values({ orderId: created!.id, status: 'placed' });
        return created!.id;
      });
    } catch (e) {
      // Retry only on a rare order-number collision.
      if (e instanceof Error && /order_number|UNIQUE constraint failed: order\.order_number/i.test(e.message)) continue;
      if (e instanceof Error && /idempotency/i.test(e.message)) {
        const [dupe] = await db.select().from(order).where(eq(order.idempotencyKey, idempotencyKey));
        if (dupe && dupe.userId === customer.id) return (await loadOrder({ id: dupe.id })).dto;
      }
      throw e;
    }
  }
  if (!orderId) throw new ApiError(503, 'try_again', 'Could not create your order. Please try again.');

  await startMobilePayment(orderId, customer, input.paymentPhone, input.paymentMethod);
  return (await loadOrder({ id: orderId })).dto;
}

// ---------- payments ----------

/** Sends the EcoCash approval prompt to the customer's phone. */
export async function startMobilePayment(orderId: string, customer: Customer, phoneE164: string, method: MobileMethod) {
  const { order: o } = await loadOrder({ id: orderId, userId: customer.id });
  if (o.status === 'cancelled') throw conflict('order_cancelled', 'This order was cancelled.');
  if (o.paymentStatus === 'paid') throw conflict('already_paid', 'This order is already paid.');

  const result = await initiateMobilePayment({
    reference: o.orderNumber,
    amountCents: o.totalCents,
    phone: localZimNumber(phoneE164),
    method,
    customerEmail: customer.email,
  });

  await db
    .update(order)
    .set(
      result.ok
        ? { paymentMethod: method, paymentPhone: phoneE164, paymentStatus: 'pending', paymentError: null, paynowPollUrl: result.pollUrl }
        : { paymentMethod: method, paymentPhone: phoneE164, paymentStatus: 'failed', paymentError: result.error },
    )
    .where(eq(order.id, o.id));

  return result.ok ? { instructions: result.instructions } : { error: result.error };
}

const lastPolled = new Map<string, number>();

/** Re-checks a pending mobile money payment with Paynow (at most every 3 seconds per order). */
export async function refreshPayment(orderId: string, userId?: string) {
  const { order: o } = await loadOrder({ id: orderId, userId });
  if (o.paymentStatus === 'pending' && o.paynowPollUrl) {
    const now = Date.now();
    if (now - (lastPolled.get(o.id) ?? 0) >= 3000) {
      lastPolled.set(o.id, now);
      try {
        await applyPaymentStatus(await pollPayment(o.paynowPollUrl));
      } catch {
        // Paynow unreachable: keep the order pending; the result URL or a later poll will catch up.
      }
    }
  }
  return (await loadOrder({ id: orderId, userId })).dto;
}

/**
 * Applies a verified Paynow status to the matching order. Idempotent: replays and
 * out-of-order messages cannot move a paid order backwards.
 */
export async function applyPaymentStatus(status: StatusResult) {
  const [o] = await db.select().from(order).where(eq(order.orderNumber, status.reference));
  if (!o) return { applied: false, reason: 'unknown_reference' as const };

  if (status.outcome === 'paid') {
    const expected = (o.totalCents / 100).toFixed(2);
    if (Number(status.amount).toFixed(2) !== expected) {
      // Never mark paid on an amount mismatch; flag for a human to review.
      await db.update(order).set({ paymentError: `Amount mismatch: paid ${status.amount}, expected ${expected}.` }).where(eq(order.id, o.id));
      return { applied: false, reason: 'amount_mismatch' as const };
    }
    if (o.paymentStatus !== 'paid') {
      await db
        .update(order)
        .set({ paymentStatus: 'paid', paymentError: null, paidAt: new Date(), paynowReference: status.paynowReference || o.paynowReference })
        .where(eq(order.id, o.id));
    }
    return { applied: true };
  }

  if (o.paymentStatus === 'paid' && status.outcome !== 'refunded') return { applied: false, reason: 'already_paid' as const };
  if (status.outcome === 'failed') {
    await db.update(order).set({ paymentStatus: 'failed', paymentError: 'The payment was cancelled or declined.' }).where(eq(order.id, o.id));
  } else if (status.outcome === 'refunded') {
    await db.update(order).set({ paymentStatus: 'refunded' }).where(eq(order.id, o.id));
  }
  return { applied: true };
}

// ---------- status changes ----------

/** Admin moves an order one step forward or cancels it. */
export async function changeStatus(orderId: string, to: OrderStatus, note: string, adminId: string) {
  const { order: o } = await loadOrder({ id: orderId });
  if (!canTransition(o.status, to)) {
    throw conflict('invalid_transition', `This order is ${STATUS_LABEL[o.status].toLowerCase()} and cannot move to "${STATUS_LABEL[to]}".`);
  }
  await db.transaction(async (tx) => {
    const res = await tx
      .update(order)
      .set({ status: to })
      .where(and(eq(order.id, o.id), eq(order.status, o.status))); // guards against two admins at once
    if (res.rowsAffected !== 1) throw conflict('stale', 'This order was just updated by someone else. Refresh and try again.');
    await tx.insert(orderEvent).values({ orderId: o.id, status: to, note: note || null, createdBy: adminId });
    if (to === 'cancelled') await restoreStock(tx, o.id);
  });
  return (await loadOrder({ id: o.id })).dto;
}

/** Customers may cancel their own order until it is confirmed and while it is unpaid. */
export async function customerCancel(orderId: string, userId: string) {
  const { order: o } = await loadOrder({ id: orderId, userId });
  if (o.status !== 'placed') throw conflict('cannot_cancel', 'This order is already being handled. Contact us to change it.');
  if (o.paymentStatus === 'paid') throw conflict('cannot_cancel', 'This order is paid. Contact us to cancel and get a refund.');
  await db.transaction(async (tx) => {
    const res = await tx.update(order).set({ status: 'cancelled' }).where(and(eq(order.id, o.id), eq(order.status, 'placed')));
    if (res.rowsAffected !== 1) throw conflict('stale', 'This order was just updated. Refresh and try again.');
    await tx.insert(orderEvent).values({ orderId: o.id, status: 'cancelled', note: 'Cancelled at your request.' });
    await restoreStock(tx, o.id);
  });
  return (await loadOrder({ id: o.id, userId })).dto;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function restoreStock(tx: Tx, orderId: string) {
  const items = await tx.select().from(orderItem).where(eq(orderItem.orderId, orderId));
  for (const item of items) {
    if (item.productId) {
      await tx.update(product).set({ stock: sql`${product.stock} + ${item.quantity}` }).where(eq(product.id, item.productId));
    }
  }
}
