import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------- split headings into masked words ---------- */
$$('[data-split]').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = words.map((w, i) => `<span class="sw" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ');
});
// hero word stagger index
$$('#h1 .w').forEach((w, i) => w.style.setProperty('--i', i));
$$('[data-hero]').forEach((el) => el.style.setProperty('--d', 380 + Number(el.dataset.hero) * 110));
// per-group stagger for reveals
$$('[data-stagger]').forEach((g) => $$(':scope > [data-reveal]', g).forEach((el, i) => el.style.setProperty('--i', i % 3)));

/* ---------- reveals ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
$$('[data-reveal],[data-split]').forEach((el) => io.observe(el));

/* ---------- counters ---------- */
function countUp(el) {
  const to = Number(el.dataset.count), suffix = el.dataset.suffix || '';
  if (reduced) { el.textContent = to + suffix; return; }
  const t0 = performance.now(), dur = 1600;
  const tick = (now) => {
    const t = clamp((now - t0) / dur), e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    el.textContent = Math.round(to * e) + (t === 1 ? suffix : '');
    if (t < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}
const cio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } }), { threshold: 0.6 });
$$('[data-count]').forEach((el) => cio.observe(el));
// public repo count is verifiable from the GitHub API; keep the static value if the request fails
fetch('https://api.github.com/users/xDi8blox').then((r) => (r.ok ? r.json() : null)).then((j) => {
  if (j && Number.isFinite(j.public_repos)) $('#repoCount').dataset.count = j.public_repos;
}).catch(() => {});

/* ---------- nav: state, active link, progress, hide on scroll down ---------- */
const nav = $('#nav'), bar = $('#progress');
const links = $$('[data-link]');
const secs = ['work', 'about', 'services', 'process', 'stack', 'contact'].map((id) => $('#' + id));
let lastY = 0, ticking = false;
function onScroll() {
  const y = scrollY, max = root.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  nav.classList.toggle('stuck', y > 40);
  nav.classList.toggle('hide', y > lastY + 4 && y > 400 && !document.body.classList.contains('menu-open'));
  if (y < lastY - 4 || y < 400) nav.classList.remove('hide');
  lastY = y;
  const probe = y + innerHeight * 0.35;
  let active = null;
  secs.forEach((s) => { if (s && s.offsetTop <= probe) active = s.id; });
  links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + active));
  // card image parallax + process / timeline progress
  $$('.card').forEach((c) => {
    const r = c.getBoundingClientRect();
    if (r.bottom < -50 || r.top > innerHeight + 50) return;
    c.style.setProperty('--p', ((r.top + r.height / 2 - innerHeight / 2) / innerHeight).toFixed(3));
  });
  for (const id of ['steps', 'timeline']) {
    const el = $('#' + id), r = el.getBoundingClientRect();
    el.style.setProperty('--prog', clamp((innerHeight * 0.75 - r.top) / (r.height + innerHeight * 0.1)).toFixed(3));
  }
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);

/* ---------- mobile menu ---------- */
const menuBtn = $('#menuBtn'), sheet = $('#sheet');
const setMenu = (open) => {
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', open);
  sheet.setAttribute('aria-hidden', !open);
};
menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
$$('a', sheet).forEach((a) => a.addEventListener('click', () => setMenu(false)));

/* ---------- pointer effects (fine pointers only) ---------- */
if (finePointer && !reduced) {
  // magnetic buttons
  $$('[data-magnetic]').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px,${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
  // card tilt + spotlight
  $$('[data-tilt]').forEach((c) => {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
      c.style.transform = `perspective(1100px) rotateX(${(0.5 - y) * 3.2}deg) rotateY(${(x - 0.5) * 4.2}deg) translateZ(0)`;
    });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
    c.style.transition += ',transform .7s cubic-bezier(.16,.84,.24,1)';
  });
}

/* ---------- WebGL terrain ---------- */
const hudT = $('#hudT'), hudE = $('#hudE'), hudS = $('#hudS');
const sectorOf = () => {
  const probe = scrollY + innerHeight * 0.5;
  let n = 'Hero';
  for (const [id, label] of [['about', 'About'], ['services', 'Services'], ['work', 'Work'], ['private', 'Private'], ['process', 'Process'], ['stack', 'Stack'], ['contact', 'Contact']]) {
    const el = $('#' + id); if (el && el.offsetTop <= probe) n = label;
  }
  return n;
};
let hudTick = 0;
function hud(travel, cur) {
  if (++hudTick % 4) return;
  hudT.textContent = (travel * 12.5).toFixed(1).padStart(6, '0');
  hudE.textContent = (cur.amp * 21.4).toFixed(2);
  const s = sectorOf(); if (hudS.textContent !== s) hudS.textContent = s;
}

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function boot() {
  const canvas = $('#gl');
  let sceneReady = Promise.resolve();
  if (!webglAvailable()) {
    root.classList.add('no-gl');
  } else {
    sceneReady = import('./scene.js').then((m) => {
      const api = m.initScene(canvas, { reduced, hud: reduced ? undefined : hud });
      if (!api) root.classList.add('no-gl');
      window.__scene = api;
    }).catch((err) => { console.warn('WebGL scene unavailable', err); root.classList.add('no-gl'); });
  }
  onScroll();
  return sceneReady;
}

/* ---------- load sequence ---------- */
const loader = $('#loader'), loadn = $('#loadn'), loadbar = $('#loadbar');
function start() {
  root.classList.add('started');
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 1200);
  onScroll();
}
(async function init() {
  if (reduced) { await boot(); root.classList.add('started'); loader.remove(); return; }
  let p = 0, done = false;
  const t0 = performance.now();
  const paint = () => {
    const shown = Math.round(p * 100);
    loadn.textContent = String(shown).padStart(3, '0');
    loadbar.style.transform = `scaleX(${p})`;
  };
  const tick = () => {
    if (done) return;
    const elapsed = performance.now() - t0;
    p = Math.max(p, Math.min(0.92, elapsed / 1500)); // eased fake progress, jumps to 1 on ready
    paint(); requestAnimationFrame(tick);
  };
  tick();
  const ready = Promise.all([boot(), document.fonts ? document.fonts.ready : 0]);
  await Promise.race([ready, new Promise((r) => setTimeout(r, 4000))]);
  const wait = Math.max(0, 900 - (performance.now() - t0)); // never flash the loader
  await new Promise((r) => setTimeout(r, wait));
  done = true; p = 1; paint();
  setTimeout(start, 250);
})();
