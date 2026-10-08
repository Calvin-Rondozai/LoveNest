import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema.js';

// Money is stored as integer cents to avoid floating-point rounding errors.
// Timestamps are stored as Unix milliseconds.

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());
const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date());

export const ORDER_STATUSES = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'] as const;
export const PAYMENT_METHODS = ['ecocash', 'onemoney', 'cod'] as const;
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;

export const category = sqliteTable('category', {
  id: text('id').primaryKey(), // readable slug, e.g. "flowers"
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  iconSet: text('icon_set', { enum: ['ion', 'mci'] }).notNull().default('ion'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const product = sqliteTable(
  'product',
  {
    id: id(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priceCents: integer('price_cents').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'restrict' }),
    stock: integer('stock').notNull().default(0),
    visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
    imageUrl: text('image_url'),
    imagePublicId: text('image_public_id'), // Cloudinary id, used to delete the old photo
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('product_category_idx').on(t.categoryId),
    check('product_price_positive', sql`${t.priceCents} > 0`),
    check('product_stock_non_negative', sql`${t.stock} >= 0`),
  ],
);

export const order = sqliteTable(
  'order',
  {
    id: id(),
    orderNumber: text('order_number').notNull(),
    /** Null once the customer deletes their account; the order is kept for accounting. */
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    status: text('status', { enum: ORDER_STATUSES }).notNull().default('placed'),
    paymentMethod: text('payment_method', { enum: PAYMENT_METHODS }).notNull(),
    paymentStatus: text('payment_status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),
    subtotalCents: integer('subtotal_cents').notNull(),
    deliveryFeeCents: integer('delivery_fee_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    recipientName: text('recipient_name').notNull(),
    recipientPhone: text('recipient_phone').notNull(),
    address: text('address').notNull(),
    apartment: text('apartment').notNull().default(''),
    city: text('city').notNull(),
    instructions: text('instructions').notNull().default(''),
    giftMessage: text('gift_message').notNull().default(''),
    /** Sent by the app with each checkout so a retried request never creates a second order. */
    idempotencyKey: text('idempotency_key').notNull(),
    /** Mobile money number that approves the payment (E.164). */
    paymentPhone: text('payment_phone'),
    paymentError: text('payment_error'),
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
    paynowReference: text('paynow_reference'),
    paynowPollUrl: text('paynow_poll_url'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('order_number_unique').on(t.orderNumber),
    uniqueIndex('order_idempotency_unique').on(t.idempotencyKey),
    index('order_user_idx').on(t.userId),
    index('order_status_idx').on(t.status),
  ],
);

export const orderItem = sqliteTable(
  'order_item',
  {
    id: id(),
    orderId: text('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    // Kept even if the product is later deleted; name and price are snapshots.
    productId: text('product_id').references(() => product.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('order_item_order_idx').on(t.orderId), check('order_item_quantity_positive', sql`${t.quantity} > 0`)],
);

export const orderEvent = sqliteTable(
  'order_event',
  {
    id: id(),
    orderId: text('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ORDER_STATUSES }).notNull(),
    note: text('note'),
    /** Admin who made the change; null for system events such as payment confirmation. */
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('order_event_order_idx').on(t.orderId)],
);
