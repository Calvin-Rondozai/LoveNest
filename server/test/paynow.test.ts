import { beforeAll, describe, expect, it } from 'vitest';

// Live-mode Paynow verification with a fake integration key. Env must be set before the app
// modules load, so everything is imported dynamically.
process.env.PAYNOW_INTEGRATION_ID = '12345';
process.env.PAYNOW_INTEGRATION_KEY = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

type Mods = {
  paynow: typeof import('../src/lib/paynow.js');
  orders: typeof import('../src/services/orders.js');
  db: typeof import('../src/db/client.js')['db'];
  schema: typeof import('../src/db/schema.js');
  sdk: typeof import('paynow');
  drizzle: typeof import('drizzle-orm');
};
let m: Mods;

/** Builds a form body signed exactly like Paynow does (SDK's own hash function). */
function signed(values: Record<string, string>) {
  const client = new m.sdk.Paynow(process.env.PAYNOW_INTEGRATION_ID, process.env.PAYNOW_INTEGRATION_KEY) as unknown as {
    generateHash(v: Record<string, string>, key: string): string;
  };
  const hash = client.generateHash(values, process.env.PAYNOW_INTEGRATION_KEY!);
  return new URLSearchParams({ ...values, hash }).toString();
}

beforeAll(async () => {
  const sdkMod = await import('paynow');
  m = {
    paynow: await import('../src/lib/paynow.js'),
    orders: await import('../src/services/orders.js'),
    db: (await import('../src/db/client.js')).db,
    schema: await import('../src/db/schema.js'),
    sdk: (sdkMod as unknown as { default: typeof import('paynow') }).default ?? sdkMod,
    drizzle: await import('drizzle-orm'),
  };
  const { seed } = await import('../src/db/seed.js');
  await seed();
});

async function makeOrder(totalCents: number) {
  const [u] = await m.db.select().from(m.schema.user).limit(1);
  const number = `LNG${Math.floor(100000 + Math.random() * 900000)}`;
  const [o] = await m.db
    .insert(m.schema.order)
    .values({
      orderNumber: number,
      userId: u!.id,
      paymentMethod: 'ecocash',
      subtotalCents: totalCents - 500,
      deliveryFeeCents: 500,
      totalCents,
      recipientName: 'Test',
      recipientPhone: '+263771234567',
      address: '1 Test Road',
      city: 'Mutare',
      idempotencyKey: crypto.randomUUID(),
    })
    .returning();
  return o!;
}

describe('Paynow (live mode verification)', () => {
  it('runs in live mode when keys are present', () => {
    expect(m.paynow.paynowMode).toBe('live');
  });

  it('accepts a correctly signed result and marks the order paid', async () => {
    const o = await makeOrder(5500);
    const body = signed({ reference: o.orderNumber, paynowreference: '99887766', amount: '55.00', status: 'Paid', pollurl: 'https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc' });
    const status = m.paynow.parseResultUpdate(body);
    expect(status.outcome).toBe('paid');
    expect((await m.orders.applyPaymentStatus(status)).applied).toBe(true);
    const [after] = await m.db.select().from(m.schema.order).where(m.drizzle.eq(m.schema.order.id, o.id));
    expect(after!.paymentStatus).toBe('paid');
    expect(after!.paynowReference).toBe('99887766');
  });

  it('rejects a tampered message', () => {
    const body = signed({ reference: 'LNG111111', paynowreference: '1', amount: '1.00', status: 'Cancelled', pollurl: 'x' }).replace('Cancelled', 'Paid');
    expect(() => m.paynow.parseResultUpdate(body)).toThrow(/hash/i);
  });

  it('never marks an order paid when the amount does not match', async () => {
    const o = await makeOrder(4200);
    const body = signed({ reference: o.orderNumber, paynowreference: '5', amount: '1.00', status: 'Paid', pollurl: 'x' });
    const result = await m.orders.applyPaymentStatus(m.paynow.parseResultUpdate(body));
    expect(result.applied).toBe(false);
    const [after] = await m.db.select().from(m.schema.order).where(m.drizzle.eq(m.schema.order.id, o.id));
    expect(after!.paymentStatus).toBe('pending');
    expect(after!.paymentError).toMatch(/mismatch/i);
  });

  it('ignores a late "cancelled" message for an order that is already paid', async () => {
    const o = await makeOrder(3000);
    await m.orders.applyPaymentStatus(m.paynow.parseResultUpdate(signed({ reference: o.orderNumber, paynowreference: '7', amount: '30.00', status: 'Paid', pollurl: 'x' })));
    await m.orders.applyPaymentStatus(m.paynow.parseResultUpdate(signed({ reference: o.orderNumber, paynowreference: '7', amount: '30.00', status: 'Cancelled', pollurl: 'x' })));
    const [after] = await m.db.select().from(m.schema.order).where(m.drizzle.eq(m.schema.order.id, o.id));
    expect(after!.paymentStatus).toBe('paid');
  });

  it('only polls Paynow URLs', async () => {
    await expect(m.paynow.pollPayment('https://evil.example/steal')).rejects.toThrow(/poll url/i);
  });
});
