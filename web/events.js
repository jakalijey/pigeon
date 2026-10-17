import { perched, flying, tone } from './pigeon.js?v=2';

const CSS = `.ev{position:fixed;inset:0;z-index:9;display:grid;place-items:center;background:color-mix(in srgb,var(--sky1) 70%,transparent);backdrop-filter:blur(3px);transition:opacity .3s}
.ev.out{opacity:0}
.ev .stage{position:relative;width:390px;height:600px;border-radius:30px;overflow:hidden;background:linear-gradient(180deg,var(--sky1),var(--sky2) 70%);box-shadow:0 30px 60px -30px rgba(0,0,0,.5);flex:none}
.ev .o{position:absolute;left:0;top:0;transform-origin:50% 50%;will-change:transform}
.ev .title{position:absolute;left:0;right:0;bottom:30px;text-align:center;font:800 22px var(--font);opacity:0;padding:0 16px}
.ev .title small{display:block;font:600 14px var(--font);color:var(--muted);margin-top:2px}
.ev .letter{width:200px;height:132px;border-radius:6px;background:var(--paper);box-shadow:0 14px 28px -16px rgba(31,35,72,.6);background-image:repeating-linear-gradient(180deg,transparent 0 25px,var(--line) 25px 26px);padding:14px 16px;overflow:hidden}
.ev .letter b{display:block;font:800 36px/1 var(--font);white-space:nowrap}.ev .letter b span{font-size:15px;color:var(--muted)}.ev .letter i{font:17px var(--hand);font-style:normal;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ev .seal{width:44px;height:44px;border-radius:50%;background:var(--seal);box-shadow:inset 0 -4px 0 rgba(0,0,0,.18),0 4px 8px rgba(0,0,0,.25)}
.ev .seal::after{content:"";position:absolute;inset:13px;border-radius:50%;border:2px solid rgba(255,255,255,.55)}
.ev .g{width:130px;height:130px}
.ev .trail{position:absolute;inset:0;width:100%;height:100%}
.ev .sill{width:300px;height:16px;border-radius:6px;background:var(--paper)}
.ev .st{width:96px;height:118px;padding:9px;background:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:700 12px var(--font);text-align:center;word-break:break-all;
 -webkit-mask:linear-gradient(#000 0 0) content-box,radial-gradient(circle 3.4px,transparent 3.1px,#000 3.6px) -5px -5px/10px 10px round;mask:linear-gradient(#000 0 0) content-box,radial-gradient(circle 3.4px,transparent 3.1px,#000 3.6px) -5px -5px/10px 10px round}
.ev .st .idn,.ev .st .blank{width:50px;height:50px}.ev .st .blank{border-radius:50%;background:var(--paper2);display:grid;place-items:center;font:800 18px var(--font);color:var(--muted)}
.ev .pm{width:120px;height:120px}
.ev .ring{width:220px;height:120px;background:none;padding:0}
.ev .tag{width:150px;padding:12px;border-radius:4px 14px 14px 14px;background:var(--paper);box-shadow:0 10px 22px -14px rgba(31,35,72,.7)}
.ev .tag b{display:block;font:800 28px/1 var(--font);white-space:nowrap}.ev .tag i{font:15px var(--hand);font-style:normal;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;

const clamp = (x) => Math.max(0, Math.min(1, x)), span = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), out3 = (x) => 1 - Math.pow(1 - x, 3);
const back = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const bounce = (x) => { const a = 7.5625, d = 2.75; if (x < 1 / d) return a * x * x; if (x < 2 / d) return a * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return a * (x -= 2.25 / d) * x + 0.9375; return a * (x -= 2.625 / d) * x + 0.984375; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const night = () => matchMedia('(prefers-color-scheme: dark)').matches;
const green = () => (night() ? '#3FD3BB' : '#14907E');
let seq = 0;
const stampSvg = (word, color) => { const id = 'evp' + seq++; return `<svg viewBox="0 0 130 130"><defs><path id="${id}" d="M65 65 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0"/></defs>
<g fill="none" stroke="${color}" stroke-width="3.5"><circle cx="65" cy="65" r="58"/><circle cx="65" cy="65" r="36"/></g>
<text font-family="Segoe UI,system-ui" font-weight="800" font-size="12" letter-spacing="3" fill="${color}"><textPath href="#${id}">NIMIQ POST · NIMIQ POST · NIMIQ ·</textPath></text>
<text x="65" y="71" text-anchor="middle" font-family="Segoe UI,system-ui" font-weight="900" font-size="17" fill="${color}">${esc(word)}</text></svg>`; };

function put(e, x, y, { s = 1, sx = 1, sy = 1, r = 0, o = 1 } = {}) { e.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s * sx},${s * sy})`; e.style.opacity = o; }

const SCENES = {
  sent(make, title, d) {
    const letter = make('letter', `<b>${esc(d.amount)} <span>NIM</span></b><i>${esc(d.note || '')}</i>`, 95, 210);
    const flap = make('', `<svg width="200" height="80" viewBox="0 0 200 80"><path d="M0 0h200L100 74z" fill="${night() ? '#3A3F75' : '#F4EADA'}" stroke="${night() ? '#4A4F8A' : '#E6D9C3'}" stroke-width="2"/></svg>`, 95, 210);
    flap.style.transformOrigin = '50% 0';
    const seal = make('seal', '', 173, 252);
    const bird = make('g', flying(tone()), 130, 200);
    const trail = make('trail', '<svg viewBox="0 0 390 600"><path d="M195 280 C 250 230, 280 160, 360 70" fill="none" stroke="var(--muted)" stroke-width="2.4" stroke-dasharray="2 9" stroke-linecap="round"/></svg>', 0, 0);
    const path = trail.querySelector('path'), L = path.getTotalLength();
    return (t) => {
      put(letter, 95, 210, { o: 1 - span(t, 1150, 1300) });
      const k = ease(span(t, 250, 650));
      put(flap, 95, 210, { sy: -1 + 2 * k, o: (t > 200 ? 1 : 0) * (1 - span(t, 1150, 1300)) });
      const m = span(t, 700, 1000);
      put(seal, 173, 252, { s: m ? 1.8 - 0.8 * back(m) : 0, r: -20 + 20 * m, o: m ? 1 - span(t, 1150, 1300) : 0 });
      const u = span(t, 1150, 2300), e = out3(u), p = path.getPointAtLength(L * e);
      put(bird, p.x - 65, p.y - 65, { s: (u ? 0.7 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.4)) : 0) * (1 - 0.45 * e), r: -12 * e, o: u ? 1 - span(t, 2150, 2400) : 0 });
      trail.style.opacity = u ? 1 - span(t, 2200, 2600) : 0;
      trail.style.clipPath = `inset(${(100 - 100 * e).toFixed(1)}% 0 0 0)`;
      put(title, 0, (1 - ease(span(t, 1700, 2100))) * 12, { o: ease(span(t, 1700, 2100)) });
    };
  },
  received(make, title, d) {
    make('sill', '', 45, 360);
    const fly = make('g', flying(tone()), 0, 0), sit = make('g', perched(tone()), 0, 0);
    const letter = make('letter', `<b class="n">+0 <span>NIM</span></b><i>${esc(d.note || '')}</i>`, 95, 380);
    const num = letter.querySelector('.n');
    return (t) => {
      const e = out3(span(t, 0, 1000));
      put(fly, -140 + 290 * e, 120 + 110 * e - Math.sin(Math.PI * e) * 40, { r: 8 - 8 * e, o: t < 1000 ? 1 : 0 });
      put(sit, 150, 232 - (1 - bounce(span(t, 1000, 1300))) * 10, { o: t >= 1000 ? 1 : 0 });
      const dr = span(t, 1150, 1650);
      put(letter, 95, 300 + 80 * bounce(dr), { r: -6 + 6 * dr, o: dr ? 1 : 0 });
      const c = ease(span(t, 1600, 2300));
      num.innerHTML = `+${esc(d.format(d.value * c))} <span>NIM</span>`;
      num.style.color = c ? green() : '';
      put(title, 0, (1 - ease(span(t, 1900, 2300))) * 12, { o: ease(span(t, 1900, 2300)) });
    };
  },
  paid(make, title, d) {
    const bird = make('g', perched(tone()), 30, 170);
    const tag = make('tag', `<b>${esc(d.amount)} <span style="font-size:14px;color:var(--muted)">NIM</span></b><i>${esc(d.note || '')}</i>`, 190, 210);
    const pm = make('pm', stampSvg(d.word, green()), 205, 195);
    const string = make('trail', '<svg viewBox="0 0 390 600"><path d="M120 270 L192 250" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 4"/></svg>', 0, 0);
    return (t) => {
      const u = span(t, 0, 800), e = out3(u);
      put(bird, -160 + 190 * e, 170 - Math.sin(Math.PI * e) * 30);
      string.style.opacity = u >= 1 ? 1 : 0;
      const dp = span(t, 1000, 1350);
      put(pm, 205, 195, { s: dp ? 2 - back(dp) : 0, r: -40 + 26 * dp, o: dp ? 0.95 : 0 });
      const shake = t > 1000 && t < 1400 ? Math.sin((t - 1000) / 25) * 3 * (1 - span(t, 1000, 1400)) : 0;
      if (u >= 1) put(tag, 190 + shake, 210, { r: -2 }); else put(tag, -10 + 200 * e, 210, { r: 4 - 6 * e });
      put(title, 0, (1 - ease(span(t, 1500, 1900))) * 12, { o: ease(span(t, 1500, 1900)) });
    };
  },
  split(make, title, d) {
    const parts = d.parts.slice(0, 3);
    const letter = make('letter', `<b>${esc(d.amount)} <span>NIM</span></b><i>${esc(d.note || '')}</i>`, 95, 150);
    const stamps = parts.map((p) => make('st', `${p.icon || `<span class="blank">${esc(p.label.slice(0, 1).toUpperCase())}</span>`}<span>${esc(p.label)}</span><span style="color:var(--muted)">${esc(p.amount)} NIM</span>`, 147, 300));
    const off = (i) => (i - (parts.length - 1) / 2) * 118;
    const marks = parts.map((p) => (p.paid ? make('pm', stampSvg(d.word, green()), 0, 0) : null));
    return (t) => {
      put(letter, 95, 150, { o: 1 - span(t, 500, 800), sx: 1 + 0.08 * span(t, 300, 600) });
      const a = ease(span(t, 450, 1100));
      stamps.forEach((s, i) => put(s, 147 + off(i) * a, 300 - 40 * (1 - a), { r: off(i) / 15 * (1 - a), o: span(t, 400, 600) }));
      let k = 0;
      marks.forEach((m, i) => { if (!m) return; const u = span(t, 1300 + k * 450, 1650 + k * 450); k++; put(m, 147 + off(i) - 12, 290, { s: u ? (2 - back(u)) * 0.62 : 0, r: -30 + 16 * u, o: u ? 0.9 : 0 }); });
      put(title, 0, (1 - ease(span(t, 2100, 2500))) * 12, { o: ease(span(t, 2100, 2500)) });
    };
  },
  ring(make, title, d) {
    const text = (d.name + '.nim').toLocaleUpperCase(d.lang === 'tr' ? 'tr-TR' : 'en-US');
    const ring = make('ring', `<svg viewBox="0 0 220 120"><defs><linearGradient id="evRing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE38A"/><stop offset=".5" stop-color="#E9B213"/><stop offset="1" stop-color="#A87400"/></linearGradient></defs>
<ellipse cx="110" cy="60" rx="104" ry="54" fill="url(#evRing)"/><ellipse cx="110" cy="60" rx="70" ry="30" fill="${night() ? '#1B1F4A' : '#DCEBF6'}"/>
<text x="110" y="22" text-anchor="middle" font-family="Segoe UI,system-ui" font-weight="900" font-size="${text.length > 14 ? 11 : 15}" letter-spacing="3" fill="#5C4300"></text></svg>`, 85, 170);
    const engraved = ring.querySelector('text');
    const bird = make('g', perched(tone()), 130, 330);
    return (t) => {
      const u = span(t, 0, 700);
      put(ring, 85, 170 - (1 - out3(u)) * 200, { sx: Math.cos((1 - u) * Math.PI * 3), o: u ? 1 : 0 });
      engraved.textContent = text.slice(0, Math.floor(text.length * span(t, 750, 1500)));
      const k = ease(span(t, 1650, 2250));
      if (k) put(ring, 85 - 9 * k, 170 + 206 * k, { s: 1 - 0.945 * k });
      put(bird, 130, 330, { o: span(t, 1400, 1650) });
      put(title, 0, (1 - ease(span(t, 2100, 2500))) * 12, { o: ease(span(t, 2100, 2500)) });
    };
  },
};

const END = 2700;
let busy = Promise.resolve();

export function playEvent(kind, d) {
  busy = busy.then(() => new Promise((resolve) => {
    if (!document.getElementById('evcss')) { const st = document.createElement('style'); st.id = 'evcss'; st.textContent = CSS; document.head.append(st); }
    const root = document.createElement('div'); root.className = 'ev';
    root.innerHTML = '<div class="stage"></div>';
    const stage = root.firstChild;
    const fit = () => { stage.style.transform = `scale(${Math.min(1, (innerWidth - 24) / 390, (innerHeight - 24) / 600)})`; };
    fit();
    document.body.append(root);
    const make = (cls, html, x, y) => { const e = document.createElement('div'); e.className = 'o ' + cls; e.innerHTML = html; e.style.transform = `translate(${x}px,${y}px)`; stage.append(e); return e; };
    const title = make('title', `${esc(d.title)}<small>${esc(d.sub || '')}</small>`, 0, 0);
    title.className = 'title';
    const draw = SCENES[kind](make, title, d);
    if (d.paint) d.paint(stage);
    let done = false, skip = false;
    const close = () => { if (done) return; done = true; root.classList.add('out'); setTimeout(() => { root.remove(); resolve(); }, 300); };
    root.addEventListener('click', () => { skip = true; draw(END); close(); });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(END); setTimeout(close, 1400); return; }
    const start = performance.now();
    const step = (now) => { if (skip) return; const t = now - start; draw(Math.min(t, END)); if (t < END) requestAnimationFrame(step); else setTimeout(close, 900); };
    draw(0); requestAnimationFrame(step);
  }));
  return busy;
}
