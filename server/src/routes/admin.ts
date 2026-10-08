import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { auth } from '../auth.js';
import { db } from '../db/client.js';
import { account, category, orderItem, product, user } from '../db/schema.js';
import { requireAdmin } from '../middleware/auth.js';
import { ApiError, badRequest, conflict, notFound } from '../lib/errors.js';
import { ORDER_STATUSES } from '../db/app-schema.js';
import { LIMITS, emailAddress, parseBody, password, personName, text } from '../lib/validation.js';
import { deleteProductImage, detectImageType, isAllowedImageType, MAX_IMAGE_BYTES, storeProductImage } from '../lib/storage.js';
import { productDto } from '../services/serializers.js';
import { changeStatus, listOrders } from '../services/orders.js';
import type { AppEnv } from '../app.js';

// ---------- users ----------

type Role = 'admin' | 'customer';
const toRole = (r: string | null | undefined): Role => (r === 'admin' ? 'admin' : 'customer');
const toAuthRole = (r: Role) => (r === 'admin' ? 'admin' : 'user');

async function userDtos(ids?: string[]) {
  const users = await db
    .select()
    .from(user)
    .where(ids ? inArray(user.id, ids) : undefined)
    .orderBy(desc(user.createdAt));
  const accounts = users.length
    ? await db.select({ userId: account.userId, providerId: account.providerId }).from(account).where(inArray(account.userId, users.map((u) => u.id)))
    : [];
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: toRole(u.role),
    provider: accounts.some((a) => a.userId === u.id && a.providerId === 'google') ? 'google' : 'password',
    status: u.banned ? 'suspended' : 'active',
    mustChangePassword: Boolean(u.mustChangePassword),
    createdAt: u.createdAt.toISOString(),
  }));
}

async function activeAdminCount(excludingId?: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(user)
    .where(and(eq(user.role, 'admin'), eq(user.banned, false), excludingId ? ne(user.id, excludingId) : undefined));
  return Number(row?.n ?? 0);
}

const createUserSchema = z.object({
  name: personName,
  email: emailAddress,
  role: z.enum(['admin', 'customer']),
  password,
});
const updateUserSchema = z.object({
  name: personName,
  role: z.enum(['admin', 'customer']),
  status: z.enum(['active', 'suspended']),
});

// ---------- products ----------

const productSchema = z.object({
  name: text.clean(2, LIMITS.productName, 'Name'),
  description: text.optionalClean(LIMITS.productDescription, 'Description'),
  priceCents: z.number().int().min(1, 'The price must be more than zero.').max(1_000_000, 'The price looks too high.'),
  categoryId: z.string().min(1, 'Choose a category.'),
  stock: z.number().int().min(0).max(99_999),
  visible: z.boolean(),
});

async function assertCategory(id: string) {
  const [row] = await db.select().from(category).where(eq(category.id, id));
  if (!row) throw badRequest('Choose a valid category.', { categoryId: 'Choose a valid category.' });
}

// ---------- orders ----------

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: text.optionalClean(LIMITS.orderNote, 'Message'),
});

export const adminRoutes = new Hono<AppEnv>()
  .use('*', requireAdmin)

  // Users
  .get('/users', async (c) => c.json({ users: await userDtos() }))

  .post('/users', async (c) => {
    const input = await parseBody(c, createUserSchema);
    const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email));
    if (taken) throw new ApiError(409, 'email_taken', 'An account with this email already exists.', { email: 'An account with this email already exists.' });
    const created = await auth.api.createUser({
      headers: c.req.raw.headers,
      body: { email: input.email, password: input.password, name: input.name, role: toAuthRole(input.role) },
    });
    // Temporary password: the user must choose their own at first sign-in.
    await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, created.user.id));
    const [dto] = await userDtos([created.user.id]);
    return c.json({ user: dto }, 201);
  })

  .patch('/users/:id', async (c) => {
    const id = c.req.param('id');
    const me = c.get('user')!;
    const input = await parseBody(c, updateUserSchema);
    const [target] = await db.select().from(user).where(eq(user.id, id));
    if (!target) throw notFound('User');

    const losingAdmin = target.role === 'admin' && !target.banned && (input.role === 'customer' || input.status === 'suspended');
    if (id === me.id && losingAdmin) throw conflict('self', 'You cannot remove your own admin access.');
    if (losingAdmin && (await activeAdminCount(id)) === 0) throw conflict('last_admin', 'You need at least one active admin.');

    await db.update(user).set({ name: input.name, role: toAuthRole(input.role) }).where(eq(user.id, id));
    if (input.status === 'suspended' && !target.banned) {
      await auth.api.banUser({ headers: c.req.raw.headers, body: { userId: id, banReason: 'Suspended by an admin' } }); // also signs them out
    } else if (input.status === 'active' && target.banned) {
      await auth.api.unbanUser({ headers: c.req.raw.headers, body: { userId: id } });
    }
    const [dto] = await userDtos([id]);
    return c.json({ user: dto });
  })

  .delete('/users/:id', async (c) => {
    const id = c.req.param('id');
    if (id === c.get('user')!.id) throw conflict('self', 'You cannot delete your own account here.');
    const [target] = await db.select().from(user).where(eq(user.id, id));
    if (!target) throw notFound('User');
    if (target.role === 'admin' && (await activeAdminCount(id)) === 0) throw conflict('last_admin', 'You need at least one admin.');
    // Removes the user, their sessions and sign-in methods. Orders stay for accounting, unlinked.
    await auth.api.removeUser({ headers: c.req.raw.headers, body: { userId: id } });
    return c.body(null, 204);
  })

  // Products
  .get('/products', async (c) => {
    const rows = await db.select().from(product).orderBy(desc(product.createdAt));
    return c.json({ products: rows.map(productDto) });
  })

  .post('/products', async (c) => {
    const input = await parseBody(c, productSchema);
    await assertCategory(input.categoryId);
    const [row] = await db.insert(product).values(input).returning();
    return c.json({ product: productDto(row!) }, 201);
  })

  .patch('/products/:id', async (c) => {
    const input = await parseBody(c, productSchema);
    await assertCategory(input.categoryId);
    const [row] = await db.update(product).set(input).where(eq(product.id, c.req.param('id'))).returning();
    if (!row) throw notFound('Product');
    return c.json({ product: productDto(row) });
  })

  .delete('/products/:id', async (c) => {
    const id = c.req.param('id');
    const [row] = await db.select().from(product).where(eq(product.id, id));
    if (!row) throw notFound('Product');
    // Past orders keep their item names and prices; only the link to the product is cleared.
    await db.update(orderItem).set({ productId: null }).where(eq(orderItem.productId, id));
    await db.delete(product).where(eq(product.id, id));
    await deleteProductImage(row.imagePublicId);
    return c.body(null, 204);
  })

  .post('/products/:id/image', async (c) => {
    const id = c.req.param('id');
    const [row] = await db.select().from(product).where(eq(product.id, id));
    if (!row) throw notFound('Product');

    const form = await c.req.parseBody();
    const file = form.image;
    if (!(file instanceof File)) throw badRequest('Attach a photo in the "image" field.');
    if (file.size > MAX_IMAGE_BYTES) throw badRequest('This photo is larger than 5 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type || !isAllowedImageType(type)) throw badRequest('Choose a JPG, PNG or WebP image.');

    const stored = await storeProductImage(bytes, type);
    const [updated] = await db.update(product).set({ imageUrl: stored.url, imagePublicId: stored.publicId }).where(eq(product.id, id)).returning();
    await deleteProductImage(row.imagePublicId);
    return c.json({ product: productDto(updated!) });
  })

  .delete('/products/:id/image', async (c) => {
    const id = c.req.param('id');
    const [row] = await db.select().from(product).where(eq(product.id, id));
    if (!row) throw notFound('Product');
    const [updated] = await db.update(product).set({ imageUrl: null, imagePublicId: null }).where(eq(product.id, id)).returning();
    await deleteProductImage(row.imagePublicId);
    return c.json({ product: productDto(updated!) });
  })

  // Orders
  .get('/orders', async (c) => c.json({ orders: await listOrders({ limit: 500 }) }))

  .get('/orders/:id', async (c) => {
    const [full] = await listOrders({ id: c.req.param('id'), limit: 1 });
    if (!full) throw notFound('Order');
    return c.json({ order: full });
  })

  .post('/orders/:id/status', async (c) => {
    const input = await parseBody(c, statusSchema);
    await changeStatus(c.req.param('id'), input.status, input.note, c.get('user')!.id);
    const [full] = await listOrders({ id: c.req.param('id'), limit: 1 });
    return c.json({ order: full });
  });
