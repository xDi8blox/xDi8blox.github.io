// DIABLO — cracked obsidian with molten fissures.
// A displaced mesh shaded entirely in custom GLSL: Worley-cell plates, derivative bump mapping,
// a procedural studio environment (key light follows the cursor, ember rim from below),
// and heat in the fissures that opens up as you scroll. Ember dust drifts around it.
import {
  WebGLRenderer, Scene, PerspectiveCamera, SphereGeometry, Mesh, ShaderMaterial, Color,
  BufferGeometry, BufferAttribute, Points, AdditiveBlending, Vector3, Group, Shape, ExtrudeGeometry,
} from 'three';

const NOISE = /* glsl */ `
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
}
vec3 hash3(vec3 p){
  p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453);
}
// returns (F1, F2) distances to nearest feature points
vec2 worley(vec3 p){
  vec3 ip=floor(p),fp=fract(p);float f1=8.,f2=8.;
  for(int k=-1;k<=1;k++)for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec3 g=vec3(float(i),float(j),float(k));
    vec3 r=g+hash3(ip+g)-fp;float d=dot(r,r);
    if(d<f1){f2=f1;f1=d;}else if(d<f2){f2=d;}
  }
  return sqrt(vec2(f1,f2));
}
// F2-F1 of a warped Worley field: ~0 on cell borders, used for both the fissures and the plate relief
float crackField(vec3 p){
  vec3 q=p*2.3+vec3(snoise(p*1.3),snoise(p*1.3+4.),snoise(p*1.3+9.))*.35;
  vec2 w=worley(q);
  return w.y-w.x;
}`;

const ROCK_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vObj; varying vec3 vW; varying vec3 vN;
${NOISE}
float disp(vec3 p){
  float plate=smoothstep(0.,.5,crackField(p));
  float rough=snoise(p*1.7);
  return .035*rough+.085*plate-.05;
}
vec3 surf(vec3 p){p=normalize(p);return p*(1.+disp(p));}
void main(){
  vec3 p=normalize(position);
  vec3 up=abs(p.y)>.95?vec3(1.,0.,0.):vec3(0.,1.,0.);
  vec3 t1=normalize(cross(p,up)),t2=cross(p,t1);
  float e=.01;
  vec3 s0=surf(p),s1=surf(p+t1*e),s2=surf(p+t2*e);
  vec3 n=normalize(cross(s1-s0,s2-s0));
  if(dot(n,p)<0.)n=-n;
  vObj=p;
  vec4 wp=modelMatrix*vec4(s0,1.);
  vW=wp.xyz;
  vN=normalize(mat3(modelMatrix)*n);
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

// the extruded brand mark: same material, object-space coordinates instead of a unit sphere
const MARK_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vW; varying vec3 vN;
void main(){
  vObj=position*1.0;
  vec4 wp=modelMatrix*vec4(position,1.);
  vW=wp.xyz;
  vN=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const ROCK_FRAG = /* glsl */ `
precision highp float;
uniform float uTime,uHeat,uBump,uWobble; uniform vec3 uLight,uEmber;
varying vec3 vObj; varying vec3 vW; varying vec3 vN;
${NOISE}
void main(){
  float d=crackField(vObj);
  float width=.026+.03*uHeat;
  float crack=1.-smoothstep(0.,width,d);
  float h=smoothstep(0.,.6,d)*1.1+snoise(vObj*11.)*.012;
  vec3 dpx=dFdx(vW),dpy=dFdy(vW);
  vec3 N=normalize(vN);
  N=normalize(N+uWobble*vec3(snoise(vObj*2.6),snoise(vObj*2.6+5.),snoise(vObj*2.6+9.)));
  vec3 V=normalize(cameraPosition-vW);
  // derivative bump
  vec3 r1=cross(dpy,N),r2=cross(N,dpx);float det=dot(dpx,r1);
  float dhx=dFdx(h),dhy=dFdy(h);
  vec3 grad=sign(det)*(dhx*r1+dhy*r2);
  N=normalize(abs(det)*N-uBump*grad);
  vec3 R=reflect(-V,N);
  float ndv=clamp(dot(N,V),0.,1.);
  float F=.05+.95*pow(1.-ndv,5.);
  // procedural studio: key follows cursor, ember strip from below, dim fill
  vec3 L=normalize(uLight);
  vec3 env=mix(vec3(.006),vec3(.035,.033,.032),R.y*.5+.5);
  env+=vec3(1.,.97,.93)*pow(max(dot(R,L),0.),70.)*3.0;
  env+=vec3(.55,.58,.62)*pow(max(dot(R,L),0.),9.)*.22;
  vec3 Le=normalize(vec3(-.55,-.6,.55));
  env+=uEmber*pow(max(dot(R,Le),0.),7.)*1.15;
  env+=uEmber*pow(1.-ndv,3.)*.30*smoothstep(-.2,.7,-R.y+.2);
  vec3 col=vec3(.010)*(max(dot(N,L),0.)*2.+.2);
  float gloss=.55+.45*smoothstep(.1,.5,d);   // plates polish, edges rougher
  col+=env*(.07+.93*F)*gloss*1.9;
  // molten fissures
  float flow=.55+.45*snoise(vObj*5.+vec3(0.,uTime*.35,0.));
  float t=clamp(crack*flow*1.25,0.,1.);
  vec3 magma=mix(vec3(.22,.025,.01),uEmber*1.1,t);
  magma+=vec3(1.,.72,.45)*pow(crack,4.)*.5*flow;
  col=mix(col,col*.35,crack);
  col+=magma*crack*uHeat;
  col+=uEmber*exp(-d*20.)*.13*uHeat*(.6+.4*flow);   // warm bounce on the plate edges
  col=col/(1.+col*.28);
  gl_FragColor=vec4(col,1.);
}`;

const DUST_VERT = /* glsl */ `
uniform float uTime, uPx, uAmt;
attribute vec4 aSeed; varying float vA;
void main(){
  vec3 p=position;
  float cyc=fract(aSeed.w+uTime*(.018+aSeed.z*.03));
  p.y=mix(-4.8,4.8,cyc);
  p.x+=sin(uTime*.3+aSeed.x*30.)*.5;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=(1.3+aSeed.y*2.4)*uPx*(6.2/-mv.z);
  float tw=.55+.45*sin(uTime*(1.5+aSeed.x*2.)+aSeed.y*20.);
  vA=smoothstep(0.,.1,cyc)*smoothstep(1.,.55,cyc)*tw*uAmt;
}`;
const DUST_FRAG = /* glsl */ `
precision mediump float; uniform vec3 uEmber; varying float vA;
void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d)*vA;gl_FragColor=vec4(uEmber*a,a);}`;

// Where the form sits on screen as you scroll. sx/sy are -1..1 screen fractions, size is
// the diameter as a fraction of viewport height. One table for wide screens, one for portrait.
const KEYS_WIDE = {
  hero:     { sx: .42,  sy: .06,  size: .66, heat: 1.0,  bump: 1.0, msize: 0,   msx: .56, msy: -.02, mheat: 1 },
  work:     { sx: .86,  sy: .20,  size: .34, heat: .45,  bump: 1.0, msize: 0,   msx: .56, msy: -.02, mheat: 1 },
  about:    { sx: -.78, sy: -.05, size: .40, heat: .6,   bump: 1.0, msize: 0,   msx: .56, msy: -.02, mheat: 1 },
  services: { sx: .86,  sy: -.15, size: .36, heat: .5,   bump: 1.0, msize: 0,   msx: .56, msy: -.02, mheat: 1 },
  process:  { sx: -.82, sy: .10,  size: .34, heat: .7,   bump: 1.0, msize: 0,   msx: .56, msy: -.02, mheat: 1 },
  contact:  { sx: .95,  sy: .55,  size: .001,heat: 1.0,  bump: 1.0, msize: .58, msx: .56, msy: -.02, mheat: 1.1 },
};
const KEYS_TALL = {
  hero:     { sx: 0,    sy: .52,  size: .34, heat: 1.0,  bump: 1.0, msize: 0,   msx: 0, msy: .66, mheat: 1 },
  work:     { sx: .9,   sy: .55,  size: .22, heat: .4,   bump: 1.0, msize: 0,   msx: 0, msy: .66, mheat: 1 },
  about:    { sx: .9,   sy: .55,  size: .22, heat: .5,   bump: 1.0, msize: 0,   msx: 0, msy: .66, mheat: 1 },
  services: { sx: .9,   sy: .55,  size: .22, heat: .5,   bump: 1.0, msize: 0,   msx: 0, msy: .66, mheat: 1 },
  process:  { sx: .9,   sy: .55,  size: .22, heat: .6,   bump: 1.0, msize: 0,   msx: 0, msy: .66, mheat: 1 },
  contact:  { sx: .9,   sy: .55,  size: .001,heat: 1.0,  bump: 1.0, msize: .30, msx: .30, msy: .32, mheat: .7 },
};
const ORDER = ['hero', 'work', 'about', 'services', 'process', 'contact'];
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (t) => t * t * (3 - 2 * t);
const ease = (t) => 1 - Math.pow(1 - t, 4);

export function initScene(canvas, opts = {}) {
  const reduced = !!opts.reduced;
  const mobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  const MAXDPR = mobile ? 1.5 : 1.75;
  let dpr = Math.min(window.devicePixelRatio || 1, MAXDPR);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const FOV = 32, DIST = 6.2;
  const camera = new PerspectiveCamera(FOV, 1, .1, 40);
  camera.position.set(0, 0, DIST);
  const halfH = DIST * Math.tan((FOV * Math.PI) / 360);
  const ember = new Color('#ee6a3c');

  const group = new Group();
  scene.add(group);
  const geo = new SphereGeometry(1, mobile ? 120 : 220, mobile ? 90 : 160);
  const uni = {
    uTime: { value: 0 }, uHeat: { value: 0 }, uBump: { value: .5 },
    uLight: { value: new Vector3(-.5, .7, .8) }, uEmber: { value: ember }, uWobble: { value: 0 },
  };
  const rock = new Mesh(geo, new ShaderMaterial({ vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG, uniforms: uni }));
  rock.frustumCulled = false;
  group.add(rock);

  // brand mark: the logo polygon extruded and bevelled, in the same obsidian + magma material
  const MARK_PTS = [[512,48],[608,288],[608,416],[864,416],[864,560],[608,560],[608,720],[512,975],[416,720],[416,560],[160,560],[160,416],[416,416],[416,288]];
  const shp = new Shape();
  MARK_PTS.forEach(([x, y], i) => { const px_ = (x - 512) / 463.5, py_ = -(y - 511.5) / 463.5; i ? shp.lineTo(px_, py_) : shp.moveTo(px_, py_); });
  shp.closePath();
  const mgeo = new ExtrudeGeometry(shp, { depth: .34, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 3, curveSegments: 1 });
  mgeo.translate(0, 0, -.17);
  const muni = {
    uTime: uni.uTime, uHeat: { value: 0 }, uBump: { value: .22 }, uWobble: { value: .09 },
    uLight: uni.uLight, uEmber: uni.uEmber,
  };
  const markMesh = new Mesh(mgeo, new ShaderMaterial({ vertexShader: MARK_VERT, fragmentShader: ROCK_FRAG, uniforms: muni }));
  markMesh.frustumCulled = false;
  const markGroup = new Group();
  markGroup.add(markMesh);
  markGroup.visible = false;
  scene.add(markGroup);

  // ember dust
  const N = mobile ? 140 : 320;
  const dg = new BufferGeometry();
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - .5) * 9; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (Math.random() - .5) * 4 - .3;
    seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random();
  }
  dg.setAttribute('position', new BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new BufferAttribute(seed, 4));
  const duni = { uTime: uni.uTime, uPx: { value: dpr }, uAmt: { value: 1 }, uEmber: { value: ember } };
  const dust = new Points(dg, new ShaderMaterial({ vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: duni, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  dust.frustumCulled = false;
  scene.add(dust);

  // scroll mapping
  let anchors = [];
  const measure = () => {
    anchors = ORDER.map((id) => {
      const el = document.getElementById(id); if (!el) return null;
      const r = el.getBoundingClientRect();
      return { id, c: r.top + scrollY + r.height / 2 };
    }).filter(Boolean);
  };
  let KEYS = KEYS_WIDE;
  const cur = { ...KEYS.hero }; const tgt = { ...KEYS.hero };
  let scrollY_ = 0;
  const readScroll = () => {
    scrollY_ = window.scrollY;
    const probe = scrollY_ + innerHeight * .5;
    const maxProbe = document.documentElement.scrollHeight - innerHeight * .5;
    const cs = anchors.map((x, i) => i === anchors.length - 1 ? Math.min(x.c, maxProbe - 8) : x.c);  // last key must be reachable at page bottom
    let a = anchors[0], b = anchors[0], t = 0, ai = 0;
    for (let i = 0; i < anchors.length; i++) if (probe >= cs[i]) { ai = i; a = anchors[i]; b = anchors[Math.min(i + 1, anchors.length - 1)]; }
    if (probe < cs[0]) a = b = anchors[0];
    else if (a !== b) t = ss(Math.min(1, Math.max(0, (probe - cs[ai]) / (cs[ai + 1] - cs[ai]))));
    const ka = KEYS[a.id], kb = KEYS[b.id];
    for (const k in ka) tgt[k] = lerp(ka[k], kb[k], t);
  };

  let mx = 0, my = 0, px = 0, py = 0, lastMove = 0;
  if (!mobile) addEventListener('pointermove', (e) => { px = e.clientX / innerWidth * 2 - 1; py = -(e.clientY / innerHeight * 2 - 1); lastMove = performance.now(); }, { passive: true });
  // phones: a slow idle sweep stands in for the cursor so the light still plays across the surface
  let introStart = -1;
  const startIntro = () => { introStart = performance.now(); };
  if (reduced) introStart = 0;

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    KEYS = w / h < .85 ? KEYS_TALL : KEYS_WIDE;
    measure(); readScroll();
    if (reduced) { Object.assign(cur, tgt); frame(performance.now(), true); }
  };

  let t0 = performance.now(), last = t0, running = false, raf = 0, slow = 0, frames = 0, travelRot = 0;
  function frame(now, still) {
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    const time = reduced ? 6 : (now - t0) / 1000;
    uni.uTime.value = time;
    readScroll();
    const k = reduced ? 1 : 1 - Math.pow(.002, dt);
    for (const key in tgt) cur[key] = lerp(cur[key], tgt[key], k);

    const introT = introStart < 0 ? 0 : Math.min(1, (now - introStart) / (reduced ? 1 : 2800));
    const intro = reduced ? 1 : ease(introT);
    // pointer (desktop) or idle sweep (touch)
    let tx = px, ty = py;
    if (mobile || now - lastMove > 4000) { tx = Math.sin(time * .35) * .6; ty = Math.cos(time * .27) * .35; }
    mx = lerp(mx, tx, 1 - Math.pow(.02, dt)); my = lerp(my, ty, 1 - Math.pow(.02, dt));
    uni.uLight.value.set(mx * 1.6 - .1, my * 1.1 + .55, 1.0);

    const aspect = camera.aspect;
    const halfW = halfH * aspect;
    const radius = cur.size * halfH;                      // size is a diameter fraction of height => radius = size*halfH
    const s = radius * (.82 + .18 * intro);
    group.scale.setScalar(Math.max(.0001, s) * intro + .0001);
    group.position.set(cur.sx * halfW + mx * .06, cur.sy * halfH + my * .04, 0);
    travelRot += dt * .06;
    group.rotation.y = travelRot + scrollY_ * .0011 + mx * .35;
    group.rotation.x = .25 + scrollY_ * .0004 - my * .2;
    group.rotation.z = -.12;
    const mRad = Math.max(0, cur.msize) * halfH * .5;     // mark height = msize * viewport height
    markGroup.visible = mRad > .002;
    if (markGroup.visible) {
      markGroup.scale.setScalar(mRad * 2);
      markGroup.position.set(cur.msx * halfW + mx * .05, cur.msy * halfH + my * .03, 0);
      markGroup.rotation.set(Math.max(-.1, Math.min(.1, -my * .1)) + .03, Math.max(-.22, Math.min(.22, Math.sin(time * .35) * .13 + mx * .16)), 0);
      muni.uHeat.value = cur.mheat * intro;
    }
    uni.uHeat.value = cur.heat * intro;
    uni.uBump.value = .22 * cur.bump;
    duni.uAmt.value = (.5 + cur.heat * .5) * intro;
    renderer.render(scene, camera);

    if (!still && !reduced && introStart >= 0 && ++frames > 40) {
      slow = dt > .028 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 40 && dpr > .8) { dpr = Math.max(.75, dpr - .25); renderer.setPixelRatio(dpr); duni.uPx.value = dpr; slow = 0; resize(); }
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
  new ResizeObserver(measure).observe(document.body);

  resize();
  Object.assign(cur, tgt);
  frame(performance.now(), true);
  start();
  return { stop, start, startIntro, renderer, mobile };
}
