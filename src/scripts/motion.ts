// Scroll-triggered motion. Only runs when html.motion is set (i.e. the visitor hasn't asked for
// reduced motion). Adds `.in` to elements as they enter the viewport; see src/styles/motion.css.
const html = document.documentElement;

if (html.classList.contains('motion')) {
  html.classList.add('motion-ok');

  const reveal = (els: Iterable<Element>, threshold = 0.25, onIn?: (el: Element) => void) => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('in');
            onIn?.(e.target);
            io.unobserve(e.target);
          }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of els) io.observe(el);
  };

  // 2 + 3: the network graph and the connection wheels
  reveal(document.querySelectorAll('.wheel'), 0.3);
  reveal(document.querySelectorAll('.web'), 0.2, (svg) => startPulses(svg as SVGSVGElement));

  // 4: each year on the Holland Tunnel record
  reveal(document.querySelectorAll('.rec'), 0.35);

  // 5: numbers count up ("740+" keeps its "+")
  const countUp = (el: Element) => {
    const [, num, suffix] = el.textContent!.trim().match(/^(\d+)(.*)$/) ?? [];
    if (!num) return;
    const end = Number(num), t0 = performance.now(), dur = 1200;
    el.setAttribute('aria-label', el.textContent!.trim());
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = `${Math.round(end * eased)}${suffix}`;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  reveal(document.querySelectorAll('[data-count]'), 0.6, countUp);
}

/** After the web has drawn, send a small orange signal along a random connection now and then. */
function startPulses(svg: SVGSVGElement) {
  const lines = [...svg.querySelectorAll<SVGLineElement>('.w-edge')];
  if (!lines.length || !('animate' in Element.prototype)) return;
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(svg);
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.setAttribute('aria-hidden', 'true');
  svg.querySelector('.w-edges')!.after(layer);
  const send = () => {
    if (!visible || document.hidden || svg.classList.contains('focus')) return;
    const l = lines[Math.floor(Math.random() * lines.length)];
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(l.getAttribute(k)));
    const [ax, ay, bx, by] = Math.random() < 0.5 ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '3.5');
    dot.setAttribute('class', 'w-pulse');
    layer.append(dot);
    const len = Math.hypot(bx - ax, by - ay);
    dot
      .animate(
        [
          { transform: `translate(${ax}px, ${ay}px)`, opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.85 },
          { transform: `translate(${bx}px, ${by}px)`, opacity: 0 },
        ],
        { duration: Math.max(700, len * 7), easing: 'ease-in-out' },
      )
      .finished.then(() => dot.remove());
  };
  setTimeout(() => setInterval(send, 900), 2200);
}
