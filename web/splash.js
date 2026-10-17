const NS = 'http://www.w3.org/2000/svg';
const C = [50, 50], R = 42, V = [];
for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; V.push([50 + R * Math.cos(a), 50 + R * Math.sin(a) * 0.92]); }
const HEX = [];
for (let i = 0; i < 6; i++) {
  const a = V[i], b = V[(i + 1) % 6], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  HEX.push([C, a, m], [C, m, b]);
}
const K = { amber: ['#F59E0B', '#D97706', '#B45309'], teal: ['#14B8A6', '#0D9488', '#0F766E', '#115E59'], green: ['#22C55E', '#16A34A'], violet: ['#8B5CF6', '#7C3AED', '#6D28D9'] };
const BIRD = [
  [[22, 58], [56, 40], [44, 64], K.teal[0]],
  [[56, 40], [80, 50], [62, 72], K.teal[1]],
  [[44, 64], [56, 40], [62, 72], K.teal[2]],
  [[22, 58], [44, 64], [30, 72], K.teal[3]],
  [[30, 72], [44, 64], [62, 72], K.teal[2]],
  [[36, 56], [54, 14], [66, 48], K.violet[0]],
  [[36, 56], [66, 48], [58, 62], K.violet[2]],
  [[4, 50], [22, 58], [10, 67], K.green[0]],
  [[10, 67], [22, 58], [30, 72], K.green[1]],
  [[68, 25], [85, 30], [70, 49], K.amber[0]],
  [[85, 30], [82, 51], [70, 49], K.amber[1]],
  [[85, 32], [97, 37.5], [85, 41], K.amber[2]],
];
const angle = (t) => Math.atan2((t[0][1] + t[1][1] + t[2][1]) / 3 - 50, (t[0][0] + t[1][0] + t[2][0]) / 3 - 50);
const hs = HEX.map((t) => ({ t, a: angle(t) })).sort((p, q) => p.a - q.a);
const bs = BIRD.map((t) => ({ t, a: angle(t) })).sort((p, q) => p.a - q.a);
function match(a, b) {
  let best = null, bestD = 1e9;
  for (const p of [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]]) {
    const d = p.reduce((s, j, i) => s + Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1]), 0);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best.map((j) => b[j]);
}
const PIECES = hs.map((h, i) => ({ a: h.t, b: match(h.t, bs[i].t), color: bs[i].t[3] }));

const T = { show: [0, 600], crease: [500, 1000], fold: [1000, 2700], leg: [2500, 2900], eye: [2800, 3000], ring: [2950, 3550], text: [3350, 3950], END: 4000 };
const clamp = (x) => Math.max(0, Math.min(1, x));
const span = (t, [a, b]) => clamp((t - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const bounce = (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
function mix(h1, h2, t) { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const r = (k) => Math.round(((a >> k) & 255) + (((b >> k) & 255) - ((a >> k) & 255)) * t); return `rgb(${r(16)},${r(8)},${r(0)})`; }

export function playSplash({ title, tagline, ready }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const night = matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.createElement('div');
  root.className = 'splash' + (night ? ' night' : '');
  root.innerHTML = `<div class="stage"><svg viewBox="-6 -6 112 112"></svg><div class="words"><b></b><span></span></div></div>`;
  root.querySelector('b').textContent = title;
  root.querySelector('span').textContent = tagline;
  document.body.append(root);
  const s = root.querySelector('svg');
  const el = (name, at) => { const e = document.createElementNS(NS, name); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const defs = el('defs', {});
  defs.innerHTML = `<linearGradient id="spGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE38A"/><stop offset=".5" stop-color="#F6C64A"/><stop offset="1" stop-color="#E9B213"/></linearGradient><filter id="spShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2.2" stdDeviation="1.8" flood-color="#000" flood-opacity=".28"/></filter>`;
  s.append(defs);
  const shadow = el('ellipse', { cx: 50, cy: 96, rx: 26, ry: 3.2, fill: '#000', opacity: 0.14 }); s.append(shadow);
  const group = el('g', { filter: 'url(#spShadow)' }); s.append(group);
  const polys = PIECES.map(() => { const p = el('polygon', { 'stroke-linejoin': 'round', 'stroke-width': 0.7 }); group.append(p); return p; });
  const creases = el('g', { stroke: '#fff', 'stroke-width': 0.5, 'stroke-linecap': 'round', fill: 'none' }); s.append(creases);
  HEX.forEach((t) => creases.append(el('line', { x1: t[0][0], y1: t[0][1], x2: t[1][0], y2: t[1][1], 'stroke-dasharray': '1.4 1.4' })));
  const leg = el('path', { d: 'M44 72l-2.5 15M54 72l2.5 15', stroke: '#B45309', 'stroke-width': 2.6, 'stroke-linecap': 'round', fill: 'none', 'stroke-dasharray': 16, 'stroke-dashoffset': 16 });
  s.insertBefore(leg, group);
  const eye = el('circle', { cx: 77, cy: 35.5, r: 0, fill: '#1F2348' }); s.append(eye);
  const ringBack = el('g', {}), ringFront = el('g', {});
  ringBack.innerHTML = '<path d="M-3.8 0 A3.8 1.6 0 0 1 3.8 0" fill="none" stroke="#B88A05" stroke-width="2"/>';
  ringFront.innerHTML = '<path d="M-3.8 0 A3.8 1.6 0 0 0 3.8 0" fill="none" stroke="url(#spGold)" stroke-width="2.2" stroke-linecap="round"/>';
  s.insertBefore(ringBack, leg); s.append(ringFront);
  const words = root.querySelector('.words');

  function draw(t) {
    group.setAttribute('transform', `translate(50 50) scale(${0.6 + 0.4 * back(span(t, T.show))}) translate(-50 -50)`);
    group.setAttribute('opacity', ease(span(t, T.show)));
    creases.setAttribute('opacity', Math.min(span(t, T.crease), 1 - span(t, [T.fold[0], T.fold[0] + 400])) * 0.9);
    const n = PIECES.length, dur = T.fold[1] - T.fold[0], one = dur * 0.45, gap = (dur - one) / (n - 1);
    PIECES.forEach((p, i) => {
      const u = clamp((t - T.fold[0] - i * gap) / one), e = ease(u);
      const pts = p.a.map((q, j) => [q[0] + (p.b[j][0] - q[0]) * e, q[1] + (p.b[j][1] - q[1]) * e]);
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      const k = Math.cos(Math.PI * u), lift = Math.sin(Math.PI * u) * 7;
      polys[i].setAttribute('points', pts.map(([x, y]) => [cx + (x - cx) * (0.35 + 0.65 * Math.abs(k)), cy + (y - cy) - lift].map((v) => v.toFixed(2)).join(',')).join(' '));
      polys[i].setAttribute('fill', u <= 0 ? 'url(#spGold)' : k < 0 && u < 1 ? mix('#A87400', p.color, u) : mix('#E9B213', p.color, clamp(u * 1.4)));
      polys[i].setAttribute('stroke', u >= 1 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.75)');
    });
    const kE = ease(span(t, T.fold));
    shadow.setAttribute('rx', 26 - 8 * kE); shadow.setAttribute('cy', 96 - 6 * kE);
    leg.setAttribute('stroke-dashoffset', 16 * (1 - ease(span(t, T.leg))));
    eye.setAttribute('r', 2.5 * back(span(t, T.eye)));
    const h = span(t, T.ring), hy = -20 + 99 * bounce(h);
    const tr = `translate(42.9 ${hy.toFixed(2)}) rotate(${(-8 * (1 - h)).toFixed(2)})`;
    ringBack.setAttribute('transform', tr); ringFront.setAttribute('transform', tr);
    ringBack.setAttribute('opacity', h > 0 ? 1 : 0); ringFront.setAttribute('opacity', h > 0 ? 1 : 0);
    const y = ease(span(t, T.text));
    words.style.opacity = y; words.style.transform = `translateY(${(1 - y) * 12}px)`;
  }

  return new Promise((resolve) => {
    let finished = false, skipped = false;
    const close = async () => {
      if (finished) return; finished = true;
      await ready;
      root.classList.add('out');
      setTimeout(() => { root.remove(); resolve(); }, 350);
    };
    root.addEventListener('click', () => { skipped = true; draw(T.END); close(); });
    if (reduce) { draw(T.END); setTimeout(close, 600); return; }
    const start = performance.now();
    const step = (now) => { if (skipped) return; const t = now - start; draw(Math.min(t, T.END)); if (t < T.END) requestAnimationFrame(step); else setTimeout(close, 250); };
    draw(0); requestAnimationFrame(step);
  });
}
