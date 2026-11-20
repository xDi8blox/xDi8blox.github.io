import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/bodoni-moda';
import '@fontsource-variable/bodoni-moda/wght-italic.css';
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
$$('#mega .ch').forEach((c, i) => c.style.setProperty('--i', i));
$$('.tagline .tl').forEach((t, i) => t.style.setProperty('--d', 520 + i * 160));
$$('[data-hero]').forEach((el) => el.style.setProperty('--d', 380 + Number(el.dataset.hero) * 130));
// per-group stagger for reveals
$$('[data-stagger]').forEach((g) => $$(':scope > [data-reveal]', g).forEach((el, i) => el.style.setProperty('--i', i % 3)));

/* ---------- reveals ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
$$('[data-reveal],[data-split]').forEach((el) => io.observe(el));

/* ---------- counters ---------- */
function countUp(el) {
  const to = Number(el.dataset.count), from = Number(el.dataset.from || 0), suffix = el.dataset.suffix || '';
  if (reduced) { el.textContent = to + suffix; return; }
  const t0 = performance.now(), dur = 1600;
  const tick = (now) => {
    const t = clamp((now - t0) / dur), e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    el.textContent = Math.round(from + (to - from) * e) + (t === 1 ? suffix : '');
    if (t < 1) requestAnimationFrame(tick);
  };
  el.textContent = from;
  requestAnimationFrame(tick);
}
const cio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } }), { threshold: 0.6 });
$$('[data-count]').forEach((el) => cio.observe(el));

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
  $('#mega').style.setProperty('--my', (y * 0.14).toFixed(1) + 'px');
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

/* ---------- WebGL scene ---------- */
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
      const api = m.initScene(canvas, { reduced });
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
  window.__scene && window.__scene.startIntro();
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
    p = Math.max(p, Math.min(0.92, elapsed / 2200)); // eased fake progress, jumps to 1 on ready
    paint(); requestAnimationFrame(tick);
  };
  tick();
  const ready = Promise.all([boot(), document.fonts ? document.fonts.ready : 0]);
  await Promise.race([ready, new Promise((r) => setTimeout(r, 4000))]);
  const wait = Math.max(0, 2300 - (performance.now() - t0)); // never flash the loader
  await new Promise((r) => setTimeout(r, wait));
  done = true; p = 1; paint();
  setTimeout(start, 250);
})();


/* ---------- background music: starts only on a tap, fades, pauses when hidden ---------- */
const sndBtn = $('#sndBtn');
const bgm = $('#bgm');
const FADE = 1.2;
let soundOn = false, audioCtx = null, audioGain = null, audioAnalyser = null, amp = 0, ampBuf = null;
window.__diabloAmp = () => {
  if (!audioAnalyser || !soundOn) { amp *= .9; return amp; }
  if (!ampBuf) ampBuf = new Uint8Array(audioAnalyser.fftSize);
  audioAnalyser.getByteTimeDomainData(ampBuf);
  let s = 0;
  for (let i = 0; i < ampBuf.length; i++) { const v = (ampBuf[i] - 128) / 128; s += v * v; }
  const next = Math.min(1, Math.sqrt(s / ampBuf.length) * 3.2);
  amp += (next - amp) * .16;
  return amp;
};
function unlockAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    const src = audioCtx.createMediaElementSource(bgm);
    audioGain = audioCtx.createGain();
    audioAnalyser = audioCtx.createAnalyser();
    audioAnalyser.fftSize = 256;
    audioAnalyser.smoothingTimeConstant = .85;
    audioGain.gain.value = 0;
    src.connect(audioGain);
    audioGain.connect(audioAnalyser);
    audioAnalyser.connect(audioCtx.destination);
  } catch (err) {
    audioCtx = audioGain = audioAnalyser = null;
    console.warn('Web Audio unavailable, using element volume', err);
  }
}
function fadeGain(to, after) {
  if (audioGain && audioCtx) {
    const g = audioGain.gain, now = audioCtx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + FADE);
    if (after) setTimeout(after, FADE * 1000 + 40);
    return;
  }
  const from = bgm.volume, t0 = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / (FADE * 1000));
    bgm.volume = from + (to - from) * t;
    if (t < 1) requestAnimationFrame(tick);
    else if (after) after();
  };
  requestAnimationFrame(tick);
}
function setSoundUI(on) {
  sndBtn.classList.toggle('on', on);
  sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  sndBtn.setAttribute('aria-label', on ? 'Sound, on' : 'Sound, off');
}
async function startSound() {
  unlockAudio();
  bgm.loop = true;
  if (!audioGain) bgm.volume = 0;
  try { await bgm.play(); }
  catch (err) { console.warn('Audio play blocked', err); return; }
  soundOn = true;
  setSoundUI(true);
  try { localStorage.setItem('diablo-sound', 'on'); } catch {}
  fadeGain(audioGain ? .72 : .72);
}
function stopSound() {
  soundOn = false;
  setSoundUI(false);
  try { localStorage.setItem('diablo-sound', 'off'); } catch {}
  fadeGain(0, () => { if (!soundOn) bgm.pause(); });
}
sndBtn.addEventListener('click', () => { soundOn ? stopSound() : startSound(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (soundOn) { bgm.pause(); if (audioCtx && audioCtx.state === 'running') audioCtx.suspend(); }
  } else if (soundOn) {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    bgm.play().catch(() => {});
  }
});

/* ---------- copy email ---------- */
const copyBtn = $('#copyBtn');
copyBtn.addEventListener('click', async () => {
  const addr = 'Humanoid118@gmail.com';
  try { await navigator.clipboard.writeText(addr); }
  catch { const t = document.createElement('textarea'); t.value = addr; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); }
  const label = $('span', copyBtn);
  copyBtn.classList.add('copied'); label.textContent = 'Copied';
  setTimeout(() => { copyBtn.classList.remove('copied'); label.textContent = 'Copy address'; }, 2000);
});

/* ---------- fit the wordmark to the viewport ---------- */
const mega = $('#mega');
function fitMega() {
  const tall = innerWidth <= 760;
  const rows = $$('.row', mega);
  mega.style.fontSize = '100px';
  const w = Math.max(...rows.map((r) => r.getBoundingClientRect().width)) * (tall ? 1 : 1);
  const total = tall ? w : rows.reduce((a, r) => a + r.getBoundingClientRect().width, 0);
  const target = innerWidth * (tall ? 0.94 : 0.985);
  mega.style.fontSize = (100 * target / total).toFixed(2) + 'px';
  const fs = parseFloat(mega.style.fontSize);
  // the hero reserves exactly the wordmark's height
  const h = tall ? fs * 0.76 * 2 : fs * 0.74;
  document.documentElement.style.setProperty('--mega-h', h.toFixed(0) + 'px');
}
if (document.fonts) document.fonts.ready.then(fitMega);
fitMega();
addEventListener('resize', fitMega);
