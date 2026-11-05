// The shop: books, shirts and bags. There is no online payment: a visitor sends an order request
// (src/pages/api/forms.ts, form "shop-order"), the gallery gets it by email, and Paulien replies to
// arrange payment and shipping or pickup. Prices here are the only prices: the server looks them up,
// so an edited form can't change what is charged.
// Descriptions use only what the old Squarespace shop said; add more detail as it's confirmed.
import shirt1 from '../assets/shop/jacques-roch-t-shirt-1.jpg';
import shirt2 from '../assets/shop/jacques-roch-t-shirt-2.jpg';
import tote1 from '../assets/shop/jacques-roch-tote-bag-1.jpg';
import tote2 from '../assets/shop/jacques-roch-tote-bag-2.jpg';
import book1 from '../assets/shop/holland-tunnel-gallery-book-1.jpg';
import cookbook1 from '../assets/shop/good-heavens-artist-cookbook-1.jpg';

export interface Product {
  slug: string;
  title: string;
  kind: string;
  price: number; // US dollars, before shipping
  options?: { label: string; values: string[] };
  summary: string;
  details: string[];
  artist?: { name: string; url: string };
  images: { src: ImageMetadata; alt: string }[];
}

export const MAX_QTY = 10;

export const PRODUCTS: Product[] = [
  {
    slug: 'holland-tunnel-gallery-book',
    title: 'Holland Tunnel Gallery Book',
    kind: 'Book',
    price: 25,
    summary: 'The Holland Tunnel Gallery book.',
    details: ['Ships within the USA; shipping is added.', 'Or pick it up at the gallery in Newburgh.'],
    images: [{ src: book1, alt: 'Cover of the Holland Tunnel Gallery book' }],
  },
  {
    slug: 'good-heavens-artist-cookbook',
    title: 'Good Heavens! Artist Cookbook: Erotic Pasta & Fruity Salad',
    kind: 'Book',
    price: 20,
    summary: 'Good Heavens! Artist Cookbook: Erotic Pasta & Fruity Salad.',
    details: ['Ships within the USA; shipping is added.', 'Or pick it up at the gallery in Newburgh.'],
    images: [{ src: cookbook1, alt: 'Cover of Good Heavens! Artist Cookbook: Erotic Pasta & Fruity Salad' }],
  },
  {
    slug: 'jacques-roch-t-shirt',
    title: 'Jacques Roch T-shirt',
    kind: 'T-shirt',
    price: 20,
    options: { label: 'Size', values: ['Small', 'Medium', 'Large', 'XLarge'] },
    summary: 'All-cotton baby-blue T-shirt with an illustration in white by artist Jacques Roch on the front. The back is plain.',
    details: ['Sizes Small to XLarge.', 'Ships within the USA, or pick it up at the gallery.'],
    artist: { name: 'Jacques Roch', url: '/artists/jacques-roch' },
    images: [
      { src: shirt1, alt: 'Baby-blue Jacques Roch T-shirt with a white illustration on the front' },
      { src: shirt2, alt: 'Jacques Roch T-shirt, second view' },
    ],
  },
  {
    slug: 'jacques-roch-tote-bag',
    title: 'Jacques Roch Tote Bag',
    kind: 'Tote bag',
    price: 15,
    summary: 'Green cotton tote bag with an illustration in white by artist Jacques Roch on one side.',
    details: ['Ships within the USA, or pick it up at the gallery.'],
    artist: { name: 'Jacques Roch', url: '/artists/jacques-roch' },
    images: [
      { src: tote1, alt: 'Green Jacques Roch tote bag with a white illustration' },
      { src: tote2, alt: 'Jacques Roch tote bag, second view' },
    ],
  },
];

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
export const money = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;
