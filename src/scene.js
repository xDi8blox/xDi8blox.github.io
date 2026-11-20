// Signal terrain — a flowing, noise-displaced landscape rendered with custom shaders.
// Solid ridgelines with topographic contours, an ember horizon haze and drifting ember dust.
// Camera, terrain shape and lighting are keyed to scroll position (see KEYS below).
import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, Mesh, ShaderMaterial, Color,
  BufferGeometry, BufferAttribute, Points, AdditiveBlending, Vector2, Vector3, Raycaster, Plane,
} from 'three';

const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const TERRAIN_VERT = /* glsl */ `
uniform float uTime, uTravel, uAmp, uFreq, uSpeed;
uniform vec2 uMouse; uniform float uMouseOn;
varying float vH; varying vec3 vN; varying vec3 vW; varying float vMouse; varying float vRidge;
${SIMPLEX}
float field(vec2 p){
  vec2 q=p*uFreq;
  float t=uTime*uSpeed;
  // domain warp for long, flowing ridges
  vec2 w=vec2(snoise(vec3(q*.5,t)),snoise(vec3(q*.5+7.3,t)));
  q+=w*.9;
  float n=snoise(vec3(q,t*.6))*.62+snoise(vec3(q*2.1,t))*.26+snoise(vec3(q*4.3,t*1.4))*.12;
  float r=1.-abs(snoise(vec3(q*.8+3.1,t*.5)));
  return mix(n,r*r*1.2-.4,.55);
}
float height(vec2 xz){
  vec2 p=vec2(xz.x,xz.y-uTravel);
  float corridor=smoothstep(0.,11.,abs(xz.x));      // gentler valley the camera flies down
  float h=field(p)*uAmp*(.34+.66*corridor);
  vec2 d=xz-uMouse;
  float md=length(d);
  h+=uMouseOn*exp(-md*md*.06)*sin(md*2.4-uTime*2.2)*.22*(.4+corridor);
  return h;
}
void main(){
  vec3 pos=position; // plane rotated: x,z in world
  vec2 xz=pos.xz;
  float h=height(xz);
  float e=.35;
  float hx=height(xz+vec2(e,0.));float hz=height(xz+vec2(0.,e));
  vN=normalize(vec3(h-hx,e,h-hz));
  pos.y=h; vH=h; vW=pos;
  vMouse=uMouseOn*exp(-dot(xz-uMouse,xz-uMouse)*.045);
  vRidge=smoothstep(.55,1.2,h/max(uAmp,.001));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
}`;

const TERRAIN_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBg, uEmber; uniform float uLines, uEmberAmt, uFogNear, uFogFar, uTime, uLineAlpha;
varying float vH; varying vec3 vN; varying vec3 vW; varying float vMouse; varying float vRidge;
float contour(float v,float w){float f=abs(fract(v-.5)-.5)/max(fwidth(v)*w,1e-4);return 1.-clamp(f,0.,1.);}
void main(){
  float dist=length(cameraPosition-vW);
  float fog=smoothstep(uFogNear,uFogFar,dist);
  float edge=smoothstep(30.,22.,abs(vW.x));
  vec3 L=normalize(vec3(-.55,.5,.55));
  float diff=max(dot(normalize(vN),L),0.);
  vec3 col=uBg+vec3(.045,.043,.04)*diff;
  float v=vH*uLines;
  float minor=contour(v,1.1);
  float major=contour(v/5.,1.4);
  vec3 line=vec3(.62,.60,.57);
  float la=(minor*.24+major*.62)*uLineAlpha;
  col=mix(col,line,la);
  // ember: ridge crests, cursor proximity, and a major-line accent
  float ember=(vRidge*.55+vMouse*1.1)*uEmberAmt;
  col+=uEmber*(major*ember*.9+minor*vMouse*uEmberAmt*.5)*.9;
  col+=uEmber*vRidge*.03*uEmberAmt*diff;
  // atmospheric haze, warmed toward the horizon
  vec3 haze=mix(uBg,uEmber*.22,smoothstep(.45,1.,fog)*uEmberAmt);
  col=mix(col,haze,fog);
  col=mix(uBg,col,edge);
  gl_FragColor=vec4(col,1.);
}`;

const DUST_VERT = /* glsl */ `
uniform float uTime, uTravel, uPx, uAmt;
attribute vec4 aSeed; varying float vA;
void main(){
  vec3 p=position;
  float cyc=fract(aSeed.w+uTime*(.012+aSeed.z*.02));
  p.y=cyc*9.;
  p.x+=sin(uTime*.25+aSeed.x*30.)*.9;
  p.z=mod(position.z+uTravel*.6+60.,80.)-62.;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=(1.4+aSeed.y*2.2)*uPx*(18./-mv.z);
  float tw=.6+.4*sin(uTime*(1.5+aSeed.x*2.)+aSeed.y*20.);
  vA=smoothstep(0.,.12,cyc)*smoothstep(1.,.5,cyc)*tw*uAmt*smoothstep(55.,8.,-mv.z);
}`;
const DUST_FRAG = /* glsl */ `
precision mediump float; uniform vec3 uEmber; varying float vA;
void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d)*vA;gl_FragColor=vec4(uEmber*a,a);}`;

const SKY_VERT = /* glsl */ `varying vec2 vN; void main(){vN=position.xy;gl_Position=vec4(position.xy,.9999,1.);}`;
const SKY_FRAG = /* glsl */ `
precision highp float; uniform mat4 uInvProj, uCam; uniform vec3 uBg, uEmber; uniform float uEmberAmt, uHorizon; varying vec2 vN;
void main(){
  vec3 d=normalize((uCam*vec4((uInvProj*vec4(vN,1.,1.)).xyz,0.)).xyz);
  float y=d.y-uHorizon;
  float band=exp(-pow(y*7.5,2.))*.55+exp(-pow(y*2.6,2.))*.25;
  float sideFade=exp(-pow(d.x*1.6,2.));
  vec3 col=uBg+uEmber*band*sideFade*.20*uEmberAmt;
  gl_FragColor=vec4(col,1.);
}`;

// scroll keyframes, one per section anchor (id). Values lerp between neighbours.
const KEYS = {
  hero:     { amp: 6.2, camY: 3.8, camZ: 14, look: 2.8, ember: 1.0, lines: 2.4, lineA: 1.0, speed: 1.0 },
  about:    { amp: 4.6, camY: 4.6, camZ: 13, look: 0.8, ember: 0.6, lines: 2.4, lineA: .8, speed: .7 },
  services: { amp: 3.2, camY: 5.8, camZ: 12, look: -1.0, ember: 0.45, lines: 2.2, lineA: .6, speed: .5 },
  work:     { amp: 2.2, camY: 7.2, camZ: 11, look: -2.0, ember: 0.35, lines: 2.8, lineA: .5, speed: .4 },
  process:  { amp: 4.2, camY: 4.4, camZ: 13, look: 0.0, ember: 0.65, lines: 1.9, lineA: .75, speed: .7 },
  contact:  { amp: 7.0, camY: 3.0, camZ: 14, look: 3.0, ember: 1.4, lines: 2.2, lineA: 1.0, speed: 1.0 },
};
const ORDER = ['hero', 'about', 'services', 'work', 'process', 'contact'];
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (t) => t * t * (3 - 2 * t);

export function initScene(canvas, opts = {}) {
  const reduced = !!opts.reduced;
  const mobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  const MAXDPR = mobile ? 1.5 : 1.75;
  let dpr = Math.min(window.devicePixelRatio || 1, MAXDPR);
  renderer.setPixelRatio(dpr);
  const bg = new Color('#0a0a0a');
  renderer.setClearColor(bg, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(48, 1, .1, 140);
  const ember = new Color('#ee6a3c');

  // sky: horizon haze behind the terrain
  const skyU = { uInvProj: { value: camera.projectionMatrixInverse }, uCam: { value: camera.matrixWorld }, uBg: { value: bg }, uEmber: { value: ember }, uEmberAmt: { value: 1 }, uHorizon: { value: 0 } };
  const sky = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU, depthWrite: false, depthTest: false }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  // terrain
  const segX = mobile ? 96 : 190, segZ = mobile ? 120 : 250;
  const geo = new PlaneGeometry(64, 86, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -22);
  const uni = {
    uTime: { value: 0 }, uTravel: { value: 0 }, uAmp: { value: 3 }, uFreq: { value: .09 }, uSpeed: { value: .06 },
    uMouse: { value: new Vector2(999, 999) }, uMouseOn: { value: 0 },
    uBg: { value: bg }, uEmber: { value: ember }, uLines: { value: 3 }, uEmberAmt: { value: 1 },
    uFogNear: { value: 14 }, uFogFar: { value: 62 }, uLineAlpha: { value: 1 },
  };
  const mat = new ShaderMaterial({ vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, uniforms: uni });
  const terrain = new Mesh(geo, mat);
  terrain.frustumCulled = false;
  scene.add(terrain);

  // ember dust
  const N = mobile ? 380 : 900;
  const dg = new BufferGeometry();
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - .5) * 46; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = Math.random() * 80 - 62;
    seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random();
  }
  dg.setAttribute('position', new BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new BufferAttribute(seed, 4));
  const duni = { uTime: uni.uTime, uTravel: uni.uTravel, uPx: { value: dpr }, uAmt: { value: 1 }, uEmber: { value: ember } };
  const dust = new Points(dg, new ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: duni,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // layout / scroll mapping
  let anchors = [];
  const measure = () => {
    anchors = ORDER.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { id, c: r.top + scrollY + r.height / 2 };
    }).filter(Boolean);
  };
  const cur = { ...KEYS.hero }; const tgt = { ...KEYS.hero };
  let travelBase = 0, scrollY_ = 0;
  const readScroll = () => {
    scrollY_ = window.scrollY;
    const probe = scrollY_ + innerHeight * .5;
    let a = anchors[0], b = anchors[0], t = 0;
    for (let i = 0; i < anchors.length; i++) {
      if (probe >= anchors[i].c) { a = anchors[i]; b = anchors[Math.min(i + 1, anchors.length - 1)]; }
    }
    if (probe < anchors[0].c) { a = b = anchors[0]; }
    else if (a !== b) t = ss(Math.min(1, Math.max(0, (probe - a.c) / (b.c - a.c))));
    const ka = KEYS[a.id], kb = KEYS[b.id];
    for (const k in ka) tgt[k] = lerp(ka[k], kb[k], t);
    scene.userData.progress = Math.min(1, scrollY_ / Math.max(1, document.documentElement.scrollHeight - innerHeight));
  };

  // pointer → world-space point on the ground plane
  const ray = new Raycaster(), ground = new Plane(new Vector3(0, 1, 0), 0), hit = new Vector3(), ndc = new Vector2();
  let mx = 0, my = 0, pxTarget = 0, pyTarget = 0, pointerActive = false, lastMove = 0;
  const onMove = (e) => {
    const x = e.clientX / innerWidth, y = e.clientY / innerHeight;
    ndc.set(x * 2 - 1, -(y * 2 - 1)); pxTarget = ndc.x; pyTarget = ndc.y;
    pointerActive = true; lastMove = performance.now();
  };
  if (!mobile) addEventListener('pointermove', onMove, { passive: true });

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < .8 ? 62 : 48;
    camera.updateProjectionMatrix();
    measure(); readScroll();
    if (reduced) { Object.assign(cur, tgt); frame(0, true); }
  };

  let t0 = performance.now(), last = t0, running = false, raf = 0, slow = 0, frames = 0;
  const hud = opts.hud || (() => {});
  function frame(now, still) {
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    const time = reduced ? 8 : (now - t0) / 1000;
    uni.uTime.value = time;
    readScroll();
    const k = reduced ? 1 : 1 - Math.pow(.0015, dt); // frame-rate independent damping
    for (const key in tgt) cur[key] = lerp(cur[key], tgt[key], k);
    travelBase += reduced ? 0 : dt * 1.1 * cur.speed;
    const travel = reduced ? 10 : travelBase + scrollY_ * .006;
    uni.uTravel.value = travel;
    uni.uAmp.value = cur.amp; uni.uLines.value = cur.lines; uni.uLineAlpha.value = cur.lineA;
    uni.uEmberAmt.value = cur.ember; skyU.uEmberAmt.value = cur.ember; duni.uAmt.value = .5 + cur.ember * .6;

    // smooth pointer
    mx = lerp(mx, pxTarget, 1 - Math.pow(.01, dt)); my = lerp(my, pyTarget, 1 - Math.pow(.01, dt));
    const active = pointerActive && now - lastMove < 2500;
    uni.uMouseOn.value = lerp(uni.uMouseOn.value, active ? 1 : 0, 1 - Math.pow(.05, dt));
    camera.position.set(mx * .7, cur.camY + my * .25, cur.camZ);
    camera.lookAt(mx * 1.4, cur.look + (camera.aspect < .8 ? -1.8 : 0), -18);
    camera.rotation.z += -mx * .012;
    if (!mobile && uni.uMouseOn.value > .01) {
      camera.updateMatrixWorld();
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(ground, hit)) uni.uMouse.value.set(hit.x, hit.z);
    }
    camera.updateMatrixWorld(); skyU.uHorizon.value = -0.03;
    renderer.render(scene, camera);
    hud(travel, cur);

    // adaptive resolution: if we are consistently slow, step the pixel ratio down
    if (!still && !reduced && ++frames > 30) {
      slow = dt > .026 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 40 && dpr > .8) {
        dpr = Math.max(.75, dpr - .25); renderer.setPixelRatio(dpr); duni.uPx.value = dpr; slow = 0; resize();
      }
    }
  }
  const loop = (now) => { if (!running) return; frame(now); raf = requestAnimationFrame(loop); };
  const start = () => { if (running || reduced) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });
  canvas.addEventListener('webglcontextrestored', start);
  addEventListener('resize', resize);
  if (document.fonts) document.fonts.ready.then(() => { measure(); readScroll(); });
  new ResizeObserver(() => { measure(); }).observe(document.body);

  resize();
  Object.assign(cur, tgt);
  frame(performance.now(), true);
  start();
  return { stop, start, renderer, mobile };
}
