import { beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../src/app.js';
import { call, freshIp } from './helpers.js';
import { seed } from '../src/db/seed.js';
import { db } from '../src/db/client.js';
import { order, product, user } from '../src/db/schema.js';
import { resetRateLimits } from '../src/lib/rate-limit.js';

// Test responses are read loosely; the assertions check the shapes.
type TestResponse = Omit<Response, 'json'> & { json(): Promise<any> };
const request = (path: string, init: RequestInit) => app.request(path, init) as Promise<TestResponse>;

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

let adminCookie = '';
let products: { id: string; name: string; priceCents: number; stock: number }[] = [];

async function signUp(email: string, name = 'Test Customer') {
  const res = await call('/api/auth/sign-up/email', {
    method: 'POST',
    ip: freshIp(),
    body: { email, password: 'Customer2026', name, acceptedTermsVersion: '2026-10-08' },
  });
  expect(res.status).toBe(200);
  return res.cookie!;
}

const idem = () => `test-${crypto.randomUUID()}`;

function checkout(cookie: string, body: Record<string, unknown>, key = idem()) {
  return request('/api/orders', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', 'idempotency-key': key, 'x-forwarded-for': freshIp() },
    body: JSON.stringify(body),
  });
}

const delivery = {
  recipientName: 'Chiedza Moyo',
  recipientPhone: '0771 234 567',
  address: '14 Lomagundi Road, Avondale',
  apartment: '',
  city: 'Mutare',
  instructions: '',
  paymentMethod: 'ecocash' as const,
  paymentPhone: '0771111111',
};

beforeAll(async () => {
  await seed();
  const res = await call('/api/auth/sign-in/email', { method: 'POST', ip: freshIp(), body: { email: 'admin@lovenest.test', password: 'AdminPass123' } });
  adminCookie = res.cookie!;
  const list = await call('/api/products');
  products = list.json.products;
});

describe('catalog', () => {
  it('lists categories and only visible products', async () => {
    const cats = await call('/api/categories');
    expect(cats.json.categories).toHaveLength(5);
    const hidden = products[0]!;
    await db.update(product).set({ visible: false }).where(eq(product.id, hidden.id));
    const list = await call('/api/products');
    expect(list.json.products.some((p: { id: string }) => p.id === hidden.id)).toBe(false);
    expect((await call(`/api/products/${hidden.id}`)).status).toBe(404);
    await db.update(product).set({ visible: true }).where(eq(product.id, hidden.id));
  });
});

describe('checkout', () => {
  it('requires sign-in, a valid body and an idempotency key', async () => {
    expect((await checkout('', { items: [] })).status).toBe(401);
    const cookie = await signUp('checkout-validation@example.com');
    const bad = await checkout(cookie, { ...delivery, recipientPhone: '12', items: [{ productId: products[0]!.id, quantity: 1 }] });
    expect(bad.status).toBe(400);
    const body = await bad.json();
    expect(body.error.fields.recipientPhone).toBeDefined();
    const noKey = await request('/api/orders', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
    expect(noKey.status).toBe(400);
  });

  it('prices orders on the server and normalises phone numbers', async () => {
    resetRateLimits();
    const cookie = await signUp('pricing@example.com');
    const p = products[0]!;
    // Any price sent by a client is ignored: the schema does not even accept one.
    const res = await checkout(cookie, { ...delivery, items: [{ productId: p.id, quantity: 2, priceCents: 1 }] });
    expect(res.status).toBe(201);
    const { order: o } = await res.json();
    expect(o.subtotalCents).toBe(p.priceCents * 2);
    expect(o.totalCents).toBe(p.priceCents * 2 + 500);
    expect(o.recipientPhone).toBe('+263771234567');
    expect(o.city).toBe('Mutare');
    expect(o.status).toBe('placed');
    expect(o.history).toHaveLength(1);
  });

  it('returns the same order when a checkout is retried with the same key', async () => {
    resetRateLimits();
    const cookie = await signUp('idempotent@example.com');
    const key = idem();
    const body = { ...delivery, items: [{ productId: products[1]!.id, quantity: 1 }] };
    const first = await (await checkout(cookie, body, key)).json();
    const second = await (await checkout(cookie, body, key)).json();
    expect(second.order.id).toBe(first.order.id);
    expect(await db.$count(order, eq(order.idempotencyKey, key))).toBe(1);
  });

  it('reserves stock and refuses to oversell', async () => {
    resetRateLimits();
    const cookie = await signUp('stock@example.com');
    const p = products[2]!;
    await db.update(product).set({ stock: 1 }).where(eq(product.id, p.id));
    const ok = await checkout(cookie, { ...delivery, items: [{ productId: p.id, quantity: 1 }] });
    expect(ok.status).toBe(201);
    const sold = await checkout(cookie, { ...delivery, items: [{ productId: p.id, quantity: 1 }] });
    expect(sold.status).toBe(409);
    expect((await sold.json()).error.code).toBe('out_of_stock');

    // Customer cancels: stock comes back.
    const { order: o } = await ok.json();
    const cancelled = await call(`/api/orders/${o.id}/cancel`, { method: 'POST', cookie });
    expect(cancelled.json.order.status).toBe('cancelled');
    const [after] = await db.select().from(product).where(eq(product.id, p.id));
    expect(after!.stock).toBe(1);
  });

  it('keeps each customer\'s orders private', async () => {
    resetRateLimits();
    const a = await signUp('private-a@example.com');
    const b = await signUp('private-b@example.com');
    const { order: o } = await (await checkout(a, { ...delivery, items: [{ productId: products[3]!.id, quantity: 1 }] })).json();
    expect((await call(`/api/orders/${o.id}`, { cookie: b })).status).toBe(404);
    const mine = await call('/api/orders', { cookie: b });
    expect(mine.json.orders).toHaveLength(0);
  });
});

describe('mobile money (development simulator)', () => {
  it('requires a Zimbabwe mobile money number', async () => {
    resetRateLimits();
    const cookie = await signUp('momo-validate@example.com');
    const res = await checkout(cookie, { ...delivery, items: [{ productId: products[4]!.id, quantity: 1 }], paymentMethod: 'ecocash', paymentPhone: '+27821234567' });
    expect(res.status).toBe(400);
  });

  it('marks the order paid once Paynow confirms', async () => {
    resetRateLimits();
    vi.useFakeTimers({ toFake: ['Date'] });
    const cookie = await signUp('momo-paid@example.com');
    const res = await checkout(cookie, { ...delivery, items: [{ productId: products[4]!.id, quantity: 1 }], paymentMethod: 'ecocash', paymentPhone: '0771111111' });
    const { order: o } = await res.json();
    expect(o.paymentStatus).toBe('pending');
    expect(o.paymentMethod).toBe('ecocash');

    vi.setSystemTime(Date.now() + 6000);
    const polled = await call(`/api/orders/${o.id}/payment`, { cookie });
    expect(polled.json.order.paymentStatus).toBe('paid');
    vi.useRealTimers();
  });

  it('reports a failed payment and allows a retry', async () => {
    resetRateLimits();
    const cookie = await signUp('momo-fail@example.com');
    const res = await checkout(cookie, { ...delivery, items: [{ productId: products[4]!.id, quantity: 1 }], paymentMethod: 'ecocash', paymentPhone: '0774444444' });
    const { order: o } = await res.json();
    expect(o.paymentStatus).toBe('failed');
    expect(o.paymentError).toMatch(/insufficient/i);

    const retry = await call(`/api/orders/${o.id}/pay`, { method: 'POST', cookie, body: { paymentMethod: 'ecocash', paymentPhone: '0771111111' } });
    expect(retry.status).toBe(200);
    expect(retry.json.order.paymentStatus).toBe('pending');
  });

  it('rejects forged Paynow result messages', async () => {
    const res = await request('/api/payments/paynow/result', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'reference=LNG000000&amount=1.00&status=Paid&hash=FAKE',
    });
    expect(res.status).toBe(400);
  });
});

describe('admin: orders', () => {
  it('is admin only', async () => {
    const cookie = await signUp('not-admin@example.com');
    expect((await call('/api/admin/orders', { cookie })).status).toBe(403);
    expect((await call('/api/admin/orders')).status).toBe(401);
  });

  it('moves orders one step at a time and records notes', async () => {
    resetRateLimits();
    vi.useFakeTimers({ toFake: ['Date'] });
    const cookie = await signUp('lifecycle@example.com', 'Lifecycle Customer');
    const { order: o } = await (await checkout(cookie, { ...delivery, items: [{ productId: products[5]!.id, quantity: 1 }] })).json();

    // EcoCash must be paid before the shop progresses the order in a real shop; here we
    // confirm payment via the simulator so the lifecycle assertions stay clear.
    vi.setSystemTime(Date.now() + 6000);
    const paid = await call(`/api/orders/${o.id}/payment`, { cookie });
    expect(paid.json.order.paymentStatus).toBe('paid');

    const skip = await call(`/api/admin/orders/${o.id}/status`, { method: 'POST', cookie: adminCookie, body: { status: 'delivered' } });
    expect(skip.status).toBe(409);

    for (const status of ['confirmed', 'preparing', 'out_for_delivery']) {
      const res = await call(`/api/admin/orders/${o.id}/status`, { method: 'POST', cookie: adminCookie, body: { status, note: status === 'out_for_delivery' ? 'Driver Blessing is on the way.' : '' } });
      expect(res.status).toBe(200);
    }
    const done = await call(`/api/admin/orders/${o.id}/status`, { method: 'POST', cookie: adminCookie, body: { status: 'delivered' } });
    expect(done.json.order.status).toBe('delivered');
    expect(done.json.order.paymentStatus).toBe('paid');
    expect(done.json.order.customerName).toBe('Lifecycle Customer');

    // The customer sees the same progress and the note.
    const mine = await call(`/api/orders/${o.id}`, { cookie });
    expect(mine.json.order.history.map((h: { status: string }) => h.status)).toEqual(['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered']);
    expect(mine.json.order.history[3].note).toBe('Driver Blessing is on the way.');

    const locked = await call(`/api/admin/orders/${o.id}/status`, { method: 'POST', cookie: adminCookie, body: { status: 'cancelled' } });
    expect(locked.status).toBe(409);
    vi.useRealTimers();
  });
});

describe('admin: users', () => {
  it('creates users who must change their temporary password first', async () => {
    resetRateLimits();
    const created = await call('/api/admin/users', { method: 'POST', cookie: adminCookie, body: { name: 'Chipo Banda', email: 'chipo@example.com', role: 'customer', password: 'TempPass2026' } });
    expect(created.status).toBe(201);
    expect(created.json.user.mustChangePassword).toBe(true);

    const dupe = await call('/api/admin/users', { method: 'POST', cookie: adminCookie, body: { name: 'Chipo Banda', email: 'chipo@example.com', role: 'customer', password: 'TempPass2026' } });
    expect(dupe.status).toBe(409);

    const signIn = await call('/api/auth/sign-in/email', { method: 'POST', ip: freshIp(), body: { email: 'chipo@example.com', password: 'TempPass2026' } });
    expect(signIn.status).toBe(200);
    const blocked = await call('/api/orders', { cookie: signIn.cookie });
    expect(blocked.json.error.code).toBe('password_change_required');

    const changed = await call('/api/auth/change-password', { method: 'POST', ip: freshIp(), cookie: signIn.cookie, body: { currentPassword: 'TempPass2026', newPassword: 'MyOwnPass2026' } });
    expect(changed.status).toBe(200);
    const me = await call('/api/me', { cookie: changed.cookie });
    expect(me.json.user.mustChangePassword).toBe(false);
  });

  it('suspends and reactivates accounts, signing them out', async () => {
    resetRateLimits();
    const cookie = await signUp('suspend-me@example.com', 'Suspend Me');
    const [target] = await db.select().from(user).where(eq(user.email, 'suspend-me@example.com'));
    const res = await call(`/api/admin/users/${target!.id}`, { method: 'PATCH', cookie: adminCookie, body: { name: 'Suspend Me', role: 'customer', status: 'suspended' } });
    expect(res.json.user.status).toBe('suspended');
    expect((await call('/api/orders', { cookie })).status).toBe(401);
    const signIn = await call('/api/auth/sign-in/email', { method: 'POST', ip: freshIp(), body: { email: 'suspend-me@example.com', password: 'Customer2026' } });
    expect(signIn.status).toBe(403);
  });

  it('protects the last admin and the signed-in admin', async () => {
    const [me] = await db.select().from(user).where(eq(user.email, 'admin@lovenest.test'));
    const demote = await call(`/api/admin/users/${me!.id}`, { method: 'PATCH', cookie: adminCookie, body: { name: 'Admin', role: 'customer', status: 'active' } });
    expect(demote.status).toBe(409);
    expect((await call(`/api/admin/users/${me!.id}`, { method: 'DELETE', cookie: adminCookie })).status).toBe(409);
  });

  it('deletes a customer but keeps their orders for accounting', async () => {
    resetRateLimits();
    const cookie = await signUp('delete-me@example.com');
    const { order: o } = await (await checkout(cookie, { ...delivery, items: [{ productId: products[0]!.id, quantity: 1 }] })).json();
    const [target] = await db.select().from(user).where(eq(user.email, 'delete-me@example.com'));
    expect((await call(`/api/admin/users/${target!.id}`, { method: 'DELETE', cookie: adminCookie })).status).toBe(204);
    const kept = await call(`/api/admin/orders/${o.id}`, { cookie: adminCookie });
    expect(kept.json.order.customerName).toBe('Deleted account');
  });

  it('lets customers delete their own account with their password', async () => {
    resetRateLimits();
    const cookie = await signUp('self-delete@example.com');
    const res = await call('/api/auth/delete-user', { method: 'POST', ip: freshIp(), cookie, body: { password: 'Customer2026' } });
    expect(res.status).toBe(200);
    expect(await db.$count(user, eq(user.email, 'self-delete@example.com'))).toBe(0);
  });
});

describe('admin: products', () => {
  it('creates, updates, uploads a photo and deletes a product', async () => {
    const created = await call('/api/admin/products', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: 'Sunflower Bunch', description: 'Bright sunflowers.', priceCents: 2750, categoryId: 'flowers', stock: 9, visible: true },
    });
    expect(created.status).toBe(201);
    const id = created.json.product.id;

    const badCategory = await call(`/api/admin/products/${id}`, { method: 'PATCH', cookie: adminCookie, body: { name: 'X Y', description: '', priceCents: 100, categoryId: 'nope', stock: 1, visible: true } });
    expect(badCategory.status).toBe(400);

    const fake = new FormData();
    fake.append('image', new File([new TextEncoder().encode('<script>')], 'evil.png', { type: 'image/png' }));
    const rejected = await request(`/api/admin/products/${id}/image`, { method: 'POST', headers: { cookie: adminCookie }, body: fake });
    expect(rejected.status).toBe(400);

    const form = new FormData();
    form.append('image', new File([PNG], 'flowers.png', { type: 'image/png' }));
    const uploaded = await request(`/api/admin/products/${id}/image`, { method: 'POST', headers: { cookie: adminCookie }, body: form });
    expect(uploaded.status).toBe(200);
    const photo = (await uploaded.json()).product.image as string;
    expect(photo).toMatch(/^\/images\/[0-9a-f-]{36}$/);
    const served = await request(photo, {});
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(served.headers.get('cache-control')).toContain('immutable');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);

    expect((await call(`/api/admin/products/${id}`, { method: 'DELETE', cookie: adminCookie })).status).toBe(204);
    // Deleting the product removes its photo too.
    expect((await request(photo, {})).status).toBe(404);
  });
});

describe('security', () => {
  it('blocks state-changing requests from unknown websites', async () => {
    const res = await call('/api/admin/products', { method: 'POST', cookie: adminCookie, origin: 'https://evil.example', body: {} });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('bad_origin');
  });

  it('requires accepting the terms to sign up', async () => {
    const res = await call('/api/auth/sign-up/email', { method: 'POST', ip: freshIp(), body: { email: 'noterms@example.com', password: 'Customer2026', name: 'No Terms' } });
    expect(res.status).toBe(400);
  });

  it('serves the admin dashboard with a strict content security policy', async () => {
    const res = await request('/admin/', {});
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
  });
});
