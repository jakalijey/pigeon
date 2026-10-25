// Hive engine: PixiJS (WebGL). Theme "Beeswax Morning" (day, cream light, 3D beeswax, glassy honey, realistic bee).
// Cell, honey, bee and branch images are drawn once with Canvas 2D at high resolution (textures), then the GPU
// stamps them thousands of times. Camera, drag, zoom and click live here; data and panel are in the page.
// API: const m = await kovanMotoru(host, { onTik(h|null), onUzerinde(h|null) })
//      m.veri(hucre, bosYer)  m.sec(h|null)  m.sigdir(ani, panelAcik)  m.ucus(h)  m.R0
import { Application, Container, Sprite, Texture, Graphics, Text } from '/pixi.mjs';

export const R0 = 46;
const KEH = '#D97706', TUR = '#0D9488', YES = '#16A34A', MEN = '#7C3AED';
export const GECE = globalThis.HIVE_TEMA ? !!globalThis.HIVE_TEMA.gece : (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
// Textures are drawn once at start; if the device switches light/dark theme the page is rebuilt so cells and text follow the new theme
if (typeof matchMedia === 'function' && !globalThis.HIVE_TEMA?.secim) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => location.reload());
const T = GECE ? { zem: ['#2A1808', '#070402'], dal: '#3B2414', dalAc: '#5C3A1E', mum: '#7A4818', mumAc: '#A86A28', mumKoyu: '#4A2A0C', kuyu: '#2A1606',
            bal1: '#FFE9B0', bal2: '#F7A93A', bal3: '#B35A04', yazi: '#F5E6CF', yaziKenar: '#140A03', taban: [118, 70, 24], isikGuc: 60 } : { zem: ['#FFF8EC', '#EFDDBF'], dal: '#7A5230', dalAc: '#9B6E45', mum: '#EDBE60', mumAc: '#FCE0A0', mumKoyu: '#C99436', kuyu: '#B9792A',
            bal1: '#FFEFC2', bal2: '#F4AE3F', bal3: '#C46A06', yazi: '#3A2412', yaziKenar: '#FFF8EC', taban: [237, 190, 96], isikGuc: 70 };

// ---- textures (once, with Canvas 2D)
function tuval(w, h, ciz) { const c = document.createElement('canvas'); c.width = w; c.height = h; ciz(c.getContext('2d'), w, h); return Texture.from(c); }
const hex = (x, cx, cy, r) => { x.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2; x.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } x.closePath(); };
const S = 4;                                    // texture resolution: 4x the world unit (sharp up close too)
const PD = 0.55;                                // margin for the shadow (multiple of R)
function petekDoku(tur) {
  const R = R0 * S, w = Math.ceil(R * 2 * (1 + PD)), cx = w / 2, cy = w / 2 - R * 0.12;
  return tuval(w, w, (x) => {
    // soft drop shadow (light from top left, shadow to bottom right)
    x.save(); x.shadowColor = GECE ? 'rgba(0,0,0,.6)' : 'rgba(95,55,12,.38)'; x.shadowBlur = R * 0.42; x.shadowOffsetX = R * 0.1; x.shadowOffsetY = R * 0.24;
    hex(x, cx, cy, R * 0.985); x.fillStyle = T.mum; x.fill(); x.restore();
    // beeswax wall: vertical lighting + light by edge (6 faces)
    const ic = R * 0.78, icx = cx + R * 0.035, icy = cy + R * 0.07;
    const dis = [], icN = [];
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2; dis.push([cx + R * 0.985 * Math.cos(a), cy + R * 0.985 * Math.sin(a)]); icN.push([icx + ic * Math.cos(a), icy + ic * Math.sin(a)]); }
    const isik = [0.55, 0.15, -0.35, -0.55, -0.15, 0.35];
    for (let k = 0; k < 6; k++) {
      const A = dis[k], B = dis[(k + 1) % 6], C = icN[(k + 1) % 6], D = icN[k];
      const L = isik[k], taban = T.taban;
      x.fillStyle = `rgb(${taban.map((v) => Math.round(Math.max(0, Math.min(255, v + L * T.isikGuc))))})`;
      x.beginPath(); x.moveTo(...A); x.lineTo(...B); x.lineTo(...C); x.lineTo(...D); x.closePath(); x.fill();
    }
    // thin bright line on the edge (beeswax polish)
    hex(x, cx, cy, R * 0.97); x.strokeStyle = GECE ? 'rgba(255,190,90,.35)' : 'rgba(255,248,225,.55)'; x.lineWidth = R * 0.03; x.stroke();
    if (tur === 'yer') {                         // future name: shallow, faded well
      hex(x, icx, icy, ic); x.fillStyle = GECE ? 'rgba(20,10,3,.6)' : 'rgba(201,148,54,.35)'; x.fill(); return;
    }
    // well
    hex(x, icx, icy, ic);
    if (tur === 'bal') {
      const g = x.createRadialGradient(icx - ic * 0.3, icy - ic * 0.4, 0, icx, icy, ic * 1.15);
      g.addColorStop(0, T.bal1); g.addColorStop(0.5, T.bal2); g.addColorStop(1, T.bal3); x.fillStyle = g; x.fill();
      // glassy depth: darker at the bottom edge, white glint on top
      x.save(); hex(x, icx, icy, ic); x.clip();
      const g2 = x.createLinearGradient(0, icy - ic, 0, icy + ic); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.7, 'rgba(160,70,0,0)'); g2.addColorStop(1, 'rgba(120,50,0,.35)');
      x.fillStyle = g2; x.fillRect(icx - ic, icy - ic, ic * 2, ic * 2);
      x.globalAlpha = 0.6; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(icx - ic * 0.25, icy - ic * 0.52, ic * 0.5, ic * 0.15, -0.4, 0, 7); x.fill();
      x.globalAlpha = 0.5; x.beginPath(); x.ellipse(icx + ic * 0.45, icy + ic * 0.35, ic * 0.08, ic * 0.04, -0.4, 0, 7); x.fill();
      x.restore();
    } else {
      const g = x.createLinearGradient(icx, icy - ic, icx, icy + ic); if (GECE) { g.addColorStop(0, '#0C0602'); g.addColorStop(0.5, '#1E1006'); g.addColorStop(1, '#3A220C'); } else { g.addColorStop(0, '#4A2A08'); g.addColorStop(0.45, '#7A4E1E'); g.addColorStop(1, '#B58440'); }
      x.fillStyle = g; x.fill();
      // inner wall shadow (top left)
      x.save(); hex(x, icx, icy, ic); x.clip();
      const g3 = x.createLinearGradient(icx - ic * 0.7, icy - ic * 0.8, icx + ic * 0.1, icy + ic * 0.1); g3.addColorStop(0, 'rgba(60,30,5,.6)'); g3.addColorStop(1, 'rgba(60,30,5,0)');
      x.fillStyle = g3; x.fillRect(icx - ic, icy - ic, ic * 2, ic * 2); x.restore();
    }
  });
}
// realistic bee: dark striped body, thin outline, white wings, small shadow below; stands out on a light background
function ariDoku(kanatYukari) {
  const s = 3, w = 46 * s, h = 40 * s;
  return tuval(w, h, (x) => {
    x.translate(w / 2, h / 2 + 4 * s); x.scale(s, s);
    x.fillStyle = 'rgba(90,50,10,.22)'; x.beginPath(); x.ellipse(2, 9, 9, 3, 0, 0, 7); x.fill();           // shadow
    const ka = kanatYukari ? 1 : 0.45;
    x.fillStyle = 'rgba(255,255,255,.85)'; x.strokeStyle = 'rgba(70,55,40,.55)'; x.lineWidth = 0.7;
    x.beginPath(); x.ellipse(-3, -7 * ka - 2, 6, 3.8 * ka + 0.6, -0.45, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.ellipse(3, -7 * ka - 2, 5.5, 3.4 * ka + 0.6, 0.45, 0, 7); x.fill(); x.stroke();
    // body
    const g = x.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#FFC94A'); g.addColorStop(1, '#D98A0B');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 9, 6, 0, 0, 7); x.fill();
    x.save(); x.beginPath(); x.ellipse(0, 0, 9, 6, 0, 0, 7); x.clip();
    x.fillStyle = '#2B1608'; x.fillRect(-4.2, -7, 2.6, 14); x.fillRect(0.6, -7, 2.6, 14); x.fillRect(5.2, -7, 1.8, 14); x.restore();
    x.strokeStyle = '#2B1608'; x.lineWidth = 1; x.beginPath(); x.ellipse(0, 0, 9, 6, 0, 0, 7); x.stroke();
    x.fillStyle = '#2B1608'; x.beginPath(); x.arc(9.5, -0.8, 3.4, 0, 7); x.fill();                        // head
    x.fillStyle = '#fff'; x.beginPath(); x.arc(10.6, -1.8, 0.9, 0, 7); x.fill();                           // eye glint
    x.strokeStyle = '#2B1608'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(11, -3.5); x.quadraticCurveTo(13, -7, 15, -6.5); x.stroke(); // antenna
    x.beginPath(); x.moveTo(-9, 0); x.lineTo(-11.5, 0.6); x.stroke();                                        // sting
  });
}
const golgeDoku = () => tuval(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, GECE ? 'rgba(0,0,0,.55)' : 'rgba(110,65,15,.35)'); g.addColorStop(1, 'rgba(110,65,15,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); });
const zeminDoku = () => tuval(512, 512, (x) => {
  const g = x.createRadialGradient(256, 190, 0, 256, 230, 380); g.addColorStop(0, T.zem[0]); g.addColorStop(1, T.zem[1]); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const g2 = x.createLinearGradient(0, 0, 512, 512); g2.addColorStop(0, GECE ? 'rgba(255,170,60,.10)' : 'rgba(255,255,255,.55)'); g2.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = g2; x.fillRect(0, 0, 512, 512);
});
const isikDoku = () => tuval(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
const yaprakDoku = (renk) => tuval(96, 40, (x) => { x.fillStyle = renk; x.beginPath(); x.moveTo(4, 20); x.quadraticCurveTo(40, 0, 92, 20); x.quadraticCurveTo(40, 40, 4, 20); x.fill(); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; x.beginPath(); x.moveTo(6, 20); x.lineTo(86, 20); x.stroke(); });

export async function kovanMotoru(host, { onTik, onUzerinde } = {}) {
  const app = new Application();
  await app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0, resolution: Math.min(2, devicePixelRatio || 1), autoDensity: true, preference: 'webgl' });
  host.appendChild(app.canvas); app.canvas.style.touchAction = 'none';
  const W = () => app.screen.width, H = () => app.screen.height;

  const DOKU = { bos: petekDoku('bos'), bal: petekDoku('bal'), yer: petekDoku('yer'), ari: [ariDoku(true), ariDoku(false)], golge: golgeDoku(), isik: isikDoku(), yaprak: [yaprakDoku(YES), yaprakDoku(TUR), yaprakDoku(MEN), yaprakDoku(KEH)] };
  const zemin = new Sprite(zeminDoku()); app.stage.addChild(zemin);
  const toz = new Container(); app.stage.addChild(toz);
  const ekranDal = { golge: new Graphics(), dal: new Graphics(), yaprak: new Container(), sap: new Graphics() };
  for (const k of [ekranDal.golge, ekranDal.dal, ekranDal.sap, ekranDal.yaprak]) app.stage.addChild(k);
  const dunya = new Container(); app.stage.addChild(dunya);
  const kat = { golge: new Container(), dogum: new Graphics(), yer: new Container(), petek: new Container(), seçim: new Graphics(), ari: new Container(), yazi: new Container() };
  for (const k of Object.values(kat)) dunya.addChild(k);
  const tozlar = Array.from({ length: 40 }, () => { const s = new Sprite(DOKU.isik); s.anchor.set(0.5); s.alpha = 0.5; toz.addChild(s); return { s, x: Math.random(), y: Math.random(), v: 0.00005 + Math.random() * 0.00015, r: 2 + Math.random() * 5, ph: Math.random() * 6 }; });

  const kam = { x: 0, y: 0, z: 1, hx: 0, hy: 0, hz: 1 };
  let hucre = [], bos = [], secili = null, elle = false, tween = null, dalisOnce = null;
  const idDoku = new Map();
  function identiconDoku(adres, img) { if (!idDoku.has(adres) && img) idDoku.set(adres, Texture.from(img)); return idDoku.get(adres); }

  // ---- branch + stem + shadow (sized to the hive)
  const yapraklar = [];
  // ---- branch: fixed to the SCREEN (zoom does not change it). Each frame the stem reaches from the branch to the hive's first cell.
  const DAL_EN = 30;
  const dalY = () => (W() < 760 ? 194 : 112);
  const dalP = (u) => [u * W(), dalY() + Math.sin(u * 4.6 + 0.4) * 10 - (u - 0.5) * 22];
  function ekranDalCiz() {
    const g = ekranDal.dal, gg = ekranDal.golge; g.clear(); gg.clear(); ekranDal.yaprak.removeChildren(); yapraklar.length = 0;
    const yol = (gr, dx, dy, en, renk, alfa = 1) => { gr.moveTo(...dalP(-0.05).map((v, i) => v + [dx, dy][i])); for (let i = 1; i <= 60; i++) { const [x, y] = dalP(-0.05 + i / 60 * 1.1); gr.lineTo(x + dx, y + dy); } gr.stroke({ width: en, color: renk, alpha: alfa, cap: 'round', join: 'round' }); };
    yol(gg, 8, 20, DAL_EN, GECE ? 0x000000 : 0x6E4A1E, GECE ? 0.35 : 0.14);
    yol(g, 0, 0, DAL_EN, GECE ? 0x24140A : 0x6B4526); yol(g, 0, -4, DAL_EN * 0.64, GECE ? 0x3B2414 : 0x8A5E36); yol(g, 0, -8, DAL_EN * 0.18, GECE ? 0xC27A2A : 0xB98A5A, GECE ? 0.45 : 0.8);
    for (const [u, boy, yon] of [[0.14, 46, -1], [0.72, 58, -1], [0.4, 34, 1], [0.88, 30, 1]]) {
      const [x, y] = dalP(u), ex = x + yon * boy * 0.8, ey = y - boy;
      g.moveTo(x, y).quadraticCurveTo((x + ex) / 2, ey + 20, ex, ey).stroke({ width: 8, color: GECE ? 0x2E1A0C : 0x7A5230, cap: 'round' });
    }
    const n = Math.round(W() / 60);
    for (let i = 0; i < n; i++) {
      const [x, y] = dalP(i / n + Math.random() * 0.012), sp = new Sprite(DOKU.yaprak[i % 4]);
      sp.anchor.set(0.05, 0.5); sp.position.set(x, y + (Math.random() - 0.5) * 8); sp.scale.set(0.34 * (0.8 + Math.random() * 0.5));
      const temel = (i % 2 ? -1 : 1) * (0.5 + Math.random() * 0.9) + (i % 2 ? Math.PI : 0); sp.rotation = temel; ekranDal.yaprak.addChild(sp); yapraklar.push({ s: sp, temel, ph: Math.random() * 6 });
    }
  }
  function sapCiz() {
    const g = ekranDal.sap; g.clear(); if (!hucre.length) return;
    const ilk = hucre.reduce((m, h) => (h.y < m.y || (h.y === m.y && Math.abs(h.x) < Math.abs(m.x)) ? h : m));
    const tx = ilk.x * kam.z + dunya.x, ty = (ilk.y - R0 * 0.85) * kam.z + dunya.y;
    if (ty < dalY() + 4 || tx < -200 || tx > W() + 200) return;            // the top of the hive is above the branch or off screen
    const [bx, by] = dalP(Math.max(0.02, Math.min(0.98, tx / W()))), ust = 9, alt = Math.max(10, R0 * 0.75 * kam.z);
    g.moveTo(bx - ust, by).lineTo(bx + ust, by).lineTo(tx + alt, ty).lineTo(tx - alt, ty).closePath().fill(0xEDBE60);
    g.moveTo(bx - 2, by).lineTo(bx + 3, by).lineTo(tx + alt * 0.27, ty).lineTo(tx - alt * 0.13, ty).closePath().fill({ color: 0xFCE0A0, alpha: 0.8 });
  }
  function dalCiz() {
    kat.golge.removeChildren(); if (!hucre.length) return;
    const xs = hucre.map((h) => h.x), ys = hucre.map((h) => h.y), ust = Math.min(...ys), alt = Math.max(...ys);
    // the hive's soft shadow on the ground
    const gs = new Sprite(DOKU.golge); gs.anchor.set(0.5); gs.position.set((Math.max(...xs) + Math.min(...xs)) / 2 + R0 * 1.4, (ust + alt) / 2 + R0 * 1.6);
    gs.width = (Math.max(...xs) - Math.min(...xs)) + R0 * 5; gs.height = (alt - ust) + R0 * 6; kat.golge.addChild(gs);
  }

  // ---- cells
  const ols = 1 / S;
  function petekSprite(doku, x, y) { const s = new Sprite(doku); s.anchor.set(0.5, 0.5 - 0.12 / (2 * (1 + PD))); s.scale.set(ols); s.position.set(x, y); return s; }
  function kur() {
    kat.petek.removeChildren(); kat.yer.removeChildren(); kat.yazi.removeChildren();
    for (const [x, y] of bos) { const s = petekSprite(DOKU.yer, x, y); s.alpha = 0.32; kat.yer.addChild(s); }
    for (const h of hucre) {
      const c = new Container(); c.position.set(h.x, h.y);
      if (GECE && h.p.site) { const p = new Sprite(DOKU.isik); p.anchor.set(0.5); p.width = p.height = R0 * 5.2; p.tint = 0xFFA640; p.alpha = 0.42; p.blendMode = 'add'; c.addChild(p); h.fener = p; }
      const duvar = petekSprite(h.p.site ? DOKU.bal : DOKU.bos, 0, 0); c.addChild(duvar);
      const id = new Sprite(Texture.EMPTY); id.anchor.set(0.5); id.position.set(R0 * 0.035, R0 * 0.07); c.addChild(id);
      const parla = new Sprite(DOKU.isik); parla.anchor.set(0.5); parla.width = R0 * 0.9; parla.height = R0 * 0.28; parla.rotation = -0.4; parla.position.set(-R0 * 0.2, -R0 * 0.36); parla.alpha = h.p.site ? 0.45 : 0; c.addChild(parla);
      kat.petek.addChild(c);
      const yazi = new Text({ text: h.p.isim + '.nim', style: { fontFamily: 'system-ui, Segoe UI, sans-serif', fontWeight: '700', fontSize: 30, fill: T.yazi, stroke: { color: T.yaziKenar, width: 7 } } });
      yazi.anchor.set(0.5); yazi.taban = Math.min(0.4, (R0 * 1.62) / Math.max(1, yazi.width)); yazi.scale.set(yazi.taban); yazi.position.set(h.x, h.y + R0 * 0.8); kat.yazi.addChild(yazi);
      h.g = { c, duvar, id, parla, yazi, site: !!h.p.site }; h.ari ||= [];
    }
  }
  function veri(yeniHucre, yeniBos, resimler) {
    const eski = new Map(hucre.map((h) => [h.p.isim, h]));
    hucre = yeniHucre.map((h) => { const e = eski.get(h.p.isim); return Object.assign(h, { ari: e?.ari || [], dogus: e?.dogus ?? performance.now() + Math.random() * 400 }); });
    for (const h of eski.values()) if (!hucre.includes(h)) for (const a of h.ari) a.s.destroy();
    bos = yeniBos; kur(); dalCiz(); resimGuncelle(resimler);
    if (secili) secili = hucre.find((h) => h.p.isim === secili.p.isim) || null;
  }
  function resimGuncelle(resimler) {
    for (const h of hucre) { const img = resimler?.get(h.p.adres), d = img && identiconDoku(h.p.adres, img);
      if (d && h.g.id.texture !== d) { h.g.id.texture = d; const s = R0 * 0.86; h.g.id.width = s; h.g.id.height = s; h.g.id.alpha = h.p.site ? 0.93 : 0.88; } }
  }

  // ---- camera
  function sigdir(ani, panel) {
    if (!hucre.length || !W()) return;
    const tel = W() < 760, xs = hucre.map((h) => h.x), ys = hucre.map((h) => h.y);
    const ust = Math.min(...ys) - R0 * 1.2, alt = Math.max(...ys) + R0 * 1.2;
    const genis = Math.max(...xs) - Math.min(...xs) + R0 * (tel ? 2.4 : 5), yuk = alt - ust;
    const ustBos = (tel ? 182 : 112) + 70, alan = { w: W() - (panel && !tel ? 400 : 0), h: H() - ustBos - 40 };
    kam.hz = Math.max(0.06, Math.min(1.8, Math.min(alan.w / genis, alan.h / yuk)));
    kam.hx = (Math.max(...xs) + Math.min(...xs)) / 2 + (panel && !tel ? 200 / kam.hz : 0);
    kam.hy = (ust + alt) / 2 - (ustBos - 40) / 2 / kam.hz;
    if (ani) Object.assign(kam, { x: kam.hx, y: kam.hy, z: kam.hz });
  }
  function ucus(h) { const tel = W() < 760, z = Math.max(kam.hz, 1.5); kam.hz = z; kam.hx = h.x + (tel ? 0 : 190 / z); kam.hy = h.y + (tel ? (H() / 2 - Math.min(250, H() * 0.3)) / z : 0); }   // on phones the cell sits in the gap between the header and the bottom panel
  const dX = (sx) => (sx - W() / 2) / kam.z + kam.x, dY = (sy) => (sy - H() / 2) / kam.z + kam.y;
  function bul(sx, sy) { const wx = dX(sx), wy = dY(sy); let en = null, d = 1e9; for (const h of hucre) { const k = Math.hypot(h.x - wx, h.y - wy); if (k < d) { d = k; en = h; } } return d < R0 * 0.95 ? en : null; }
  function yakinlas(sx, sy, f) { elle = true; const wx = dX(sx), wy = dY(sy), z = Math.max(0.06, Math.min(4, kam.z * f)); kam.z = kam.hz = z; kam.x = kam.hx = wx - (sx - W() / 2) / z; kam.y = kam.hy = wy - (sy - H() / 2) / z; }

  // ---- interaction
  const cv = app.canvas, imlec = new Map(); let surukle = null, tasindi = false, uzerinde = null;
  const yerel = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); const p = yerel(e); imlec.set(e.pointerId, p); tasindi = false; if (imlec.size === 1) surukle = { ...p, kx: kam.hx, ky: kam.hy }; });
  cv.addEventListener('pointermove', (e) => {
    const p = yerel(e);
    if (!imlec.has(e.pointerId)) { const h = bul(p.x, p.y); if (h !== uzerinde) { uzerinde = h; cv.style.cursor = h ? 'pointer' : 'grab'; onUzerinde?.(h); } return; }
    const once = imlec.get(e.pointerId); imlec.set(e.pointerId, p);
    if (imlec.size === 2) { const [a, b] = [...imlec.values()], [o] = [...imlec.entries()].filter(([id]) => id !== e.pointerId).map(([, v]) => v);
      const d = Math.hypot(a.x - b.x, a.y - b.y), od = Math.hypot(once.x - o.x, once.y - o.y) || d; yakinlas((a.x + b.x) / 2, (a.y + b.y) / 2, d / od); tasindi = true; return; }
    if (surukle) { const dx = p.x - surukle.x, dy = p.y - surukle.y; if (Math.hypot(dx, dy) > 4) { tasindi = true; elle = true; cv.style.cursor = 'grabbing'; }
      kam.hx = kam.x = surukle.kx - dx / kam.z; kam.hy = kam.y = surukle.ky - dy / kam.z; }
  });
  const birak = (e) => { const tek = imlec.size === 1, p = yerel(e); imlec.delete(e.pointerId); cv.style.cursor = 'grab'; if (tek && !tasindi) onTik?.(bul(p.x, p.y)); if (!imlec.size) surukle = null; };
  cv.addEventListener('pointerup', birak); cv.addEventListener('pointercancel', birak);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = yerel(e); yakinlas(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  app.renderer.on('resize', () => { zemin.width = W(); zemin.height = H(); ekranDalCiz(); if (!elle) sigdir(true, !!secili); });
  ekranDalCiz();
  zemin.width = W(); zemin.height = H();
  // stop while the tab is hidden (battery)
  document.addEventListener('visibilitychange', () => { document.hidden ? app.ticker.stop() : app.ticker.start(); });

  // ---- bees: loaded by closeness (far 3, middle 12, near 60 per cell; at most 900 on screen)
  function yeniAri(x, y) { const s = new Sprite(DOKU.ari[0]); s.anchor.set(0.5); kat.ari.addChild(s); return { s, x: x + (Math.random() - 0.5) * 160, y: y - 60 - Math.random() * 80, ix: (Math.random() - 0.5) * 0.8, iy: (Math.random() - 0.5) * 0.7, ivx: 0, ivy: 0, a: Math.random() * 6.3, h: 0.7 + Math.random() * 0.6, rx: 1.05 + Math.random() * 0.5, ry: 0.85 + Math.random() * 0.4, ph: Math.random() * 6 }; }

  let zaman = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(3, tk.deltaTime); zaman += dt / 60;
    if (tween) {                                   // dive / exit: timed, exponential zoom (scale moves logarithmically)
      const v = Math.min(1, (performance.now() - tween.bas) / tween.sure), e = v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
      kam.x = kam.hx = tween.a.x + (tween.b.x - tween.a.x) * e; kam.y = kam.hy = tween.a.y + (tween.b.y - tween.a.y) * e; kam.z = kam.hz = tween.a.z * Math.pow(tween.b.z / tween.a.z, e);
      tween.ilerle?.(e); if (v >= 1) { const t = tween; tween = null; t.bitti(); }
    } else for (const k of ['x', 'y', 'z']) kam[k] += (kam['h' + k] - kam[k]) * Math.min(1, 0.12 * dt);
    dunya.scale.set(kam.z); dunya.position.set(W() / 2 - kam.x * kam.z, H() / 2 - kam.y * kam.z);
    const r = R0 * kam.z, simdi = performance.now();
    // dust (floating in the sunlight)
    for (const t of tozlar) { t.y -= t.v * dt; if (t.y < -0.02) { t.y = 1.02; t.x = Math.random(); } t.s.position.set(t.x * W() + Math.sin(zaman + t.ph) * 10, t.y * H()); t.s.width = t.s.height = t.r; t.s.alpha = 0.25 + 0.25 * Math.sin(zaman * 1.5 + t.ph); if (GECE) t.s.tint = 0xFFB050; }
    for (const y of yapraklar) y.s.rotation = y.temel + Math.sin(zaman * 1.2 + y.ph) * 0.06;
    // cells: birth, honey glow, label visibility
    const yaziGor = r > 46;
    for (const h of hucre) {
      const sure = h.dogusSure || 450, dg = Math.min(1, Math.max(0, (simdi - h.dogus) / sure));
      const es = h.dogusSure ? 1 + 2.6 * Math.pow(dg - 1, 3) + 1.6 * Math.pow(dg - 1, 2) : 1 - Math.pow(1 - dg, 3);   // springs back at birth
      h.g.c.alpha = Math.min(1, dg * 3); h.g.c.scale.set(h.dogusSure ? Math.max(0.05, es) : 0.7 + 0.3 * es);
      if (h.p.site) h.g.parla.alpha = 0.32 + 0.16 * Math.sin(zaman * 1.4 + h.x * 0.01);
      if (h.fener) h.fener.alpha = 0.34 + 0.12 * Math.sin(zaman * 1.1 + h.y * 0.013);
      h.g.yazi.visible = yaziGor; h.g.yazi.scale.set(Math.min(h.g.yazi.taban, 0.5 / Math.max(1, kam.z)));
    }
    // ring and beeswax drops of a newborn cell
    kat.dogum.clear();
    for (const h of hucre) if (h.dogusSure) { const v = (simdi - h.dogus) / h.dogusSure; if (v > 0 && v < 1.3) {
      const a = Math.max(0, 1 - v / 1.3); kat.dogum.circle(h.x, h.y, R0 * (1 + 2.4 * Math.min(1, v))).stroke({ width: 4 / Math.max(0.6, kam.z), color: 0xD97706, alpha: a * 0.9 });
      kat.dogum.circle(h.x, h.y, R0 * 2.6).fill({ color: 0xFFD678, alpha: 0.35 * Math.sin(Math.PI * Math.min(1, v)) });
      for (let i = 0; i < 6; i++) { const aa = i / 6 * Math.PI * 2, d = R0 * (1.1 + v * 0.9); kat.dogum.circle(h.x + Math.cos(aa) * d, h.y + Math.sin(aa) * d, 3 + 3 * a).fill({ color: 0xFBDC94, alpha: a }); } } }
    // selection frame
    kat.seçim.clear(); if (secili) { const R = R0 * 1.02, pts = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2; pts.push(secili.x + R * Math.cos(a), secili.y + R * Math.sin(a)); }
      kat.seçim.poly(pts).stroke({ width: 4 / Math.max(0.6, kam.z), color: 0xD97706, alpha: 0.6 + 0.3 * Math.sin(zaman * 3) }); }
    // bees
    const kat2 = r < 60 ? 0 : r < 95 ? 1 : 2, tavan = [3, 12, 60][kat2], ic = 0.45;
    let ekrandaki = 0;
    for (const h of hucre) {
      const sx = h.x * kam.z + dunya.x, sy = h.y * kam.z + dunya.y, gor = sx > -r * 2 && sx < W() + r * 2 && sy > -r * 2 && sy < H() + r * 2;
      const hedef = gor ? Math.min(tavan, (h.p.kullanici || 0) + (h.p.ziyaret?.bugun || 0), Math.max(0, 900 - ekrandaki)) : 0;
      while (h.ari.length > hedef) h.ari.pop().s.destroy();
      for (let k = 0; k < 3 && h.ari.length < hedef; k++) { const yeni = yeniAri(h.x, h.y); if (h.ari.length >= (h.p.kullanici || 0)) yeni.s.alpha = 0.45; h.ari.push(yeni); }   // users solid, today's visitors faded
      ekrandaki += h.ari.length;
      const kalabalik = h.ari.length > 20, olc = (kat2 === 2 ? (kalabalik ? 0.075 : 0.1) : 0.14) * (R0 / 46);
      for (const a of h.ari) {
        let tx, ty;
        if (kat2 === 2) {
          a.ivx += (Math.random() - 0.5) * 0.012 * dt; a.ivy += (Math.random() - 0.5) * 0.012 * dt; a.ivx *= 0.95; a.ivy *= 0.95; a.ix += a.ivx * dt; a.iy += a.ivy * dt;
          const m = Math.hypot(a.ix, a.iy); if (m > ic) { a.ix *= ic / m; a.iy *= ic / m; a.ivx *= -0.6; a.ivy *= -0.6; }
          tx = h.x + a.ix * R0; ty = h.y + R0 * 0.07 + a.iy * R0;
        } else { a.a += 0.022 * a.h * dt; const d = kat2 === 1 ? 0.8 : 1.1; tx = h.x + Math.cos(a.a + a.ph) * R0 * a.rx * d; ty = h.y + Math.sin(a.a * 1.6 + a.ph) * R0 * a.ry * d; }
        const ox = a.x, k = (kat2 === 2 ? 0.2 : 0.08) * dt; a.x += (tx - a.x) * k; a.y += (ty - a.y) * k;
        a.s.position.set(a.x, a.y); a.s.scale.set((a.x < ox ? -1 : 1) * olc, olc);
        a.s.texture = DOKU.ari[Math.sin(zaman * 38 + a.ph) > 0 ? 0 : 1];
      }
    }
  });

  return {
    R0, kam,
    veri, resimGuncelle,
    sec(h) { secili = h; if (h) ucus(h); },
    // the cell's on-screen centre and radius (to open the room layer from this hexagon)
    konum(h) { return { x: h.x * kam.z + dunya.x, y: h.y * kam.z + dunya.y, r: R0 * kam.z }; },
    // dive into a cell: the camera zooms exponentially towards it; ilerle(e) gets 0..1 every frame
    dal(h, sure = 1100, ilerle) { secili = h; dalisOnce ||= { x: kam.x, y: kam.y, z: kam.z }; const z = Math.min(W(), H()) * 0.42 / R0;
      return new Promise((bitti) => { tween = { bas: performance.now(), sure, a: { x: kam.x, y: kam.y, z: kam.z }, b: { x: h.x, y: h.y, z }, ilerle, bitti }; }); },
    // leave the room: the camera glides back to where it was before the dive
    cik(sure = 1000, ilerle) { const hedef = dalisOnce || { x: kam.x, y: kam.y, z: kam.z / 6 }; dalisOnce = null; secili = null;
      return new Promise((bitti) => { tween = { bas: performance.now(), sure, a: { x: kam.x, y: kam.y, z: kam.z }, b: hedef, ilerle, bitti }; }); },
    // new name: a cell is born from beeswax
    dogur(isim, gecikme = 300) { const h = hucre.find((x) => x.p.isim === isim); if (h) { h.dogusSure = 1000; h.dogus = performance.now() + gecikme; } return h; },
    odak(h) { kam.x = kam.hx = h.x; kam.y = kam.hy = h.y; },
    sigdir(ani, panel) { elle = false; sigdir(ani, panel); },
    ucus,
  };
}
