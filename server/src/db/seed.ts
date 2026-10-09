import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { db, client } from './client.js';
import { category, product, user } from './schema.js';
import { auth } from '../auth.js';
import { env } from '../env.js';

// Same categories and starter products as the mobile app's src/data/catalog.ts.
const CATEGORIES = [
  { id: 'birthday', name: 'Birthday Gifts', icon: 'gift-outline', iconSet: 'ion', sortOrder: 1 },
  { id: 'romance', name: 'Love & Romance', icon: 'heart-outline', iconSet: 'ion', sortOrder: 2 },
  { id: 'flowers', name: 'Flowers', icon: 'flower-outline', iconSet: 'ion', sortOrder: 3 },
  { id: 'toys', name: 'Toys & More', icon: 'teddy-bear', iconSet: 'mci', sortOrder: 4 },
  { id: 'corporate', name: 'Corporate Gifts', icon: 'briefcase-outline', iconSet: 'ion', sortOrder: 5 },
] as const;

const PRODUCTS = [
  { name: 'Red Rose Bouquet', priceCents: 3500, categoryId: 'flowers', stock: 12, description: 'A dozen fresh red roses, hand-tied with satin ribbon.' },
  { name: 'Cute Teddy Bear', priceCents: 2000, categoryId: 'toys', stock: 25, description: 'Soft plush teddy bear with a red bow, 30cm tall.' },
  { name: 'Premium Chocolate Box', priceCents: 1500, categoryId: 'romance', stock: 40, description: 'Assorted Belgian chocolates in an elegant gift box.' },
  { name: 'Birthday Cake Hamper', priceCents: 4200, categoryId: 'birthday', stock: 6, description: 'Chocolate cake, balloons and a birthday card, all in one.' },
  { name: 'Corporate Gift Set', priceCents: 5500, categoryId: 'corporate', stock: 10, description: 'Branded notebook, pen and mug set for your business partners.' },
  { name: 'Love Letter Card', priceCents: 800, categoryId: 'romance', stock: 50, description: 'A handwritten-style love note card with envelope.' },
];

/** Idempotent: safe to run more than once. */
export async function seed() {
  await db.insert(category).values([...CATEGORIES]).onConflictDoNothing();

  const existing = await db.select({ id: product.id }).from(product).limit(1);
  if (existing.length === 0) await db.insert(product).values(PRODUCTS);

  if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_PASSWORD) {
    const email = env.SEED_ADMIN_EMAIL.toLowerCase();
    let [admin] = await db.select().from(user).where(eq(user.email, email));
    if (!admin) {
      await auth.api.signUpEmail({
        body: {
          email,
          password: env.SEED_ADMIN_PASSWORD,
          name: env.SEED_ADMIN_NAME,
          acceptedTermsVersion: env.LEGAL_VERSION,
          phone: '+263771111111',
        },
      });
      [admin] = await db.select().from(user).where(eq(user.email, email));
    }
    if (admin) {
      await db
        .update(user)
        .set({ role: 'admin', emailVerified: true, phone: admin.phone || '+263771111111' })
        .where(eq(user.id, admin.id));
    }
    return { admin: email };
  }
  return { admin: null };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await seed();
  // eslint-disable-next-line no-console
  console.info(result.admin ? `Seeded catalog and admin ${result.admin}.` : 'Seeded catalog. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first admin.');
  client.close();
}
