# Diablo — portfolio

Personal developer site for Diablo, full-time developer. Live at https://xdiablo.xyz

- Vite + vanilla JS. Three.js for a custom-shader centrepiece: cracked obsidian with molten fissures
  (warped Worley plates, procedural studio lighting that follows the cursor, heat that opens up on scroll, ember dust)
- Editorial type: Bodoni Moda display, Geist and Geist Mono for text and details
- Load sequence, masked text reveals, scroll-keyed scene, counters, magnetic buttons, card tilt and parallax
- `prefers-reduced-motion` renders one static frame; no WebGL falls back to a static image
- Mobile: dedicated portrait hero, pixel ratio capped at 1.5, lighter mesh, rendering paused when the tab is hidden

```
npm install
npm run dev     # http://localhost:4800
npm run build
```

TODO(owner): add a Telegram link in the contact section of `index.html`.
