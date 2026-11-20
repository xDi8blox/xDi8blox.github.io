# xDi8blox — portfolio

Portfolio of Bruno Fend (xDi8blox), full-time developer. Live at https://xdiablo.xyz

- Vite + vanilla JS, Three.js (custom GLSL terrain, ember dust, scroll-keyed camera), no animation framework
- Scroll reveals, split-text headings, counters, magnetic buttons, card tilt and parallax
- `prefers-reduced-motion` renders one static frame; no-WebGL falls back to a static image
- Pixel ratio capped at 1.5 on mobile, reduced geometry/particles, rendering paused when the tab is hidden

```
npm install
npm run dev     # http://localhost:4800
npm run build
```

TODO(owner): add email and Telegram links in `index.html` (contact section).
