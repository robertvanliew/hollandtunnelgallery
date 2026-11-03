export const SITE_URL = 'https://www.hollandtunnelgallery.com';

/** One switch for the private demo: false = noindex everywhere + robots.txt disallow. */
export const PUBLIC_SITE = import.meta.env.PUBLIC_SITE === 'true';

export const EMAIL = 'info@hollandtunnelgallery.com';

/** Date the artist research was last reviewed (shown in each profile's "Sources & verification" box). */
export const LAST_REVIEWED = '2026-09-27';

export const ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: '46 Chambers Street',
  addressLocality: 'Newburgh',
  addressRegion: 'NY',
  postalCode: '12550',
  addressCountry: 'US',
} as const;

export const GALLERY = {
  '@type': 'ArtGallery',
  '@id': `${SITE_URL}/#gallery`,
  name: 'Holland Tunnel Gallery',
  url: `${SITE_URL}/`,
  address: ADDRESS,
} as const;

export const NAV = [
  { href: '/exhibitions', label: 'Exhibitions', key: 'exhibitions' },
  { href: '/events', label: 'Events', key: 'events' },
  { href: '/artists', label: 'Artists', key: 'artists' },
  { href: '/#next-up', label: 'Cinema Club', key: 'cinema-club' },
  { href: '/rent', label: 'Rent the Space', key: 'rent' },
  { href: 'https://www.hollandtunnelgallery.com/publications-and-objects-shop', label: 'Shop', key: 'shop' },
  { href: '/about', label: 'About', key: 'about' },
  { href: '/#visit', label: 'Visit', key: 'visit' },
] as const;
