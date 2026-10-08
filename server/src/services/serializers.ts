import type { InferSelectModel } from 'drizzle-orm';
import type { category, product, order, orderItem, orderEvent } from '../db/schema.js';

// Shapes returned by the API. Prices are given both in cents (exact) and as dollars (display).

type Category = InferSelectModel<typeof category>;
type Product = InferSelectModel<typeof product>;
type Order = InferSelectModel<typeof order>;
type OrderItem = InferSelectModel<typeof orderItem>;
type OrderEvent = InferSelectModel<typeof orderEvent>;

const dollars = (cents: number) => Math.round(cents) / 100;

export const categoryDto = (c: Category) => ({ id: c.id, name: c.name, icon: c.icon, iconSet: c.iconSet });

export const productDto = (p: Product) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  priceCents: p.priceCents,
  price: dollars(p.priceCents),
  categoryId: p.categoryId,
  stock: p.stock,
  inStock: p.stock > 0,
  visible: p.visible,
  image: p.imageUrl,
  createdAt: p.createdAt.toISOString(),
});

export function orderDto(o: Order, items: OrderItem[], events: OrderEvent[]) {
  return {
    id: o.id,
    orderNumber: `#${o.orderNumber}`,
    placedAt: o.createdAt.toISOString(),
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentError: o.paymentError,
    paidAt: o.paidAt?.toISOString() ?? null,
    subtotalCents: o.subtotalCents,
    deliveryFeeCents: o.deliveryFeeCents,
    totalCents: o.totalCents,
    subtotal: dollars(o.subtotalCents),
    deliveryFee: dollars(o.deliveryFeeCents),
    total: dollars(o.totalCents),
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    address: o.address,
    apartment: o.apartment,
    city: o.city,
    instructions: o.instructions,
    giftMessage: o.giftMessage,
    items: items.map((i) => ({ productId: i.productId, name: i.name, priceCents: i.priceCents, price: dollars(i.priceCents), quantity: i.quantity })),
    history: events
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => ({ status: e.status, at: e.createdAt.toISOString(), ...(e.note ? { note: e.note } : {}) })),
  };
}

export type OrderDto = ReturnType<typeof orderDto>;
