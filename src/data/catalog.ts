export type Category = { id: string; name: string; icon: string; iconSet: 'ion' | 'mci' };

export const categories: Category[] = [
  { id: 'birthday', name: 'Birthday Gifts', icon: 'gift-outline', iconSet: 'ion' },
  { id: 'romance', name: 'Love & Romance', icon: 'heart-outline', iconSet: 'ion' },
  { id: 'flowers', name: 'Flowers', icon: 'flower-outline', iconSet: 'ion' },
  { id: 'toys', name: 'Toys & More', icon: 'teddy-bear', iconSet: 'mci' },
  { id: 'corporate', name: 'Corporate Gifts', icon: 'briefcase-outline', iconSet: 'ion' },
];

export type Product = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  icon: string;
  iconSet: 'ion' | 'mci';
  description: string;
};

export const products: Product[] = [
  { id: 'p1', name: 'Red Rose Bouquet', price: 35, categoryId: 'flowers', icon: 'flower', iconSet: 'ion', description: 'A dozen fresh red roses, hand-tied with satin ribbon.' },
  { id: 'p2', name: 'Cute Teddy Bear', price: 20, categoryId: 'toys', icon: 'teddy-bear', iconSet: 'mci', description: 'Soft plush teddy bear with a red bow, 30cm tall.' },
  { id: 'p3', name: 'Premium Chocolate Box', price: 15, categoryId: 'romance', icon: 'gift', iconSet: 'ion', description: 'Assorted Belgian chocolates in an elegant gift box.' },
  { id: 'p4', name: 'Birthday Cake Hamper', price: 42, categoryId: 'birthday', icon: 'balloon', iconSet: 'ion', description: 'Chocolate cake, balloons and a birthday card, all in one.' },
  { id: 'p5', name: 'Corporate Gift Set', price: 55, categoryId: 'corporate', icon: 'briefcase', iconSet: 'ion', description: 'Branded notebook, pen and mug set for your business partners.' },
  { id: 'p6', name: 'Love Letter Card', price: 8, categoryId: 'romance', icon: 'mail', iconSet: 'ion', description: 'A handwritten-style love note card with envelope.' },
];

export const deliveryFee = 5;

export const centsPad = (amount: number) => Math.round((amount + 0.03) * 100) / 100;
