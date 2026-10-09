import { Hono } from 'hono';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { category, product } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { categoryDto, productDto } from '../services/serializers.js';
import { env } from '../env.js';
import { DELIVERY_FEE_RULES } from '../lib/delivery-fee.js';
import { paynowMode } from '../lib/paynow.js';
import type { AppEnv } from '../app.js';

/** Public catalog for the app. Hidden products are never returned here. */
export const catalogRoutes = new Hono<AppEnv>()
  .get('/config', (c) =>
    c.json({
      legalVersion: env.LEGAL_VERSION,
      payments: paynowMode,
      mobileMoney: ['ecocash'],
      deliveryFee: DELIVERY_FEE_RULES,
      // Kept for older app builds: fee for a cart under the threshold.
      deliveryFeeCents: DELIVERY_FEE_RULES.belowCents,
    }),
  )
  .get('/categories', async (c) => {
    const rows = await db.select().from(category).orderBy(asc(category.sortOrder));
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ categories: rows.map(categoryDto) });
  })
  .get('/products', async (c) => {
    const rows = await db.select().from(product).where(eq(product.visible, true)).orderBy(desc(product.createdAt));
    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ products: rows.map(productDto) });
  })
  .get('/products/:id', async (c) => {
    const [row] = await db.select().from(product).where(and(eq(product.id, c.req.param('id')), eq(product.visible, true)));
    if (!row) throw notFound('Product');
    return c.json({ product: productDto(row) });
  });
