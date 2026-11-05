// Home page motion: "exhibition opening". Uses Motion (the framework-free successor of Framer Motion)
// for springs, staggers and scroll reveals. Runs only when html.motion is set, i.e. the visitor has not
// asked for reduced motion (see Base.astro). Starting states live in home.css under `html.motion`, so
// nothing flashes; if this script never runs, the page's failsafe shows everything (html.hm-timeout).
//
// LCP rule: the show title is the page's largest paint, so it is never hidden: it only moves.
import { animate, inView, stagger } from 'motion';

const html = document.documentElement;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;   // strong ease-out: entrances
const CURTAIN = [0.32, 0.72, 0, 1] as const;    // drawer-like: the photo unveiling

const $$ = (sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>(sel));

/** Fade-and-rise a group of elements in order. */
const rise = (els: Element[], startDelay = 0, gap = 0.07) =>
  els.length &&
  animate(
    els,
    { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0px)'] },
    { duration: 0.6, ease: EASE_OUT, delay: stagger(gap, { startDelay }) },
  );

/** Unveil images from the bottom up, like a curtain on opening night. */
const unveil = (els: Element[], startDelay = 0) =>
  els.length &&
  animate(els, { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 1.1, ease: CURTAIN, delay: stagger(0.12, { startDelay }) });

if (html.classList.contains('motion')) {
  // 1. The opening: photo unveils, title settles (transform only), the rest rises in after it.
  unveil($$('.h-hero-fig picture, .h-hero-fig > img'), 0.1);
  animate('.h-title', { transform: ['translateY(0.16em)', 'translateY(0em)'] }, { type: 'spring', bounce: 0.18, duration: 0.9 });
  rise($$('.h-intro, .h-badge, .h-lede, .h-note, .h-hero-text > div:last-child'), 0.15, 0.08);

  // 2. Each section rises in as it is reached, one time only.
  const onView = (sel: string, run: (el: HTMLElement) => void) =>
    $$(sel).forEach((el) => inView(el, () => run(el), { margin: '0px 0px -12% 0px' }));

  onView('.h-head', (el) => rise([el]));
  onView('.h-program', (el) => rise($$('li', el), 0.05, 0.1));
  onView('.h-shows', (el) => rise($$('li', el), 0.05, 0.09));
  onView('.h-artists', (el) => {
    rise($$(':scope > div:first-child', el));
    rise([...$$('.h-chips li', el), ...$$('.h-key', el)], 0.15, 0.025);
  });
  onView('.h-story', (el) => {
    rise($$(':scope > div:first-child, .h-quote', el), 0, 0.12);
    rise($$('.h-timeline li', el), 0.3, 0.09);
  });
  onView('.h-rent', (el) => {
    rise($$('.h-rent-text', el));
    unveil($$('.h-rent-pics picture', el), 0.1);
  });
  onView('.h-visit', (el) => rise($$(':scope > div:first-child, .h-map', el), 0, 0.12));
  onView('.h-faq-wrap', (el) => rise($$(':scope > *', el), 0, 0.08));
  onView('.h-join-in', (el) => rise($$(':scope > *', el), 0, 0.1));

  // 3. The map pin calls attention to itself twice, then stays still.
  onView('.pmap', (el) => {
    const ring = el.querySelector('.pmap-pulse');
    if (ring)
      animate(ring, { transform: ['translate(-50%, -50%) scale(1)', 'translate(-50%, -50%) scale(3.2)'], opacity: [0.75, 0] },
        { duration: 1.4, ease: EASE_OUT, repeat: 1, delay: 0.5 });
  });

  html.classList.add('hm-ok');
}
