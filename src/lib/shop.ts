// The shop: books and tote bags. There is no online payment: a visitor sends an order request
// (src/pages/api/forms.ts, form "shop-order"), the gallery gets it by email, and Paulien replies to
// arrange payment and shipping or pickup. Prices here are the only prices: the server looks them up,
// so an edited form can't change what is charged.
// Descriptions use only what the old Squarespace shop said; add more detail as it's confirmed.
import tote1 from '../assets/shop/jacques-roch-tote-bag-1.jpg';
import tote2 from '../assets/shop/jacques-roch-tote-bag-2.jpg';
import book1 from '../assets/shop/holland-tunnel-gallery-book-1.jpg';
import book2 from '../assets/shop/holland-tunnel-gallery-book-2.jpg';
import book3 from '../assets/shop/holland-tunnel-gallery-book-3.jpg';
import book4 from '../assets/shop/holland-tunnel-gallery-book-4.jpg';
import book5 from '../assets/shop/holland-tunnel-gallery-book-5.jpg';
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
    summary:
      'Holland Tunnel Gallery: Williamsburg Brooklyn, Paros Greece. The history of a unique gallery, by Dutch sisters Paulien Lethen and Heleen Schuttevaêr: a complete survey of the exhibitions and events in the gallery\'s three art spaces from 1997 to 2015. Lethen tells how gritty, industrial Williamsburg became the colorful New Bohemia when the artists moved in, and then a developer\'s paradise.',
    details: [
      '260 pages in full color, with more than 500 photos.',
      'Introductions by art critic Dominique Nahas and novelist and poet Serge Gavronsky; preface by Jan Kennis, cultural attaché of the Netherlands Consulate in New York.',
      'Book design by Céline Bouchez.',
      'Published with a grant from the Netherland-America Foundation.',
      'Ships within the USA; shipping is added. Or pick it up at the gallery in Newburgh.',
    ],
    images: [
      { src: book1, alt: 'Cover of the Holland Tunnel Gallery book' },
      { src: book2, alt: 'Spread from the book: Williamsburg 1997, with black and white street photos' },
      { src: book3, alt: 'Spread from the book: the original Holland Tunnel Gallery, a garden shed in a Williamsburg backyard' },
      { src: book4, alt: 'Spread from the book: Stairmasters 1, the brownstone next to the gallery' },
      { src: book5, alt: 'Spread from the book: Williamsburg 2014, new buildings in the old neighborhood' },
    ],
  },
  {
    slug: 'good-heavens-artist-cookbook',
    title: 'Good Heavens! Artist Cookbook: Erotic Pasta & Fruity Salad',
    kind: 'Book',
    price: 20,
    summary:
      'A Holland Tunnel Gallery publication with simple, tasty recipes by Dutch artist Paulien Lethen, the gallery\'s director and a creative cook, illustrated by French artist Jacques Roch. A lighthearted book: have fun reading the instructions and looking at the drawings while you cook, and have a good time with your guests.',
    details: [
      '64 pages of recipes and drawings.',
      'Recipes by Paulien Lethen, illustrations by Jacques Roch.',
      'Ships within the USA; shipping is added. Or pick it up at the gallery in Newburgh.',
    ],
    artist: { name: 'Jacques Roch', url: '/artists/jacques-roch' },
    images: [{ src: cookbook1, alt: 'Cover of Good Heavens! Artist Cookbook: Erotic Pasta & Fruity Salad' }],
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
