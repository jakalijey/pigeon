// Hive page: data (live registry), panel, sign-in, publishing. Drawing lives in motor.js (PixiJS).
import { kovanMotoru, R0, GECE } from '/motor.js';
import qrcode from '/qrcode.js';
const $ = (id) => document.getElementById(id);

// ---- environment: same origin locally; live, the page runs inside a heylogram.com code-site frame and the API is on signal.heylogram.tv
const YEREL = ['127.0.0.1', 'localhost'].includes(location.hostname);
const API = YEREL ? '' : 'https://signal.heylogram.tv/kovanapi';
const CERCEVE = window.parent !== window;

// ---- language: Nimiq Pay's language (via the bridge) or the browser language; English by default
// language: the one picked by hand (remembered), else Nimiq Pay's or the browser's
const dilSecimi = (() => { try { const s = localStorage.getItem('hive-dil'); return s === 'tr' || s === 'en' ? s : null; } catch { return null; } })();
let dil = dilSecimi || ((navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en');
const L = (tr, en) => (dil === 'tr' ? tr : en);
function sabitMetinler() {
  document.documentElement.lang = dil;
  for (const el of document.querySelectorAll('[data-tr]')) el.textContent = L(el.dataset.tr, el.dataset.en);
  $('ara').placeholder = L('Bir isim ara: garura, mert…', 'Find a name: garura, mert…');
  $('araBul').textContent = L('Bul', 'Find');
  const d = $('dilDug'); if (d) { d.textContent = dil === 'tr' ? 'EN' : 'TR'; d.setAttribute('aria-label', L('Dili İngilizce yap', 'Switch to Turkish')); }
}
function dilDegistir() {
  dil = dil === 'tr' ? 'en' : 'tr'; try { localStorage.setItem('hive-dil', dil); } catch {}
  sabitMetinler(); if (odaAcik) odaCiz(false);
}

// ---- wallet: Nimiq Pay directly (window.nimiq) or, inside a code-site frame, the parent page bridge ('hl-nimiq')
const kopru = (() => {
  let seq = 0, bulundu = null; const bekleyen = new Map();
  addEventListener('message', (e) => {
    const v = e.data; if (e.source !== window.parent || v?.tur !== 'hl-nimiq' || v.islem !== 'sonuc') return;
    const w = bekleyen.get(v.id); if (!w) return; bekleyen.delete(v.id);
    v.ok ? w.ok(v.sonuc) : w.no(new Error(v.hata?.mesaj || 'cüzdan'));
  });
  const cagir = (yontem, args) => new Promise((ok, no) => { const id = ++seq; bekleyen.set(id, { ok, no }); setTimeout(() => { if (bekleyen.delete(id)) no(new Error('zaman aşımı')); }, 180000); window.parent.postMessage({ tur: 'hl-nimiq', islem: 'cagir', id, yontem, args }, '*'); });
  const saglayici = { listAccounts: () => cagir('listAccounts', []), sign: (m) => cagir('sign', [m]),
    sendBasicTransactionWithData: (tx) => cagir('sendBasicTransactionWithData', [tx]) };   // for tips (allowed in the frame allow-list)
  return (sure) => (bulundu ||= new Promise((coz) => {
    const sor = () => window.parent.postMessage({ tur: 'hl-nimiq', islem: 'sor' }, '*');
    const on = (e) => { const v = e.data; if (e.source !== window.parent || v?.tur !== 'hl-nimiq' || v.islem !== 'durum') return;
      removeEventListener('message', on); clearInterval(tekrar); clearTimeout(dur); if (v.dil && !dilSecimi) { dil = String(v.dil).startsWith('tr') ? 'tr' : 'en'; sabitMetinler(); } coz(v.var ? saglayici : null); };
    addEventListener('message', on); const tekrar = setInterval(sor, 500); const dur = setTimeout(() => { removeEventListener('message', on); clearInterval(tekrar); bulundu = null; coz(null); }, sure); sor();
  }));
})();
async function cuzdan(sure = 2500) {
  if (CERCEVE) return kopru(Math.max(sure, 8000));
  const son = Date.now() + sure; while (!window.nimiq && Date.now() < son) await new Promise((ok) => setTimeout(ok, 60));
  if (window.nimiqPay?.language && !dilSecimi) { dil = String(window.nimiqPay.language).startsWith('tr') ? 'tr' : 'en'; sabitMetinler(); }
  return window.nimiq || null;
}

// ---- identicon (Nimiq's own hexagon icon)
let I; const idSvg = new Map(), resimler = new Map();
async function identicon(adres) {
  if (idSvg.has(adres)) return; idSvg.set(adres, '');
  I ||= import('/identicons.js').then((m) => m.default);
  const svg = await (await I).svg(adres); idSvg.set(adres, svg);
  await new Promise((ok) => { const img = new Image(); img.onload = () => { resimler.set(adres, img); ok(); }; img.onerror = ok; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  motor.resimGuncelle(resimler);
}

// ---- layout: lower registration order sits closer to the branch, the hive grows downwards
const dunya = (q, r) => [R0 * Math.sqrt(3) * (q + r / 2), R0 * 1.5 * r];
const ADAY = (() => { const out = []; for (let r = -2; r < 60; r++) for (let q = -60; q < 60; q++) { const [x, y] = dunya(q, r); if (Math.abs(x) < R0 * 60) out.push({ x, y }); } return out; })();
function kovanYer(n) {
  const alan = n * R0 * R0 * 2.6, b = Math.sqrt(alan / (Math.PI * 0.82)), a = b * 0.82, cy = b * 0.92;
  return ADAY.map((c) => ({ ...c, d: Math.hypot(c.x / a, (c.y - cy) / b) + (c.y < 0 ? 1 : 0) })).sort((u, v) => u.d - v.d).slice(0, n)
    .sort((u, v) => u.y - v.y || Math.abs(u.x) - Math.abs(v.x) || u.x - v.x).map((c) => [c.x, c.y]);
}

let petekler = [], hucre = [], secili = null, ornekli = true, canli = false;
const motor = await kovanMotoru($('sahne'), { onTik: (h) => (h ? sec(h) : kapat()) });

async function yukle() {
  const j = await fetch(API + '/api/hive?ornek=' + (ornekli ? 1 : 0) + '&deneme=' + (new URLSearchParams(location.search).get('deneme') || 0)).then((r) => r.json());
  canli = !!j.canli; $('ornekKutu').style.display = canli ? 'none' : '';
  petekler = j.petekler;
  const n = petekler.length, yer = kovanYer(n), sonra = kovanYer(n + Math.max(8, Math.ceil(n * 0.5)));
  const eski = new Map(hucre.map((h) => [h.p.isim, h]));
  hucre = petekler.map((p, i) => { const e = eski.get(p.isim) || {}; e.p = p; [e.x, e.y] = yer[i]; return e; });
  const dolu = new Set(yer.map(([x, y]) => Math.round(x) + ',' + Math.round(y)));
  motor.veri(hucre, sonra.filter(([x, y]) => !dolu.has(Math.round(x) + ',' + Math.round(y))), resimler);
  for (const p of petekler) identicon(p.adres);
  $('sIsim').textContent = canli ? j.gercek : j.gercek + (ornekli ? ' + ' + (petekler.length - j.gercek) : '');
  $('sDolu').textContent = petekler.filter((p) => p.site).length;
  $('sAri').textContent = petekler.reduce((t, p) => t + (p.kullanici || 0), 0);
  if (!yukle.ilk) { yukle.ilk = true; motor.sigdir(true, false); }
  if (secili) { const h = hucre.find((x) => x.p.isim === secili.p.isim); if (h) secili = h; }   // not redrawn while the room is open, so the form is not wiped
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kb = (b) => b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB';
function sec(h) { if (!odaAcik) { duvarCiz(); odaAc(h); } }
function kapat() { if (odaAcik) odaKapat(); }
addEventListener('keydown', (e) => { if (e.key === 'Escape') kapat(); });
let bt; function bildir(s) { const b = $('bildiri'); b.textContent = s; b.classList.add('gor'); clearTimeout(bt); bt = setTimeout(() => b.classList.remove('gor'), 3000); }

// ---- session: if browser storage is off (sandboxed frame) it is kept in page memory
const BELLEK = new Map();
let temaDonus = null;   // place before the day/night switch: cell, tab, visitor view, scroll (the session is carried too)
try { if (window.name.startsWith('hive-geri:')) { temaDonus = JSON.parse(window.name.slice(10)); window.name = ''; if (temaDonus?.ot?.[1]) BELLEK.set(temaDonus.ot[0], temaDonus.ot[1]); } } catch { temaDonus = null; }
const OT = (n) => { try { return localStorage.getItem('hive-oturum-' + n) || BELLEK.get(n) || ''; } catch { return BELLEK.get(n) || ''; } };
const otYaz = (n, a) => { a ? BELLEK.set(n, a) : BELLEK.delete(n); try { a ? localStorage.setItem('hive-oturum-' + n, a) : localStorage.removeItem('hive-oturum-' + n); } catch {} };
let secilenZip = null, zipYukleniyor = false;   // the chosen .zip must not be lost on tab change/redraw
const boyutYaz = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const api = (yol, ayar = {}) => fetch(API + yol, { ...ayar, headers: { ...(ayar.ham ? {} : { 'content-type': 'application/json' }), 'x-hive-oturum': OT(secili?.p.isim), ...(ayar.headers || {}) } });

async function imzala(mesaj, ornek) {
  const c = await cuzdan();
  if (c?.sign) { const r = await c.sign(mesaj); if (r?.error) throw new Error(r.error.message || L('imza reddedildi', 'signature declined')); return r; }
  if (ornek && !canli) return fetch(API + '/api/demo-imza', { method: 'POST', body: JSON.stringify({ mesaj }) }).then((x) => x.json());
  throw new Error(L('Cüzdan yok: bu sayfayı Nimiq Pay içinde aç', 'No wallet: open this page in Nimiq Pay'));
}
async function girisYap(p, dugme) {
  const eski = dugme?.innerHTML;
  if (dugme) { if (dugme.classList.contains('ariyor')) return; dugme.classList.add('ariyor'); dugme.innerHTML = `<span class="halka"></span><span>${L('Cüzdan aranıyor…', 'Looking for a wallet…')}</span>`; }
  const geriAl = () => { if (dugme?.isConnected) { dugme.classList.remove('ariyor'); dugme.innerHTML = eski; } };
  try {
    const ornekGiris = p.ornek && !canli;
    if (!ornekGiris && !(await cuzdan(2500).catch(() => null))) { geriAl(); return cuzdanYok(); }   // no silent waiting: two doors open
    const { mesaj } = await fetch(API + '/api/giris/' + p.isim).then((x) => x.json());
    const s = await imzala(mesaj, p.ornek);
    const r = await fetch(API + '/api/giris', { method: 'POST', body: JSON.stringify({ mesaj, ...s }) }).then((x) => x.json());
    if (!r.anahtar) { bildir(r.hata === 'sahip_degil' ? L('Bu cüzdan ' + p.isim + '.nim sahibi değil', 'This wallet does not own ' + p.isim + '.nim') : L('Giriş olmadı: ', 'Sign-in failed: ') + r.hata); return; }
    otYaz(p.isim, r.anahtar); bildir(L('Hoş geldin, ', 'Welcome, ') + p.isim + '.nim'); ziyaretciGozu = false; odaSekme = 'genel'; odaCiz(false);
  } catch (e) { bildir(e.message); } finally { geriAl(); }
}

// ---- ROOM ("Hive Door" design): when a cell is picked the camera dives in, the hexagon opens and becomes a room.
// Outer face (visitor): big name + the cards the owner picked; the first card is a large stage on the right. Till, settings, data are NOT shown to visitors
// (the till only if the owner put it in "vitrin.kartlar"). Inner face (owner): the hive frames on the left are tabs (bottom bar on phones).
// The shop-window settings are in signed settings: vitrin.kartlar (order of "site,ari,kasa" = display order), vitrin.vurgu, tanitim.
// bee = lasting user (signed in / name owner; never disappears) + today's visitor (faded)
const ariSayi = (p) => (p.kullanici || 0) + (p.ziyaret?.bugun || 0);
let odaAcik = false, odaArilar = [], odaRaf = 0, odaSekme = 'genel', ziyaretciGozu = false, odaDurum = null, gozOnizleme = null;   // gozOnizleme: the unsaved choice in the Look tab
const hexClip = (cx, cy, rr) => 'polygon(' + [0, 1, 2, 3, 4, 5].map((i) => { const a = Math.PI / 3 * i - Math.PI / 2; return `${(cx + rr * Math.cos(a)).toFixed(1)}px ${(cy + rr * Math.sin(a)).toFixed(1)}px`; }).join(',') + ')';
const eio = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2), cikis = (v) => 1 - Math.pow(1 - v, 3);
function duvarCiz() {   // the room wall: repeating honeycomb pattern (covers the page however long it is)
  $('odaDuvar').innerHTML = '<defs><pattern id="pk" width="79.7" height="138" patternUnits="userSpaceOnUse"><path d="M39.8 0 79.7 23v46L39.8 92 0 69V23z M39.8 92v46" fill="none" stroke="rgba(160,100,30,.18)" stroke-width="2"/></pattern></defs><rect width="100%" height="100%" fill="url(#pk)"/>';
}
const ARI_SVG = `<svg class="g" viewBox="0 0 28 20"><ellipse cx="10" cy="5" rx="7" ry="4" fill="rgba(255,255,255,.88)" stroke="rgba(70,55,40,.45)" stroke-width=".6" transform="rotate(-25 10 5)"/><ellipse cx="17" cy="5" rx="6" ry="3.5" fill="rgba(255,255,255,.85)" stroke="rgba(70,55,40,.45)" stroke-width=".6" transform="rotate(25 17 5)"/>
  <ellipse cx="14" cy="12" rx="10" ry="6" fill="#F4AE3F" stroke="#2B1608" stroke-width="1"/><rect x="9" y="6.5" width="3" height="11" fill="#2B1608"/><rect x="15" y="6.5" width="2.6" height="11" fill="#2B1608"/><circle cx="24.5" cy="11" r="3.2" fill="#2B1608"/></svg>`;
const jar = (oran) => `<svg class="kavanoz" viewBox="0 0 96 118"><defs><clipPath id="jc"><path d="M14 30 Q12 24 18 22 H78 Q84 24 82 30 V104 Q82 114 70 114 H26 Q14 114 14 104Z"/></clipPath>
  <linearGradient id="jb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A8"/><stop offset=".4" stop-color="#F2A83A"/><stop offset="1" stop-color="#C2410C"/></linearGradient></defs>
  <rect x="22" y="6" width="52" height="16" rx="5" fill="#B45309"/><rect x="22" y="6" width="52" height="5" rx="2.5" fill="#D97706"/>
  <g clip-path="url(#jc)"><rect id="balY" x="0" y="114" width="96" height="120" fill="url(#jb)"/><path id="balUst" d="M0 114 q24 -6 48 0 t48 0 v8 h-96z" fill="#FFE7A8" opacity=".7"/></g>
  <path d="M14 30 Q12 24 18 22 H78 Q84 24 82 30 V104 Q82 114 70 114 H26 Q14 114 14 104Z" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.9)" stroke-width="3"/><path d="M24 34 V98" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/></svg>`;
const TUR = () => ({ sayi: L('sayı', 'number'), yazi: L('yazı', 'text'), ac: L('açık/kapalı', 'on/off') });
const turBul = (v) => (typeof v === 'boolean' ? 'ac' : typeof v === 'number' ? 'sayi' : 'yazi');

const VURGU = { amber: ['#D97706', '#B45309'], teal: ['#0D9488', '#0F766E'], green: ['#16A34A', '#15803D'], violet: ['#7C3AED', '#6D28D9'] };
const KART_TUM = ['site', 'urun', 'ari', 'kasa'];
const KART_ADI = () => ({ site: L('Site', 'Site'), urun: L('Ürünler', 'Products'), ari: L('Arılar', 'Bees'), kasa: L('Kasa', 'Vault') });
function vitrinOku(ayar, p) {   // shop window from signed settings; without settings: site (if any) + bees, till off
  const a = ayar?.ayar || {}, ham = a['vitrin.kartlar'];
  let kartlar = typeof ham === 'string' ? (ham === 'yok' ? [] : ham.split(',').map((x) => x.trim()).filter((x, i, d) => KART_TUM.includes(x) && d.indexOf(x) === i)) : ['site', 'ari'];
  if (!p.site) kartlar = kartlar.filter((k) => k !== 'site');
  return { kartlar, vurgu: VURGU[a['vitrin.vurgu']] ? a['vitrin.vurgu'] : 'amber', tanitim: typeof a.tanitim === 'string' ? a.tanitim.slice(0, 160) : '', kapak: a['vitrin.kapak'] === 'gorsel' ? 'gorsel' : 'canli' };
}
// shop-window image: its address if uploaded (with version, so the cache refreshes), else null
const gorsel = (p, ad) => { const g = (odaDurum?.medya || []).find((x) => x.ad === ad); return g ? `${API}/m/${p.isim}/${ad}?v=${g.zaman}` : null; };

const sayiYaz = (n) => Number(n || 0).toLocaleString(dil === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2 });
const gunOnce = (t) => { if (!t) return ''; const g = Math.floor((Date.now() - t) / 864e5); return g <= 0 ? L('bugün', 'today') : g === 1 ? L('dün', 'yesterday') : L(g + ' gün önce', g + ' days ago'); };
const petekLink = (isim) => 'https://hive.heylogram.com/#n=' + isim;
const siteAdres = (u) => { try { return new URL(u, (API || location.origin) + '/').href; } catch { return u || ''; } };   // sample sites come with relative addresses
const siteGoster = (u) => siteAdres(u).replace(/^https?:\/\//, '').replace(/\/$/, '');
const IK = {
  geri: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 3 5 8l5 5"/></svg>',
  anahtar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/></svg>',
  genel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 21 7v10l-9 5-9-5V7z"/></svg>',
  goz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
  kasa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4h10M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M6 13h12"/></svg>',
  site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/></svg>',
  ayar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  ari: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="14" rx="7" ry="5"/><path d="M10 9.5v9M14 9.5v9M8 8C5 4 3 6 5 9M16 8c3-4 5-2 3 1"/></svg>',
  telefon: '<svg viewBox="0 0 64 64" fill="none"><rect x="18" y="6" width="28" height="52" rx="7" fill="#fff" stroke="#3A2412" stroke-width="3"/><path d="M28 50h8" stroke="#3A2412" stroke-width="3" stroke-linecap="round"/><path d="M32 18 40 23v10l-8 5-8-5V23z" fill="#D97706"/></svg>',
  eklenti: '<svg viewBox="0 0 64 64" fill="none"><rect x="6" y="12" width="52" height="38" rx="6" fill="#fff" stroke="#3A2412" stroke-width="3"/><path d="M6 21h52" stroke="#3A2412" stroke-width="3"/><path d="M40 30h8v6a3 3 0 1 1 0 6v6h-8a3 3 0 1 0-6 0h-6v-8a3 3 0 1 1 0-6v-4z" fill="#0D9488"/></svg>',
};
const temaSimge = () => (window.HIVE_TEMA?.gece
  ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="#F59E0B" stroke="#D97706"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" stroke="#D97706"/></svg>'
  : '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" fill="#FCD34D" stroke="#F59E0B" stroke-width="1.6" stroke-linejoin="round"/></svg>');

async function odaCiz(yeni) {
  const h = secili, p = h.p, sahipMi = !!OT(p.isim) || (YEREL && new URLSearchParams(location.search).get('onizle') === 'sahip');
  const ayar = await fetch(API + '/api/ayar/' + p.isim).then((r) => r.json()).catch(() => ({}));
  const v = vitrinOku(ayar, p), sahip = sahipMi && !ziyaretciGozu;
  if (ziyaretciGozu && gozOnizleme) { Object.assign(v, { kartlar: gozOnizleme.kartlar.filter((k) => k !== 'site' || p.site), vurgu: gozOnizleme.vurgu, tanitim: gozOnizleme.tanitim, kapak: gozOnizleme.kapak || v.kapak }); }
  const [medya, urunler] = await Promise.all([
    fetch(API + '/api/medya/' + p.isim).then((r) => r.json()).then((j) => j.gorseller || []).catch(() => []),
    fetch(API + '/api/urunler/' + p.isim).then((r) => r.json()).then((j) => j.urunler || []).catch(() => [])]);
  if (!urunler.length) v.kartlar = v.kartlar.filter((k) => k !== 'urun');
  // if the till is closed to visitors the balance is never asked for
  const bakiye = p.ornek || !(sahip || v.kartlar.includes('kasa')) ? null
    : await fetch('https://signal.heylogram.tv/pigeonapi/api/balance/' + encodeURIComponent(p.adres)).then((r) => r.json()).then((j) => j.value / 1e5).catch(() => null);
  if (secili !== h || !odaAcik) return;
  odaDurum = { h, p, ayar, bakiye, v, sahip, sahipMi, yeni, medya, urunler };
  const oda = $('oda'); oda.classList.toggle('sahip', sahip);
  oda.style.setProperty('--vurgu', VURGU[v.vurgu][0]); oda.style.setProperty('--vurgu-yazi', VURGU[v.vurgu][1]);
  cancelAnimationFrame(odaRaf); $('odaUcus').innerHTML = ''; odaArilar = [];
  $('odaIc').innerHTML = sahip ? icYuz(odaDurum) : disYuz(odaDurum);
  $('odaIc').scrollTop = 0;
  // on phones tabs are a sideways scrolling strip at the top: keep the selected tab visible after a redraw
  const secSekme = $('odaIc').querySelector('.a-raf .a-cita.sec'), raf = secSekme?.parentElement;
  if (raf && raf.scrollWidth > raf.clientWidth) raf.scrollLeft = secSekme.offsetLeft - (raf.clientWidth - secSekme.offsetWidth) / 2;
  $('odaIc').querySelectorAll('[data-is]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); islem(b.dataset.is, b); }));
  if ($('zip')) {
    const adYaz = () => { const f = secilenZip?.isim === p.isim ? secilenZip.dosya : null; $('zipAd').textContent = f ? f.name + ' · ' + boyutYaz(f.size) : L('Seçilmedi (.zip)', 'None chosen (.zip)'); };
    const sec = (f) => { if (!f) return; if (!/\.zip$/i.test(f.name)) return bildir(L('Yalnız .zip dosyası', 'Only a .zip file')); secilenZip = { isim: p.isim, dosya: f }; adYaz(); };
    $('zip').onchange = () => sec($('zip').files?.[0]);
    const kutu = $('zip').closest('label');
    kutu.addEventListener('dragover', (e) => { e.preventDefault(); kutu.classList.add('ustunde'); });
    kutu.addEventListener('dragleave', () => kutu.classList.remove('ustunde'));
    kutu.addEventListener('drop', (e) => { e.preventDefault(); kutu.classList.remove('ustunde'); sec(e.dataTransfer?.files?.[0]); });
    adYaz();
  }
  $('odaIc').querySelectorAll('.site-k [data-yol]').forEach((b) => (b.onclick = () => { const k = b.closest('.site-k'); k.dataset.secim = b.dataset.yol; k.querySelectorAll('[data-yol]').forEach((x) => x.classList.toggle('sec', x === b)); }));
  if ($('kv')) { const kvEl = $('kv');
    const satirEkle = (k, val, t) => { const d = document.createElement('div'); d.className = 'kvS'; d.dataset.k = k; d.dataset.t = t;
      d.innerHTML = `<span class="hucre kod">${esc(k)}</span>${t === 'ac' ? `<span class="anahtar${val ? '' : ' kapali'}" role="switch" tabindex="0"></span>` : `<input class="hucre" value="${esc(String(val))}" />`}<span class="tur">${TUR()[t]}</span><span class="sil">×</span>`;
      d.querySelector('.sil').onclick = () => d.remove(); const an = d.querySelector('.anahtar'); if (an) an.onclick = () => an.classList.toggle('kapali');
      kvEl.appendChild(d); $('kvBos')?.remove(); };
    for (const [k, val] of Object.entries(ayar.ayar || {})) if (!gorunumAnahtari(k)) satirEkle(k, val, turBul(val));   // the Look tab's keys are managed there
    odaCiz.satirEkle = satirEkle; }
  if ($('konsol')) { konsol.k = null; konsol.b = null; konsolCiz(); }
  if ($('gd')) gorunumBagla(odaDurum);
  if ($('ariL')) arilariYaz(p.isim);
  if ($('alanListe')) alanlariYaz(p);
  if ($('odemeK')) odemeBagla(p);
  // content arrives in order
  [...$('odaIc').querySelectorAll('.a-gel')].forEach((c, i) => { c.style.animationDelay = (80 + i * 70) + 'ms'; });
  kasaDoldur(odaDurum);
  if (!sahip) arilarUcur(p, yeni);
}

// ---- the jar fills, the balance counts up; when the Nimiq Pay vault (HTLC) arrives from Pigeon the total fills to it (the vault scan can take a while)
let kavanozNo = 0;
function kasaDoldur({ h, p, bakiye }) {
  if (!$('bak')) return;
  const kavanoz = (eski, yeni, gecikme) => { const bas = performance.now() + gecikme, no = ++kavanozNo;
    const f = (z) => { if (no !== kavanozNo) return; const j = eio(Math.max(0, Math.min(1, (z - bas) / 1100))), deger = eski + (yeni - eski) * j, y0 = 114 - 84 * Math.min(0.92, deger / 500); const by = $('balY'); if (!by) return;
      by.setAttribute('y', y0.toFixed(1)); $('balUst').setAttribute('d', `M0 ${y0.toFixed(1)} q24 -6 48 0 t48 0 v8 h-96z`); $('bak').innerHTML = `${sayiYaz(deger)} <span>NIM</span>`; if (j < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f); };
  if (bakiye == null) { $('bak').innerHTML = '– <span>NIM</span>'; return; }
  kavanoz(0, bakiye, 500);
  const kasaSor = (deneme) => fetch('https://signal.heylogram.tv/pigeonapi/api/vaults/' + encodeURIComponent(p.adres)).then((r) => r.json()).then((x) => {
    if (secili !== h || !odaAcik || !$('bak')) return;
    if (x.pending && deneme < 6) { setTimeout(() => kasaSor(deneme + 1), 15000); return; }
    const toplam = x.total / 1e5; if (!(toplam > bakiye)) return;
    kavanoz(bakiye, toplam, 0);
    const pay = $('bakPay'); if (pay) pay.textContent = sayiYaz(toplam - bakiye);
    const ana = $('bakCuz'); if (ana) ana.textContent = sayiYaz(bakiye);
  }).catch(() => {});
  kasaSor(0);
}

// ---- bees fly in the room: users solid, today's visitors faded; on touch they dart off and bounce off the walls
function arilarUcur(p, yeni) {
  const kutu = $('odaUcus'), az = matchMedia('(prefers-reduced-motion: reduce)').matches, n = yeni ? 1 : Math.min(40, ariSayi(p));
  odaArilar = Array.from({ length: n }, (_, i) => {
    const d = document.createElement('div'), ziy = !yeni && i >= (p.kullanici || 0);
    d.className = 'ari' + (ziy ? ' ziyaretci' : ''); d.innerHTML = ARI_SVG + `<span class="et">${yeni ? L('sen', 'you') : ziy ? L('bugünkü ziyaretçi', 'visitor today') : L('kullanıcı', 'user')}</span>`;
    kutu.appendChild(d);
    const b = { d, x: Math.random() < 0.5 ? -0.05 : 1.05, y: 0.2 + Math.random() * 0.7, vx: (Math.random() - 0.5) * 0.004, vy: (Math.random() - 0.5) * 0.003, f: Math.random() * 6, bas: performance.now() + 300 + i * 50, gir: 0.08 + 0.84 * Math.random() };
    d.onpointerdown = (e) => { e.preventDefault(); d.classList.add('acik'); setTimeout(() => d.classList.remove('acik'), 1600); b.vx = (Math.random() - 0.5) * 0.03; b.vy = -0.02 - Math.random() * 0.01; };
    return b;
  });
  let son = performance.now();
  const adim = (z) => {
    const dt = Math.min(40, z - son) / 16; son = z; const W = kutu.clientWidth, H = kutu.clientHeight;
    for (const b of odaArilar) {
      if (z < b.bas) { b.d.style.opacity = 0; continue; }
      const giris = Math.min(1, (z - b.bas) / 1100); b.d.style.opacity = giris;
      if (giris < 1) b.x += (b.gir - b.x) * 0.06 * dt;
      else if (!az) {
        b.vx += Math.cos(z / 900 + b.f) * 0.00006 * dt; b.vy += Math.sin(z / 700 + b.f) * 0.00006 * dt;
        b.vx *= 0.985; b.vy *= 0.985; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 0.03 || b.x > 0.97) { b.vx = -b.vx * 0.8; b.x = Math.max(0.03, Math.min(0.97, b.x)); }
        if (b.y < 0.1 || b.y > 0.94) { b.vy = -b.vy * 0.8; b.y = Math.max(0.1, Math.min(0.94, b.y)); }
      }
      b.d.style.transform = `translate(${(b.x * W).toFixed(1)}px, ${(b.y * H + Math.sin(z / 500 + b.f) * 3).toFixed(1)}px) scaleX(${b.vx < 0 ? -1 : 1})`;
    }
    if (odaAcik && !document.hidden) odaRaf = requestAnimationFrame(adim);
  };
  cancelAnimationFrame(odaRaf); odaRaf = requestAnimationFrame(adim);
}

const ustSerit = (sahip) => `<div class="a-ust"><button class="a-geri" data-is="odaKapat">${IK.geri}${ziyaretciGozu ? L('Panele dön', 'Back to panel') : L('Kovana dön', 'Back to hive')}</button><span class="a-bosluk"></span>
  ${sahip || ziyaretciGozu ? '' : `<button class="a-gir" data-is="giris">${IK.anahtar}<span><span class="uzun">${L('Bu petek ', 'Is this cell ')}</span>${L('senin mi? Gir', 'yours? Sign in')}</span></button>`}
  ${ziyaretciGozu ? `<button class="a-gir" data-is="sahipGozu">${IK.goz}<span>${gozOnizleme ? L('Önizleme (kaydedilmedi) · panele dön', 'Preview (not saved) · back to panel') : L('Ziyaretçi gözü · panele dön', 'Visitor view · back to panel')}</span></button>` : ''}
  <button class="a-tema a-dil" data-is="dil" aria-label="${L('Dil', 'Language')}">${dil === 'tr' ? 'EN' : 'TR'}</button><button class="a-tema" data-is="tema" aria-label="${L('Gece / gündüz', 'Night / day')}">${temaSimge()}</button></div>`;

// ---- OUTER FACE: the shop window a visitor sees
function urunKartlari(p, enCok) {
  return (odaDurum?.urunler || []).slice(0, enCok).map((u) => { const g = gorsel(p, 'urun-' + u.id);
    return `<div class="a-urun">${g ? `<img src="${esc(g)}" alt="" loading="lazy" />` : `<i class="a-urun-bos">${esc(String(u.ad || '?').slice(0, 1).toUpperCase())}</i>`}<b>${esc(u.ad)}</b><span>${sayiYaz(u.fiyat)} NIM${u.kalan != null ? ` · ${u.kalan === 0 ? L('tükendi', 'sold out') : u.kalan + L(' kaldı', ' left')}` : ''}</span></div>`; }).join('');
}
function disYuz({ p, v, yeni }) {
  const ks = v.kartlar, site = ks.includes('site') ? p.site : null, gun = p.zaman ? Math.max(1, Math.ceil((Date.now() - p.zaman) / 864e5)) : null;
  const BUYUK = {
    site: () => !site ? '' : `<div class="a-cerceve"><div class="a-cam"><div class="a-bar"><i></i><i></i><i></i><span>${esc(siteGoster(site.adres))}</span></div>
      ${v.kapak === 'gorsel' && gorsel(p, 'kapak') ? `<img class="a-kapak" src="${esc(gorsel(p, 'kapak'))}" alt="" />` : ''}<div class="a-onsite ${v.kapak === 'gorsel' && gorsel(p, 'kapak') ? 'kapakli' : ''}"><b>${esc(site.baslik || p.isim + '.nim')}</b><span>${esc(siteGoster(site.adres))}</span><a class="a-btn ana" href="${esc(siteAdres(site.adres))}" target="_blank" rel="noopener">${L('Siteyi aç', 'Open site')}</a></div></div>
      ${site.yayin ? `<span class="a-etiket">${L('Güncellendi: ', 'Updated: ')}${gunOnce(site.yayin)}</span>` : ''}</div>`,
    ari: () => `<div class="a-sahne-ari"><div class="a-petekler">${Array.from({ length: Math.max(7, Math.min(28, ariSayi(p))) }, (_, k) => `<i class="${k < (p.kullanici || 0) ? 'dolu' : k < ariSayi(p) ? 'soluk' : ''}" style="--d:${k * 35}ms"></i>`).join('')}</div>
      <div class="a-sahne-alt"><b>${p.kullanici || 0}</b> ${L('arı bu peteğe bağlı', 'bees belong to this cell')} · <b>${p.ziyaret?.bugun || 0}</b> ${L('bugün uğradı', 'came by today')}</div><div class="ariL" id="ariL"></div></div>`,
    urun: () => `<div class="a-sahne-urun"><div class="a-urunler">${urunKartlari(p, 99)}</div>${site?.adres ? `<a class="a-btn ana" href="${esc(siteAdres(site.adres))}" target="_blank" rel="noopener">${L('Satın almak için siteye git', 'Go to the site to buy')}</a>` : ''}</div>`,
    kasa: () => `<div class="a-sahne-kasa">${jar(0)}<div><b id="bak">– <span>NIM</span></b><small>${L('Sahibi kasasını herkese açtı. Para Hive\'da durmaz; kavanoz sahibinin kendi cüzdanı.', 'The owner made the vault public. Hive never holds money; the jar is the owner\'s own wallet.')}</small></div></div>`,
  };
  const KUCUK = {
    site: () => '',
    ari: () => `<div class="a-muhur"><div><b>${p.kullanici || 0}</b><small>${L('arı', 'bees')}</small></div><div><b>${p.ziyaret?.bugun || 0}</b><small>${L('bugün', 'today')}</small></div><div><b>${sayiYaz(p.ziyaret?.toplam || 0)}</b><small>${L('ziyaret', 'visits')}</small></div></div><div class="ariL" id="ariL"></div>`,
    urun: () => `<div class="a-urunler kucuk">${urunKartlari(p, 3)}</div>`,
    kasa: () => `<div class="a-kasa-kucuk">${jar(0)}<div><b id="bak">– <span>NIM</span></b><small>${L('Sahibi kasasını herkese açtı', 'The owner made the vault public')}</small></div></div>`,
  };
  return ustSerit(false) + `<section class="a-vitrin ${ks.length ? '' : 'tek'}">
    <div class="a-kim a-gel">
      <div class="a-hex"><i class="idn">${idSvg.get(p.adres) || ''}</i>${p.sira ? `<span class="a-sira">№${p.sira}</span>` : ''}</div>
      <h1 class="a-ad">${esc(p.isim)}<em>.nim</em></h1>
      <div class="a-alt">${site ? `<span><i></i>${L('Site yayında', 'Site is live')}</span>` : ''}${gun ? `<span>${L('Kovanda ', 'In the hive for ')}${gun}${L(' gündür', gun === 1 ? ' day' : ' days')}</span>` : ''}</div>
      ${yeni ? `<p class="a-tanitim">${L('Petek balmumundan yeni doğdu. İlk arı sensin. Peteğine girmek için cüzdanınla imza at.', 'Your cell was just born from wax. You are its first bee. Sign with your wallet to step inside.')}</p>` : v.tanitim ? `<p class="a-tanitim">${esc(v.tanitim)}</p>` : ''}
      <div class="a-eylem">${site?.adres ? `<a class="a-btn ana" href="${esc(siteAdres(site.adres))}" target="_blank" rel="noopener">${L('Siteyi aç', 'Open site')}</a>` : ''}${yeni ? `<button class="a-btn ana" data-is="giris">${L('Cüzdanla gir', 'Sign in with wallet')}</button>` : ''}<button class="a-btn ikinci" data-is="paylas">${L('Paylaş', 'Share')}</button>${p.ornek ? '' : `<button class="a-btn ikinci" data-is="bahsis">${L('Bahşiş', 'Tip')}</button>`}</div>
      <div class="a-bahsis" id="bahsisKutu" hidden><span>${L('Ne kadar?', 'How much?')}</span>${[1, 5, 10].map((v) => `<button class="a-btn ikinci" data-is="bahsisGonder" data-nim="${v}">${v} NIM</button>`).join('')}<small>${L('Para doğrudan bu ismin sahibine gider; Hive aracı değildir.', 'The money goes straight to this name\'s owner; Hive is not in between.')}</small></div>
      ${ks.slice(1).map((k) => KUCUK[k]()).join('')}
    </div>
    ${ks.length ? `<div class="a-sahne a-gel">${BUYUK[ks[0]]()}</div>` : ''}
  </section>`;
}

// ---- INNER FACE: the owner's hive frames
const SEKMELER = () => [['genel', IK.genel, L('Genel', 'Overview')], ['gorunum', IK.goz, L('Görünüm', 'My page')], ['kasa', IK.kasa, L('Kasa', 'Vault')], ['odeme', IK.qr, L('Ödeme al', 'Get paid')], ['site', IK.site, L('Site', 'Site')], ['ayar', IK.ayar, L('Ayarlar', 'Settings')], ['db', IK.db, L('Veri', 'Data')], ['ari', IK.ari, L('Arılar', 'Bees')]];
function icYuz(d) {
  const { p, v, yeni } = d;
  if (!SEKMELER().some(([k]) => k === odaSekme)) odaSekme = 'genel';
  const kasaGorunur = v.kartlar.includes('kasa');
  const kKasa = (s) => `<div class="a-kart ${s} a-gel"><h3>${L('Kasa · senin cüzdanın', 'Vault · your wallet')}<span class="sag">${L('para bizde durmaz', 'we never hold money')}</span></h3>
    <div class="a-kasa-ic">${jar(0)}<div><div class="a-bak" id="bak">– <span>NIM</span></div><div class="a-dok"><span>${L('Cüzdan', 'Wallet')} <b id="bakCuz">${d.bakiye == null ? '–' : sayiYaz(d.bakiye)}</b></span><span>${L('Nimiq Pay kasası', 'Nimiq Pay vault')} <b id="bakPay">0</b></span></div></div></div>
    <div class="a-gorunur"><div><b>${L('Ziyaretçiler kasamı görsün', 'Visitors can see my vault')}: ${kasaGorunur ? L('açık', 'on') : L('kapalı', 'off')}</b><small>${kasaGorunur ? L('Vitrinde kavanoz ve bakiye görünüyor.', 'The jar and balance show on your page.') : L('Kasan yalnız sana görünür.', 'Only you can see your vault.')}</small></div><button class="a-btn ikinci" data-is="sekme" data-sekme="gorunum">${L('Görünüm’de değiştir', 'Change in My page')}</button></div>
</div>`;
  const site = p.site;
  const kSite = (s) => `<div class="a-kart ${s} site-k a-gel" data-secim="${site?.dis ? 'sunucu' : 'yukle'}"><h3>${L('Site', 'Site')}</h3>
    ${site ? `<div class="a-site-durum"><i></i><span>${esc(siteGoster(site.adres))}</span><small>${L('yayında', 'live')}${site.yayin ? ' · ' + gunOnce(site.yayin) : ''}</small><a href="${esc(siteAdres(site.adres))}" target="_blank" rel="noopener">${L('Aç', 'Open')}</a></div>` : `<div class="a-site-durum bos"><i></i><span>${L('Henüz site yok', 'No site yet')}</span><small>${L('yayınlayınca petek bal ile dolar', 'publish and the cell fills with honey')}</small></div>`}
    <div class="a-yol"><div class="secenek ${site?.dis ? '' : 'sec'}" data-yol="yukle"><b>${L('Dosya yükle', 'Upload files')}</b><small>${L('Derlenmiş siteni .zip olarak bırak; birkaç saniyede yayında.', 'Drop your built site as a .zip; live in seconds.')}</small></div>
      <div class="secenek ${site?.dis ? 'sec' : ''}" data-yol="sunucu"><b>${L('Kendi sunucum', 'My own server')}</b><small>${L('Tek satırı sayfana yapıştır, bağla. Her ziyaretçi kovanda arı olur.', 'Paste one line into your page and link it. Every visitor becomes a bee.')}</small></div></div>
    <div class="yol-yukle">${canli ? `<label class="giris-kutu dosyaSec a-birak"><input id="zip" type="file" accept=".zip,application/zip" hidden /><b>${L('Dosya seç', 'Choose file')}</b><span id="zipAd">${L('Seçilmedi (.zip)', 'None chosen (.zip)')}</span></label>
      <div class="dug" data-is="zip">${L('Derlenmiş siteyi yükle (.zip)', 'Upload built site (.zip)')}</div><div class="zipIlerleme" id="zipIlerleme" hidden><i></i><span></span></div>` : `<input id="repo" placeholder="https://github.com/user/repo" value="${esc(site?.repo || '')}" class="giris-kutu" />
      <input id="api" placeholder="${L('dış API (isteğe bağlı)', 'external API (optional)')}" class="giris-kutu" /><div class="dug" data-is="deploy">${L('GitHub\'dan yayınla', 'Publish from GitHub')}</div><div class="depo" id="dgun"></div>`}
      <div class="a-masaustu"><b>${L('Zip yüklemek telefonda zor', 'Uploading a zip is hard on a phone')}</b>${L('Bilgisayarda hive.heylogram.com\'u aç, peteğine gir; kaldığın yerden devam et.', 'Open hive.heylogram.com on a computer, sign in to your cell and carry on.')}<div class="iki"><button data-is="linkGonder">${L('Bağlantıyı bana gönder', 'Send me the link')}</button><button data-is="linkKopya">${L('Kopyala', 'Copy')}</button></div></div></div>
    <div class="yol-sunucu"><input id="disUrl" placeholder="https://my-site.com" value="${esc(site?.dis || sonKanit[p.isim] || '')}" class="giris-kutu" />
      <div class="iki"><div class="dug ikinci" data-is="kanit">${L('1 · İmzala, satırı al', '1 · Sign, get the line')}</div><div class="dug" data-is="bagla">${L('2 · Siteyi bağla', '2 · Link the site')}</div></div><div id="kanit"></div>
      <div class="not">${L('Satırı sitenin index.html dosyasında &lt;/body&gt; satırının hemen üstüne koy, siteyi yayınla, ilk ziyarette petek kendiliğinden bağlanır (beklemek istemezsen 2 · Siteyi bağla). Satırdaki imza sitenin senin olduğunu gösterir, her ziyaretçiyi de kovanda arı yapar.', 'Put the line right above &lt;/body&gt; in your site\'s index.html and publish: the cell links itself at the first visit (or press 2 · Link). The signature in the line proves the site is yours and turns every visitor into a bee.')}</div></div>
</div>`;
  const kAlan = (s) => `<div class="a-kart ${s} a-gel alanKart"><h3>${L('Kendi alan adın', 'Your own domain')}<span class="sag">${L('siteni senin adresinde aç', 'your site on your address')}</span></h3>

      <div class="not">${L('Satın aldığın alan adını (Porkbun, Hostinger…) bu peteğin sitesine bağla. Vercel gibi: DNS kayıtlarını gir, gerisini Hive yapar, sertifika kendiliğinden gelir.', 'Point a domain you bought (Porkbun, Hostinger…) at this cell\'s site. Like Vercel: add the DNS records, Hive does the rest and the certificate comes on its own.')}</div>
      <div class="iki"><input id="alanGir" placeholder="ornek.com" class="giris-kutu" autocomplete="off" spellcheck="false" /><div class="dug" data-is="alanEkle">${L('Alan adını ekle', 'Add domain')}</div></div>
      <div id="alanListe"></div></div>`;
  const kOdeme = (s) => `<div class="a-kart ${s} a-gel odemeK" id="odemeK"><h3>${L('Ödeme al · dükkân kasası', 'Get paid · shop till')}<span class="sag">${L('para doğrudan sana', 'straight to you')}</span></h3>
    ${p.ornek ? `<div class="not">${L('Örnek isimde ödeme alınamaz.', 'Sample names cannot take payments.')}</div>` : `<div id="odemeGir">
      <label class="odemeEt">${L('Tutar (NIM)', 'Amount (NIM)')}</label>
      <div class="iki"><input id="odemeTutar" class="giris-kutu odemeTutar" inputmode="decimal" autocomplete="off" placeholder="0" /><div class="dug" data-is="odemeOlustur">${L('QR oluştur', 'Make QR')}</div></div>
      <input id="odemeNot" class="giris-kutu" maxlength="40" autocomplete="off" placeholder="${L('Not (isteğe bağlı): ekmek', 'Note (optional): bread')}" />
      <small class="not">${L('Müşteri QR\'ı Nimiq Pay ile okutur, onaylar. Ödeme zincirde görülünce ekran yeşile döner. Tutarın sonundaki küçük haneler bu satışı tanımak içindir.', 'The customer scans the QR with Nimiq Pay and approves. When the payment shows on chain, the screen turns green. The tiny digits at the end of the amount identify this sale.')}</small></div>
    <div id="odemeAktif" hidden></div>`}
    <h4 class="odemeBas">${L('Son satışlar', 'Recent sales')}</h4><div id="odemeListe"></div>
    ${p.ornek ? '' : `<h4 class="odemeBas">${L('Tezgâh kartı', 'Counter card')}</h4>
    <small class="not">${L('İsmin, resmin ve adresinin QR\'ı tek kâğıtta. Tezgâha koy; müşteri tutarı kendisi yazar.', 'Your name, your picture and a QR of your address on one sheet. Put it on the counter; the customer types the amount.')}</small>
    <div class="iki"><button class="a-btn ikinci" data-is="kartYazdir">${L('Kartı yazdır', 'Print the card')}</button></div>`}
  </div>`;
  const kAyar = (s) => `<div class="a-kart ${s} a-gel"><h3>${L('Ayarlar · imzalı', 'Settings · signed')}<span class="sag">#${d.ayar.surum || 0}</span></h3>
    <div class="kv" id="kv"><div class="kvB"><span>${L('Anahtar', 'Key')}</span><span>${L('Değer', 'Value')}</span><span>${L('Tür', 'Type')}</span><span></span></div>
    ${Object.keys(d.ayar.ayar || {}).length ? '' : `<div class="not" id="kvBos">${L('Henüz ayar yok.', 'No settings yet.')}</div>`}</div>
    <div class="kvS yeniS"><input class="hucre kod" id="yAn" placeholder="${L('yeni_anahtar', 'new_key')}" /><input class="hucre" id="yDe" placeholder="${L('değer', 'value')}" /><select class="tur" id="yTu"><option value="yazi">${TUR().yazi}</option><option value="sayi">${TUR().sayi}</option><option value="ac">${TUR().ac}</option></select><span class="ekle" data-is="ekle">+</span></div>
    <div class="dug" data-is="ayar">${L('İmzala ve kaydet', 'Sign and save')}</div>
    <div class="not">${L('Uygulaman bu anahtarları okur. Kaydı yalnız sen imzalarsın; imzasız değişiklik geçmez. "tanitim" vitrindeki kısa yazıdır. İmza para göndermez.', 'Your app reads these keys. Only you sign a save; unsigned changes are refused. "tanitim" is the short text on your page. Signing sends no money.')}</div></div>`;
  const kGorunum = (s) => `<div class="a-kart ${s} a-gel">${gorunumHtml(v, d)}</div>`;
  const kAri = (s) => `<div class="a-kart ${s} a-gel"><h3>${L('Arılar', 'Bees')}<span class="sag">${p.kullanici || 0} · ${p.ziyaret?.bugun || 0} ${L('bugün', 'today')}</span></h3>
    <div class="a-muhur"><div><b>${p.kullanici || 0}</b><small>${L('kalıcı arı', 'bees')}</small></div><div><b>${p.ziyaret?.bugun || 0}</b><small>${L('bugün', 'today')}</small></div><div><b>${sayiYaz(p.ziyaret?.toplam || 0)}</b><small>${L('toplam ziyaret', 'total visits')}</small></div></div>
    <div class="ariL" id="ariL"></div>
    <div class="not">${L('Arı = imzayla giren kullanıcı ya da alt isim sahibi; kaybolmaz. Soluk arı = bugün uğrayan ziyaretçi. Kendi sitende tek satır varsa her ziyaretçi sayılır (aynı kişi günde bir kez).', 'Bee = a user who signed in or owns a sub-name; never disappears. Faint bee = a visitor today. With the one line on your own site every visitor counts (once a day per person).')}</div></div>`;
  const pano = {
    genel: (yeni ? `<div class="a-kart s12 a-gel"><h3>${L('İlk adımlar', 'First steps')}</h3><div class="ilk"><div class="tamam"><i>1</i>${L('İsim senin: ', 'The name is yours: ')}${esc(p.isim)}.nim</div><div><i>2</i>${L('Siteni yayınla: peteğe bal dolsun', 'Publish your site: fill the cell with honey')}</div><div><i>3</i>${L('Alt isim aç: arılar gelsin', 'Open sub-names: let the bees come')}</div></div></div>` : '')
      + kKasa('s5') + kGorunum('s7') + kSite('s12') + (site?.dis ? '' : kAlan('s12')),
    gorunum: kGorunum('s12'), kasa: kKasa('s12'), site: kSite('s12') + (site?.dis ? '' : kAlan('s12')), ayar: kAyar('s12'),
    db: `<div class="a-kart s12 konsolK a-gel" id="konsol"></div>`, ari: kAri('s12'), odeme: kOdeme('s12'),
  }[odaSekme];
  return ustSerit(true) + `<section class="a-ic">
    <nav class="a-raf"><div class="a-ben"><i class="idn">${idSvg.get(p.adres) || ''}</i><div><b>${esc(p.isim)}<em>.nim</em></b><small>${L('Senin peteğin', 'Your cell')}</small></div></div>
      ${SEKMELER().map(([k, ik, ad]) => `<button class="a-cita ${k === odaSekme ? 'sec' : ''}" data-is="sekme" data-sekme="${k}">${ik}<span>${ad}</span>${k === 'ari' && p.ziyaret?.bugun ? `<span class="rozet">${p.ziyaret.bugun}</span>` : ''}</button>`).join('')}
      <button class="a-cikis" data-is="cikis">${L('Çıkış', 'Sign out')}</button></nav>
    <div class="a-pano">${pano}</div></section>`;
}

// ---- "Your look": the owner builds their own outer face; changes show in a small live preview, saving writes signed settings
const ACIKLAMA = () => ({ urun: L('Ürünlerin, fotoğrafı ve fiyatıyla', 'Your products, with photo and price'), site: L('Site önizlemesi ve "Siteyi aç"', 'Site preview and "Open site"'), ari: L('Kullanıcıların, bugünkü arılar', "Your users, today's bees"), kasa: L('NIM bakiyen. Kapalıyken hiç görünmez.', 'Your NIM balance. Hidden entirely when off.') });
function gorunumHtml(v, d) {
  const tum = [...v.kartlar, ...KART_TUM.filter((k) => !v.kartlar.includes(k))];
  return `<div class="gd" id="gd"><div class="gd-bas"><b>${L('Görünümün', 'Your page')}</b><small>${L('Ziyaretçi ne görsün, hangi sırayla, sen seç.', 'Choose what visitors see, and in what order.')}</small></div>
    <div class="gd-govde"><div class="gd-sol">
      <div class="gd-liste">${tum.map((k) => `<div class="gd-sat" data-k="${k}"><span class="gd-ok"><button data-y="-1" aria-label="${L('yukarı', 'up')}">&#9650;</button><button data-y="1" aria-label="${L('aşağı', 'down')}">&#9660;</button></span><div><b>${KART_ADI()[k]}</b><small>${ACIKLAMA()[k]}${k === 'site' && !secili?.p.site ? ' · ' + L('henüz site yok', 'no site yet') : ''}${k === 'urun' && !d.urunler?.length ? ' · ' + L('Ayarlar\'da "urunler" ekleyince görünür', 'shows once you add "urunler" in Settings') : ''}</small></div><button class="gd-sw ${v.kartlar.includes(k) ? 'acik' : ''}" aria-label="${KART_ADI()[k]}"></button></div>`).join('')}</div>
      <label class="gd-et">${L('Kısa tanıtım', 'Short intro')} <small class="gd-say"></small></label><textarea class="gd-yazi" maxlength="160" rows="2" placeholder="${L('Peteğini bir cümleyle anlat', 'Describe your cell in one sentence')}">${esc(v.tanitim)}</textarea>
      <div class="gd-et">${L('Vurgu rengi', 'Accent colour')}</div><div class="gd-renk">${Object.entries(VURGU).map(([k, [c]]) => `<button data-v="${k}" style="--c:${c}" class="${k === v.vurgu ? 'sec' : ''}" aria-label="${k}"></button>`).join('')}</div>
      <div class="gd-et">${L('Site önizlemesi', 'Site preview')}</div>
      <div class="gd-kapak"><div class="gd-secim"><button data-kapak="canli" class="${v.kapak === 'canli' ? 'sec' : ''}">${L('Sitenin kendisi', 'The site itself')}</button><button data-kapak="gorsel" class="${v.kapak === 'gorsel' ? 'sec' : ''}">${L('Kendi görselim', 'My own picture')}</button></div>
        <label class="gd-yukle">${gorsel(d.p, 'kapak') ? `<img src="${esc(gorsel(d.p, 'kapak'))}" alt="" /><button class="gd-sil" data-sil-gorsel="kapak" aria-label="${L('Kapağı sil', 'Delete cover')}">×</button>` : `<i></i>`}<span>${L('Kapak görseli seç', 'Choose cover picture')}</span><input type="file" accept="image/png,image/jpeg,image/webp" data-gorsel="kapak" hidden /></label></div>
      ${d.urunler?.length ? `<div class="gd-et">${L('Ürün fotoğrafları', 'Product photos')}</div><div class="gd-urunler">${d.urunler.map((u) => `<label class="gd-yukle kucuk">${gorsel(d.p, 'urun-' + u.id) ? `<img src="${esc(gorsel(d.p, 'urun-' + u.id))}" alt="" /><button class="gd-sil" data-sil-gorsel="urun-${esc(u.id)}" aria-label="${L('Fotoğrafı sil', 'Delete photo')}">×</button>` : `<i></i>`}<span>${esc(u.ad)}</span><input type="file" accept="image/png,image/jpeg,image/webp" data-gorsel="urun-${esc(u.id)}" hidden /></label>`).join('')}</div>` : ''}
      <small class="gd-not">${L('Görseller hemen yüklenir; kapak seçimi "İmzala ve kaydet" ile kaydolur. PNG, JPG ya da WEBP.', 'Pictures upload right away; the cover choice is saved with "Sign and save". PNG, JPG or WEBP.')}</small></div>
    <div class="gd-sag"><div class="gd-et">${L('Ziyaretçi böyle görür', 'Visitors see this')}</div><div class="gd-onizle"></div>
      <div class="gd-dug"><button class="gd-bak" data-is="ziyaretciGozu">${L('Ziyaretçi gözüyle bak', 'View as visitor')}</button><button class="gd-kaydet" data-is="vitrinKaydet">${L('İmzala ve kaydet', 'Sign and save')}</button></div></div></div></div>`;
}
// The cell's bees with names: their own .nim name or this cell's sub-name (the player's choice). Sub-names do not become cells
// on the hive map; they appear only here. Display rule: the person's own name large, the parent name small (mert · lale.garura.nim).
async function arilariYaz(isim) {
  const el = $('ariL'); if (!el) return;
  const j = await fetch(API + '/api/arilar/' + isim).then((r) => r.json()).catch(() => null);
  if (!el.isConnected || !j?.arilar) return;
  if (!j.arilar.length) { el.innerHTML = `<div class="not">${L('Henüz adı görünen arı yok.', 'No named bees yet.')}</div>`; return; }
  const adYaz = (g) => { const m = String(g).match(/^([^.]+)(\..+)$/); return m ? `<b>${esc(m[1])}</b><small>${esc(m[2])}</small>` : `<b>${esc(g)}</b>`; };
  el.innerHTML = j.arilar.map((a) => `<span class="ariAd" title="${esc(a.adres)}">${adYaz(a.gorunen)}</span>`).join('')
    + (j.toplam > j.arilar.length ? `<span class="ariAd daha">+${j.toplam - j.arilar.length}</span>` : '');
}

// Own domain: state + DNS instructions (A, and TXT for ownership). The worker updates the states every minute.
const ALAN_DURUM_YAZI = () => ({ sirada: L('sırada', 'queued'), bekliyor: L('DNS bekleniyor', 'waiting for DNS'), hazir: L('yayında', 'live'), hata: L('olmadı', 'failed'), kaldiriliyor: L('kaldırılıyor', 'removing') });
// ---- TAKE PAYMENT: one-time QR; the state comes from Hive (from the chain); the screen never decides "paid" on its own
let odemeAktif = null, odemeZaman = null;
const ODEME_DURUM = () => ({ bekliyor: L('bekliyor', 'waiting'), odendi: L('ödendi', 'paid'), suresi_doldu: L('süresi doldu', 'expired'), iptal: L('iptal', 'cancelled') });
const nimYaz = (x) => Number(x).toFixed(5).replace(/\.?0+$/, '');
function odemeBip() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.14].forEach((g, i) => { const o = a.createOscillator(), v = a.createGain(); o.frequency.value = i ? 1320 : 880; v.gain.setValueAtTime(0.2, a.currentTime + g); v.gain.exponentialRampToValueAtTime(0.001, a.currentTime + g + 0.25); o.connect(v).connect(a.destination); o.start(a.currentTime + g); o.stop(a.currentTime + g + 0.3); }); } catch {} navigator.vibrate?.([80, 60, 80]); }
function odemeBagla(p) {
  const tutar = $('odemeTutar'); if (tutar) tutar.onkeydown = (e) => { if (e.key === 'Enter') islem('odemeOlustur'); };
  if (odemeAktif?.isim === p.isim) odemeCiz(p, odemeAktif.s); else odemeAktif = null;
  odemeListeYaz(p);
}
async function odemeListeYaz(p) {
  const el = $('odemeListe'); if (!el) return;
  const r = await api('/api/kasa/' + p.isim).catch(() => null); if (!r?.ok || !el.isConnected) return;
  const { satislar } = await r.json(), D = ODEME_DURUM();
  el.innerHTML = satislar.length ? satislar.map((s) => `<div class="odemeS ${esc(s.durum)}"><b>${nimYaz(s.istenen)} NIM</b><span>${esc(s.not || '')}</span><small>${new Date(s.zaman).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small><span class="rozet">${esc(D[s.durum] || s.durum)}</span></div>`).join('')
    : `<div class="not">${L('Henüz satış yok.', 'No sales yet.')}</div>`;
}
function odemeCiz(p, s) {
  const el = $('odemeAktif'); if (!el) return;
  $('odemeGir').hidden = true; el.hidden = false;
  if (s.durum === 'odendi') {
    el.innerHTML = `<div class="odemeTamam"><div class="tik">&#10003;</div><b>${L('ÖDENDİ', 'PAID')}</b><span>${nimYaz(s.odeme?.tutar ?? s.tutar)} NIM${s.not ? ' · ' + esc(s.not) : ''}</span>
      <small>${s.odeme?.fromName ? esc(s.odeme.fromName) + '.nim' : esc(String(s.odeme?.from || '').slice(0, 9) + '…')}</small><button class="a-btn ana" data-is="odemeYeni">${L('Yeni satış', 'New sale')}</button></div>`;
  } else if (s.durum !== 'bekliyor') {
    el.innerHTML = `<div class="odemeBitti"><b>${esc(ODEME_DURUM()[s.durum] || s.durum)}</b><button class="a-btn ana" data-is="odemeYeni">${L('Yeni satış', 'New sale')}</button></div>`;
  } else {
    const q = qrcode(0, 'M'); q.addData(s.qr); q.make();
    el.innerHTML = `<div class="odemeQr">${q.createSvgTag({ cellSize: 6, margin: 3, scalable: true })}</div>
      <div class="odemeTutarB">${nimYaz(s.tutar)} <span>NIM</span></div>${s.not ? `<div class="odemeNotB">${esc(s.not)}</div>` : ''}
      <div class="odemeBek"><i></i>${L('Ödeme bekleniyor', 'Waiting for payment')} · <span id="odemeSayac"></span></div>
      <small class="not">${L('Müşteri tutarı değiştirmesin; tam bu tutar gelince tanınır.', 'The customer must not change the amount; this exact amount is how the sale is recognised.')}</small>
      <div class="iki"><button class="a-btn ikinci" data-is="odemeIptal">${L('İptal', 'Cancel')}</button></div>`;
  }
  el.querySelectorAll('[data-is]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); islem(b.dataset.is, b); }));
  clearInterval(odemeZaman);
  if (s.durum !== 'bekliyor') return;
  const sayac = () => { const k = Math.max(0, s.bitis - Date.now()), e = $('odemeSayac'); if (e) e.textContent = Math.floor(k / 60000) + ':' + String(Math.floor(k / 1000) % 60).padStart(2, '0'); };
  sayac();
  let tur = 0;
  odemeZaman = setInterval(async () => {
    if (!$('odemeAktif')?.isConnected) { clearInterval(odemeZaman); return; }   // tab changed: the state is still on the server, it continues on return
    sayac(); if (++tur % 3) return;
    const r = await api(`/api/kasa/${p.isim}/${s.id}`).catch(() => null); if (!r?.ok) return;
    const n = await r.json();
    if (n.durum !== s.durum) { odemeAktif = { isim: p.isim, s: n }; if (n.durum === 'odendi') odemeBip(); odemeCiz(p, n); odemeListeYaz(p); }
  }, 1000);
}

async function alanlariYaz(p) {
  const el = $('alanListe'); if (!el) return;
  const r = await api('/api/alan/' + p.isim).catch(() => null); if (!r || !r.ok || !el.isConnected) return;
  const j = await r.json();
  if (!j.alanlar.length) { el.innerHTML = ''; return; }
  const D = ALAN_DURUM_YAZI();
  el.innerHTML = j.alanlar.map((a) => `<div class="alanS ${esc(a.durum)}"><div class="alanUst"><b>${esc(a.alan)}</b><span class="rozet">${esc(D[a.durum] || a.durum)}</span>`
    + `${a.durum === 'hazir' ? `<a href="https://${esc(a.alan)}" target="_blank" rel="noopener">${L('Aç', 'Open')}</a>` : ''}<button data-is="alanSil" data-alan="${esc(a.alan)}">${L('Kaldır', 'Remove')}</button></div>`
    + (a.durum === 'hazir' || a.durum === 'kaldiriliyor' ? '' : `<div class="dns"><div>${L('Alan adı sağlayıcında şu iki kaydı ekle:', 'Add these two records at your domain provider:')}</div>`
      + `<code>A &nbsp; @ &nbsp; ${esc(a.kayit.A)}</code><code>TXT &nbsp; ${esc(a.kayit.TXT.ad.replace('.' + a.alan, ''))} &nbsp; ${esc(a.kayit.TXT.deger)}</code>`
      + `<small>${L('www için de A kaydı eklersen o da bağlanır. Başka yere bakan AAAA kaydı varsa sil.', 'Add an A record for www too and it gets connected. Delete any AAAA record pointing elsewhere.')}</small></div>`)
    + (a.not ? `<small class="alanNot">${esc(a.not)}</small>` : '') + `</div>`).join('');
  el.querySelectorAll('[data-is]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); islem(b.dataset.is, b); }));
}

// shrinks the image in the browser (longest edge limit) and turns it into WEBP; a file that cannot be decoded goes as is (the server checks the type)
async function gorselKucult(f, enCok) {
  try {
    const b = await createImageBitmap(f), o = Math.min(1, enCok / Math.max(b.width, b.height));
    const c = document.createElement('canvas'); c.width = Math.round(b.width * o); c.height = Math.round(b.height * o);
    c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
    const s = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.86)); return s && s.size ? s : f;
  } catch { return f; }
}
function gorunumBagla(d) {
  const el = $('gd'); let vrg = d.v.vurgu, kapak = d.v.kapak;
  const oku = () => [...el.querySelectorAll('.gd-sat')].filter((r) => r.querySelector('.gd-sw').classList.contains('acik')).map((r) => r.dataset.k);
  const ciz = () => {
    const ks = oku(), yazi = el.querySelector('.gd-yazi').value;
    el.querySelector('.gd-say').textContent = yazi.length + '/160';
    const on = el.querySelector('.gd-onizle'); on.style.setProperty('--c', VURGU[vrg][0]);
    on.innerHTML = `<i class="o-kim"><i></i><b>${esc(d.p.isim)}<em>.nim</em></b></i>${yazi ? `<i class="o-yazi">${esc(yazi)}</i>` : ''}${ks.map((k, j) => `<i class="o-${k} ${j === 0 ? 'ilk' : ''}">${KART_ADI()[k]}</i>`).join('')}`;
    if (kapak === 'gorsel' && gorsel(d.p, 'kapak')) { const s = on.querySelector('.o-site'); if (s) { s.style.backgroundImage = `url("${gorsel(d.p, 'kapak')}")`; s.classList.add('gorselli'); } }
    gorunumBagla.secim = { kartlar: ks, vurgu: vrg, tanitim: yazi.trim().slice(0, 160), kapak };
  };
  el.querySelectorAll('.gd-sw').forEach((b) => (b.onclick = () => { b.classList.toggle('acik'); ciz(); }));
  el.querySelectorAll('[data-kapak]').forEach((b) => (b.onclick = () => { if (b.dataset.kapak === 'gorsel' && !gorsel(d.p, 'kapak')) return el.querySelector('[data-gorsel="kapak"]').click(); kapak = b.dataset.kapak; el.querySelectorAll('[data-kapak]').forEach((x) => x.classList.toggle('sec', x === b)); ciz(); }));
  const silBagla = () => el.querySelectorAll('[data-sil-gorsel]').forEach((b) => (b.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();   // inside the label: do not open the file picker
    const ad = b.dataset.silGorsel; if (!confirm(ad === 'kapak' ? L('Kapak görseli silinsin mi?', 'Delete the cover picture?') : L('Fotoğraf silinsin mi?', 'Delete this photo?'))) return;
    const r = await api(`/api/medya/${d.p.isim}/${ad}`, { method: 'DELETE' });
    if (!r.ok) return bildir(r.status === 401 ? L('Oturum bitti, yeniden gir', 'Session ended, sign in again') : 'HTTP ' + r.status);
    d.medya = (d.medya || []).filter((x) => x.ad !== ad);
    const kutu = b.closest('.gd-yukle'); kutu.querySelector('img')?.replaceWith(Object.assign(document.createElement('i'))); b.remove();
    if (ad === 'kapak' && kapak === 'gorsel') { kapak = 'canli'; el.querySelectorAll('[data-kapak]').forEach((x) => x.classList.toggle('sec', x.dataset.kapak === 'canli')); }
    ciz(); bildir(ad === 'kapak' ? L('Kapak silindi; vitrin sitenin kendisini gösterecek (İmzala ve kaydet)', 'Cover deleted; your page will show the site itself (Sign and save)') : L('Fotoğraf silindi', 'Photo deleted'));
  }));
  silBagla();
  el.querySelectorAll('[data-gorsel]').forEach((inp) => (inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    const ad = inp.dataset.gorsel, kutu = inp.closest('.gd-yukle'); kutu.classList.add('yukleniyor');
    try {
      const veri = await gorselKucult(f, ad === 'kapak' ? 1600 : 800);
      const r = await api(`/api/medya/${d.p.isim}/${ad}`, { method: 'PUT', body: veri, ham: true, headers: { 'content-type': veri.type || 'application/octet-stream' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error({ en_cok_1_5mb: L('Görsel çok büyük (en çok 1,5 MB)', 'Picture too large (max 1.5 MB)'), yalniz_png_jpg_webp: L('Yalnız PNG, JPG, WEBP', 'Only PNG, JPG, WEBP'), giris_gerekli: L('Oturum bitti, yeniden gir', 'Session ended, sign in again') }[j.hata] || j.hata || 'HTTP ' + r.status);
      d.medya = (d.medya || []).filter((x) => x.ad !== ad).concat({ ad, zaman: Date.now() });
      kutu.querySelector('.gd-sil')?.remove();
      kutu.querySelector('img, i').outerHTML = `<img src="${esc(gorsel(d.p, ad))}" alt="" /><button class="gd-sil" data-sil-gorsel="${esc(ad)}" aria-label="${L('Sil', 'Delete')}">×</button>`; silBagla();
      if (ad === 'kapak' && kapak !== 'gorsel') { kapak = 'gorsel'; el.querySelectorAll('[data-kapak]').forEach((x) => x.classList.toggle('sec', x.dataset.kapak === 'gorsel')); }
      ciz(); bildir(ad === 'kapak' ? L('Kapak yüklendi; göstermek için İmzala ve kaydet', 'Cover uploaded; Sign and save to show it') : L('Ürün fotoğrafı yüklendi', 'Product photo uploaded'));
    } catch (e) { bildir(e.message); } finally { kutu.classList.remove('yukleniyor'); inp.value = ''; }
  }));
  el.querySelectorAll('.gd-ok button').forEach((b) => (b.onclick = () => {
    const r = b.closest('.gd-sat'), y = +b.dataset.y, k = y < 0 ? r.previousElementSibling : r.nextElementSibling; if (!k) return;
    const a1 = r.getBoundingClientRect().top, a2 = k.getBoundingClientRect().top; y < 0 ? k.before(r) : k.after(r);
    for (const [e, eski] of [[r, a1], [k, a2]]) { const dy = eski - e.getBoundingClientRect().top; e.animate?.([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)' }); }
    ciz();
  }));
  el.querySelectorAll('.gd-renk button').forEach((b) => (b.onclick = () => { vrg = b.dataset.v; el.querySelectorAll('.gd-renk button').forEach((x) => x.classList.toggle('sec', x === b)); ciz(); }));
  el.querySelector('.gd-yazi').oninput = ciz;
  ciz();
}

// writes by merging into signed settings (existing keys are kept)
async function ayarBirlestir(p, degisiklik) {
  const simdi = await fetch(API + '/api/ayar/' + p.isim).then((x) => x.json()), surum = (simdi.surum || 0) + 1, ayar = { ...(simdi.ayar || {}), ...degisiklik };
  const mesaj = `Hive ayarı: ${p.isim}.nim #${surum}\n` + JSON.stringify(ayar), s = await imzala(mesaj, p.ornek);
  const r = await fetch(API + '/api/ayar/' + p.isim, { method: 'PUT', body: JSON.stringify({ surum, ayar, ...s }) }); const j = await r.json();
  if (!r.ok) throw new Error(L('Reddedildi: ', 'Refused: ') + j.hata);
  return j;
}

// ---- wallet not found: two doors (Nimiq Pay on phones, Heylogram Wallet on computers). No silent waiting.
function cuzdanYok() {
  document.querySelector('.a-perde')?.remove();
  const tel = matchMedia('(max-width: 900px)').matches, p = document.createElement('div'); p.className = 'a-perde';
  p.innerHTML = `<div class="a-kapilar"><div class="a-kbas"><div><h2>${L('Bu tarayıcıda cüzdan bulamadık', 'No wallet found in this browser')}</h2><p>${L('Peteğine girmek için iki yol var. İkisinde de imza para göndermez.', 'Two ways into your cell. Neither one sends money.')}</p></div><button class="x" aria-label="${L('kapat', 'close')}">&times;</button></div>
    <div class="a-kapi"><div class="ikon">${IK.telefon}</div><div><h3>${tel ? L("Nimiq Pay'de aç", 'Open in Nimiq Pay') : L('Telefonla: Nimiq Pay', 'With your phone: Nimiq Pay')}</h3><p>${L("Nimiq Pay'in içinden hive.heylogram.com'u aç; cüzdan orada hazır, peteğine girersin.", 'Open hive.heylogram.com inside Nimiq Pay; the wallet is ready there and you are in.')}</p><div class="link">hive.heylogram.com/#n=${esc(secili?.p.isim || '')}</div><button class="a-btn ikinci" data-k="kopya">${L('Bağlantıyı kopyala', 'Copy link')}</button></div></div>
    <div class="a-kapi"><div class="ikon">${IK.eklenti}</div><div><h3>${tel ? L('Bilgisayardan girmek için: Heylogram Wallet', 'From a computer: Heylogram Wallet') : L('Bu bilgisayarda: Heylogram Wallet', 'On this computer: Heylogram Wallet')}</h3><p>${L('Chrome eklentisini kur ya da Webboos tarayıcısını kullan (cüzdan içinde hazır); sayfayı yenile, yeniden "Gir"e bas.', 'Install the Chrome extension or use the Webboos browser (wallet built in); refresh and press "Sign in" again.')}</p><a class="a-btn ikinci" href="https://chromewebstore.google.com/detail/khfghhlakeijakdnjkdicmfplhmgoedj" target="_blank" rel="noopener">${L('Eklentiyi kur', 'Install extension')}</a></div></div>
    <div class="a-knot">${L('Cüzdan birkaç saniyede cevap vermezse bu ekran açılır.', 'This screen opens when no wallet answers within a few seconds.')}</div></div>`;
  $('oda').appendChild(p);
  p.querySelector('.x').onclick = () => p.remove();
  p.onclick = (e) => { if (e.target === p) p.remove(); };
  p.querySelector('[data-k="kopya"]').onclick = async () => { const l = petekLink(secili?.p.isim || ''); bildir(await panoyaYaz(l) ? L('Bağlantı kopyalandı', 'Link copied') : l); };
}


// ---- DATABASE CONSOLE (in the room, like the Firestore console): collections | documents | field tree
// The signed external site address: written back into the box for "2 · Link" (so a reload does not lose it)
const sonKanit = new Proxy({}, { get: (o, k) => { try { return o[k] ?? localStorage.getItem('hive-kanit-' + String(k)); } catch { return o[k]; } }, set: (o, k, v) => { o[k] = v; try { localStorage.setItem('hive-kanit-' + String(k), v); } catch {} return true; } });
const konsol = { k: null, b: null };
function agac(v, ad = null, d = 0) {   // draws nested fields as a tree
  const tur = Array.isArray(v) ? 'liste' : v === null ? 'boş' : typeof v === 'object' ? 'nesne' : typeof v === 'number' ? 'sayı' : typeof v === 'boolean' ? 'açık/kapalı' : 'yazı';
  const etiket = ad == null ? '' : `<span class="aA">${esc(ad)}</span>`;
  if (v && typeof v === 'object') {
    const ic = Object.entries(v).map(([k, x]) => agac(x, Array.isArray(v) ? k : k, d + 1)).join('');
    return `<details class="aD" ${d < 2 ? 'open' : ''}><summary>${etiket}<span class="aT">${tur} · ${Object.keys(v).length}</span></summary><div class="aI">${ic}</div></details>`;
  }
  const deger = typeof v === 'string' ? `"${esc(v.length > 140 ? v.slice(0, 140) + '…' : v)}"` : esc(String(v));
  return `<div class="aS">${etiket}<span class="aV ${typeof v}">${deger}</span></div>`;
}
async function konsolCiz() {
  const el = $('konsol'); if (!el || !secili) return;
  const p = secili.p, sahip = !!OT(p.isim) || (YEREL && new URLSearchParams(location.search).get('onizle') === 'sahip');
  const oz = await fetch(API + '/api/db/' + p.isim).then((r) => r.json()).catch(() => ({ koleksiyonlar: [] }));
  if (!konsol.k && oz.koleksiyonlar[0]) konsol.k = oz.koleksiyonlar[0].ad;
  const belgeler = konsol.k ? await fetch(API + `/api/db/${p.isim}/${konsol.k}?limit=100`, { headers: { 'x-hive-oturum': OT(p.isim) } }).then((r) => (r.ok ? r.json() : [])).catch(() => []) : [];
  if (konsol.b && !belgeler.find((x) => x.id === konsol.b)) konsol.b = null;
  if (!konsol.b && belgeler[0]) konsol.b = belgeler[0].id;
  const sec = belgeler.find((x) => x.id === konsol.b);
  const kural = oz.koleksiyonlar.find((x) => x.ad === konsol.k)?.kural || { okuma: 'herkes', yazma: 'sahip' };
  el.innerHTML = `
    <div class="kBas"><span>${L('Veritabanı', 'Database')}</span><small>${oz.koleksiyonlar.length} ${L('koleksiyon', 'collections')} · ${((oz.bayt || 0) / 1024).toFixed(1)} KB / ${(oz.sinir?.bayt || 0) / 1048576} MB · ${L('bugün', 'today')} ${oz.sayac?.okuma || 0} ${L('okuma', 'reads')}, ${oz.sayac?.yazma || 0} ${L('yazma', 'writes')}</small></div>
    <div class="kUc">
      <div class="kSut"><div class="kSB">${L('Koleksiyonlar', 'Collections')}</div>
        ${oz.koleksiyonlar.map((c) => `<div class="kOg ${c.ad === konsol.k ? 'sec' : ''}" data-k="${esc(c.ad)}">${esc(c.ad)}<small>${c.belge}</small></div>`).join('') || `<div class="kBos">${L('Henüz koleksiyon yok', 'No collections yet')}</div>`}
        ${sahip ? `<div class="kYeni"><input id="kYeniAd" placeholder="${L('yeni_koleksiyon', 'new_collection')}" /></div>` : ''}</div>
      <div class="kSut"><div class="kSB">${esc(konsol.k || '–')}${konsol.k && sahip ? `<span class="kKural">${L('okuma', 'read')} <select id="kOku"><option value="herkes">${L('herkes', 'everyone')}</option><option value="sahip">${L('sahip', 'owner')}</option></select> ${L('yazma', 'write')} <select id="kYaz"><option value="sahip">${L('sahip', 'owner')}</option><option value="oyuncu">${L('oyuncu kendi belgesi', 'player\'s own doc')}</option></select></span>` : ''}</div>
        ${belgeler.map((b) => `<div class="kOg ${b.id === konsol.b ? 'sec' : ''}" data-b="${esc(b.id)}">${esc(b.id)}</div>`).join('') || `<div class="kBos">${konsol.k ? L('Belge yok', 'No documents') : ''}</div>`}</div>
      <div class="kSut genis"><div class="kSB">${esc(konsol.b || '–')}${sec && sahip ? `<span class="kSil" data-sil="${esc(sec.id)}">${L('belgeyi sil', 'delete doc')}</span>` : ''}</div>
        <div class="kAgac">${sec ? agac(sec.veri) : ''}</div>
        ${sahip && konsol.k ? `<div class="kEkle"><div class="kSB">${L('Belge ekle / güncelle', 'Add / update document')}</div>
          <input id="kBelgeId" placeholder="${L('belge kimliği (boşsa otomatik)', 'document id (auto if empty)')}" value="${esc(konsol.b || '')}" />
          <div id="kAlanlar"></div>
          <div class="kvS yeniS"><input class="hucre kod" id="kAlanAd" placeholder="${L('alan', 'field')}" /><input class="hucre" id="kAlanDeger" placeholder="${L('değer', 'value')}" /><select class="tur" id="kAlanTur"><option value="yazi">${L('yazı', 'text')}</option><option value="sayi">${L('sayı', 'number')}</option><option value="ac">${L('açık/kapalı', 'on/off')}</option><option value="liste">${L('liste (virgülle)', 'list (commas)')}</option></select><span class="ekle" id="kAlanEkle">+</span></div>
          <div class="dug" id="kKaydet">${L('Kaydet (birleştir)', 'Save (merge)')}</div></div>` : ''}
      </div>
    </div>
    ${sahip && konsol.k ? `<div class="kKurallar"><div class="kSB">${L('Alan kuralları', 'Field rules')} <small>${L('sunucuda denetlenir; tarayıcı atlatamaz', 'checked on the server; a browser cannot skip them')}</small></div>
      <div id="kkListe"></div>
      <div class="kkEk"><input id="kkAd" class="hucre kod" placeholder="${L('alan (ör. skor)', 'field (e.g. score)')}" />
        <select id="kkTur" class="tur"><option value="">${L('her tür', 'any type')}</option><option value="sayi">${L('sayı', 'number')}</option><option value="yazi">${L('yazı', 'text')}</option><option value="dogru">${L('açık/kapalı', 'on/off')}</option><option value="liste">${L('liste', 'list')}</option><option value="nesne">${L('nesne', 'object')}</option></select>
        <input id="kkMin" class="hucre" inputmode="decimal" placeholder="${L('en az', 'min')}" /><input id="kkMax" class="hucre" inputmode="decimal" placeholder="${L('en çok', 'max')}" /><input id="kkUzun" class="hucre" inputmode="numeric" placeholder="${L('en uzun', 'max length')}" />
        <label><input type="checkbox" id="kkGerekli" />${L('zorunlu', 'required')}</label><label><input type="checkbox" id="kkTamsayi" />${L('tam sayı', 'whole number')}</label><label><input type="checkbox" id="kkArtan" />${L('yalnız artar', 'only goes up')}</label><label><input type="checkbox" id="kkSabit" />${L('değişmez', 'locked')}</label>
        <div class="dug" id="kkEkle">${L('Ekle', 'Add')}</div></div>
      <div class="kkSec"><label><input type="checkbox" id="kkSadece" ${kural.sadeceTanimli ? 'checked' : ''} />${L('Yalnız bu alanlar yazılabilir', 'Only these fields can be written')}</label>
        <label>${L('Aynı belgeye en sık', 'Same document at most once every')} <input id="kkAralik" class="hucre" inputmode="numeric" value="${kural.aralik || ''}" placeholder="0" /> ${L('saniyede bir', 'seconds')}</label></div>
      <div class="dug" id="kkKaydet">${L('Kuralları kaydet', 'Save rules')}</div>
      <small class="kkNot">${L('Sahip (sen) "yalnız artar", "değişmez" ve sıklıktan muafsın; tür ve sınırlar herkese uygulanır.', 'You (the owner) are exempt from "only goes up", "locked" and the time limit; types and limits apply to everyone.')}</small></div>` : ''}`;
  el.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => { konsol.k = x.dataset.k; konsol.b = null; konsolCiz(); }));
  el.querySelectorAll('[data-b]').forEach((x) => (x.onclick = () => { konsol.b = x.dataset.b; konsolCiz(); }));
  if (!sahip) return;
  const ot = OT(p.isim), h = { 'content-type': 'application/json', 'x-hive-oturum': ot };
  const kAd = $('kYeniAd'); if (kAd) kAd.onkeydown = (e) => { if (e.key === 'Enter' && /^[a-zA-Z0-9_-]{1,64}$/.test(kAd.value.trim())) { konsol.k = kAd.value.trim(); konsol.b = null; konsolCiz(); } };
  if ($('kOku')) { $('kOku').value = kural.okuma; $('kYaz').value = kural.yazma;
    const kuralKaydet = async () => { const r = await fetch(API + `/api/db/${p.isim}/${konsol.k}/kural`, { method: 'PUT', headers: h, body: JSON.stringify({ okuma: $('kOku').value, yazma: $('kYaz').value }) }); bildir(r.ok ? L('Kural kaydedildi', 'Rule saved') : L('Kural kaydedilmedi', 'Rule not saved')); };
    $('kOku').onchange = kuralKaydet; $('kYaz').onchange = kuralKaydet; }
  // field rules: edited in the list, sent at once with "Save rules"
  if ($('kkListe')) {
    const kk = JSON.parse(JSON.stringify(kural.alanlar || {}));
    const TUR_AD = { sayi: L('sayı', 'number'), yazi: L('yazı', 'text'), dogru: L('açık/kapalı', 'on/off'), liste: L('liste', 'list'), nesne: L('nesne', 'object') };
    const ozet = (a) => [a.tur ? TUR_AD[a.tur] : L('her tür', 'any type'), a.min != null ? '≥ ' + a.min : '', a.max != null ? '≤ ' + a.max : '', a.enCok != null ? L('en uzun ', 'max length ') + a.enCok : '',
      a.gerekli ? L('zorunlu', 'required') : '', a.tamsayi ? L('tam sayı', 'whole') : '', a.artan ? L('yalnız artar', 'only up') : '', a.sabit ? L('değişmez', 'locked') : ''].filter(Boolean).join(' · ');
    const kkCiz = () => { $('kkListe').innerHTML = Object.keys(kk).length ? Object.entries(kk).map(([ad, a]) => `<div class="kAlan"><span class="hucre kod">${esc(ad)}</span><span class="hucre">${esc(ozet(a))}</span><span class="sil" data-kk="${esc(ad)}">×</span></div>`).join('') : `<div class="kBos">${L('Kural yok: her alan serbest.', 'No rules: every field is free.')}</div>`;
      $('kkListe').querySelectorAll('[data-kk]').forEach((x) => (x.onclick = () => { delete kk[x.dataset.kk]; kkCiz(); })); };
    kkCiz();
    const sayi = (id) => { const v = $(id).value.trim().replace(',', '.'); return v === '' ? undefined : Number(v); };
    $('kkEkle').onclick = () => {
      const ad = $('kkAd').value.trim(); if (!/^[a-zA-Z0-9_]{1,40}$/.test(ad)) return bildir(L('Alan adı: harf, rakam, _', 'Field name: letters, digits, _'));
      const a = { tur: $('kkTur').value || undefined, min: sayi('kkMin'), max: sayi('kkMax'), enCok: sayi('kkUzun'), gerekli: $('kkGerekli').checked || undefined, tamsayi: $('kkTamsayi').checked || undefined, artan: $('kkArtan').checked || undefined, sabit: $('kkSabit').checked || undefined };
      if ([a.min, a.max, a.enCok].some((x) => x !== undefined && !Number.isFinite(x))) return bildir(L('Sınırlar sayı olmalı', 'Limits must be numbers'));
      kk[ad] = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));
      for (const id of ['kkAd', 'kkMin', 'kkMax', 'kkUzun']) $(id).value = ''; for (const id of ['kkGerekli', 'kkTamsayi', 'kkArtan', 'kkSabit']) $(id).checked = false;
      kkCiz();
    };
    $('kkKaydet').onclick = async () => {
      const r = await fetch(API + `/api/db/${p.isim}/${konsol.k}/kural`, { method: 'PUT', headers: h, body: JSON.stringify({ alanlar: kk, sadeceTanimli: $('kkSadece').checked, aralik: Number($('kkAralik').value) || 0 }) });
      bildir(r.ok ? L('Kurallar kaydedildi', 'Rules saved') : L('Kurallar kaydedilmedi', 'Rules not saved')); if (r.ok) konsolCiz();
    };
  }
  el.querySelectorAll('[data-sil]').forEach((x) => (x.onclick = async () => { const r = await fetch(API + `/api/db/${p.isim}/${konsol.k}/${x.dataset.sil}`, { method: 'DELETE', headers: h }); bildir(r.ok ? L('Belge silindi', 'Document deleted') : 'HTTP ' + r.status); konsol.b = null; konsolCiz(); }));
  const alanlar = {};
  const alanCiz = () => { $('kAlanlar').innerHTML = Object.entries(alanlar).map(([k, v]) => `<div class="kAlan"><span class="hucre kod">${esc(k)}</span><span class="hucre">${esc(JSON.stringify(v))}</span><span class="sil" data-a="${esc(k)}">×</span></div>`).join('');
    $('kAlanlar').querySelectorAll('[data-a]').forEach((x) => (x.onclick = () => { delete alanlar[x.dataset.a]; alanCiz(); })); };
  if ($('kAlanEkle')) $('kAlanEkle').onclick = () => {
    const ad = $('kAlanAd').value.trim(), t = $('kAlanTur').value, d = $('kAlanDeger').value; if (!ad) return;
    if (t === 'sayi' && !Number.isFinite(Number(d))) return bildir(L('Değer sayı olmalı', 'Value must be a number'));
    alanlar[ad] = t === 'sayi' ? Number(d) : t === 'ac' ? /^(1|true|açık|acik|on|evet|yes)$/i.test(d) || d === '' : t === 'liste' ? d.split(',').map((x) => x.trim()).filter(Boolean) : d;
    $('kAlanAd').value = ''; $('kAlanDeger').value = ''; alanCiz(); };
  if ($('kKaydet')) $('kKaydet').onclick = async () => {
    if (!Object.keys(alanlar).length) return bildir(L('Önce alan ekle', 'Add a field first'));
    const id = $('kBelgeId').value.trim();
    const r = id ? await fetch(API + `/api/db/${p.isim}/${konsol.k}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: h, body: JSON.stringify(alanlar) })
                 : await fetch(API + `/api/db/${p.isim}/${konsol.k}`, { method: 'POST', headers: h, body: JSON.stringify(alanlar) });
    const j = await r.json().catch(() => ({})); bildir(r.ok ? L('Kaydedildi', 'Saved') : L('Olmadı: ', 'Failed: ') + j.hata);
    if (r.ok) { konsol.b = j.id || id; konsolCiz(); } };
}

async function odaAc(h, yeni = false) {
  if (odaAcik) return; odaAcik = true; secili = h; odaSekme = 'genel'; ziyaretciGozu = false; const oda = $('oda');
  const donus = temaDonus?.isim === h.p.isim ? temaDonus : null; temaDonus = null;
  if (donus) { odaSekme = donus.sekme || 'genel'; ziyaretciGozu = !!donus.gozu; }
  oda.classList.add('hazir'); history.pushState?.({ oda: h.p.isim }, '');
  await motor.dal(h, 1100, (e) => {   // the hexagon starts to open in the last third of the dive
    const k = motor.konum(h), ac = Math.max(0, (e - 0.62) / 0.38), tam = Math.hypot(innerWidth, innerHeight);
    oda.style.visibility = ac > 0 ? 'visible' : 'hidden'; oda.style.clipPath = hexClip(k.x, k.y, k.r * 0.82 + (tam - k.r * 0.82) * cikis(ac)); oda.style.opacity = Math.min(1, ac * 3);
  });
  oda.style.visibility = 'visible'; oda.style.clipPath = 'none'; oda.style.opacity = 1;
  await odaCiz(yeni);
  if (donus?.kaydir) for (const ms of [0, 400, 1200]) setTimeout(() => { const o = $('odaIc'); if (o && o.scrollTop < donus.kaydir) o.scrollTop = donus.kaydir; }, ms);   // content may load late
}
async function odaKapat(geriTusu) {
  if (!odaAcik) return; const h = secili, oda = $('oda'); cancelAnimationFrame(odaRaf);
  const bas = performance.now(), tam = Math.hypot(innerWidth, innerHeight);
  await new Promise((ok) => { const f = (z) => { const v = Math.min(1, (z - bas) / 450), k = motor.konum(h); oda.style.clipPath = hexClip(k.x, k.y, k.r * 0.82 + (tam - k.r * 0.82) * (1 - eio(v))); if (v < 1) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
  oda.style.visibility = 'hidden'; $('odaIc').innerHTML = ''; $('odaUcus').innerHTML = ''; document.querySelector('.a-perde')?.remove(); odaArilar = []; odaAcik = false; secili = null;
  await motor.cik(1000);
  if (!geriTusu) try { history.back(); } catch {}
}
addEventListener('popstate', () => {
  if (odaAcik && ziyaretciGozu) { ziyaretciGozu = false; gozOnizleme = null; return odaCiz(false); }   // the back button returns from the visitor view to the panel
  if (odaAcik) odaKapat(true);
});   // the phone's back button closes the room first
try { if (!window.HIVE_TEMA?.secim) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => location.reload()); } catch {}   // with no choice the device theme is followed

// ---- day/night button: on press a sunset or sunrise curtain comes down, the page opens with the new theme, the curtain lifts
(() => {
  $('dilDug')?.addEventListener('click', dilDegistir);
  const dug = $('temaDug'), perde = $('perde'); if (!dug || !perde) return;
  const GUNES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="#F59E0B" stroke="#D97706"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" stroke="#D97706"/></svg>';
  const AY = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" fill="#FCD34D" stroke="#F59E0B" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const gece = !!window.HIVE_TEMA?.gece;
  dug.innerHTML = gece ? GUNES : AY;                       // icon of the theme the press will switch to
  dug.title = gece ? L('Gündüze geç', 'Switch to day') : L('Geceye geç', 'Switch to night');
  const adresle = (t, gecis) => { const u = new URL(location.href); u.searchParams.set('tema', t); if (odaAcik && secili) u.hash = 'n=' + secili.p.isim; if (gecis) u.searchParams.set('gecis', '1'); else u.searchParams.delete('gecis'); return u.toString(); };
  // if opened through the switch, the curtain lifts
  if (window.HIVE_TEMA?.gecis) { perde.className = gece ? 'batim' : 'dogum'; perde.style.opacity = 1; requestAnimationFrame(() => perde.classList.add('cik')); try { history.replaceState(history.state, '', adresle(gece ? 'gece' : 'gunduz', false)); } catch {} }
  dug.onclick = () => {
    const yeni = gece ? 'gunduz' : 'gece';
    try { localStorage.setItem('hive_tema', yeni); } catch {}
    if (CERCEVE) window.parent.postMessage({ tur: 'hl-depo', islem: 'yaz', anahtar: 'tema', deger: yeni }, '*');
    if (odaAcik && secili) try { window.name = 'hive-geri:' + JSON.stringify({ isim: secili.p.isim, sekme: odaSekme, gozu: ziyaretciGozu, kaydir: $('odaIc')?.scrollTop || 0, ot: OT(secili.p.isim) ? [secili.p.isim, OT(secili.p.isim)] : null }); } catch {}
    perde.className = (yeni === 'gece' ? 'batim' : 'dogum') + ' gir';
    setTimeout(() => location.replace(adresle(yeni, true)), 760);
  };
  // inside a frame the choice is kept in the bridge: if the address does not carry it and it differs, open once with that theme
  if (CERCEVE && !new URLSearchParams(location.search).get('tema')) {
    const al = (e) => { const v = e.data; if (e.source !== window.parent || v?.tur !== 'hl-depo' || v.islem !== 'hepsi') return; removeEventListener('message', al);
      const t = v.veri?.tema; if ((t === 'gece' || t === 'gunduz') && (t === 'gece') !== gece) location.replace(adresle(t, false)); };
    addEventListener('message', al); window.parent.postMessage({ tur: 'hl-depo', islem: 'hepsi' }, '*'); setTimeout(() => removeEventListener('message', al), 4000);
  }
})();

async function panoyaYaz(metin) {
  try { await navigator.clipboard.writeText(metin); return true; } catch {}
  try { const a = document.createElement('textarea'); a.value = metin; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;top:-1000px;opacity:0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch { return false; }
}
const gorunumAnahtari = (k) => k === 'tanitim' || k.startsWith('vitrin.');
async function islem(ne, el) {
  const p = secili.p;
  if (ne === 'giris') return girisYap(p, el);
  if (ne === 'sekme') { odaSekme = el.dataset.sekme; return odaCiz(false); }
  if (ne === 'tema') return $('temaDug')?.click();
  if (ne === 'dil') return dilDegistir();
  if (ne === 'ziyaretciGozu') { gozOnizleme = $('gd') ? gorunumBagla.secim : null; ziyaretciGozu = true; history.pushState?.({ oda: p.isim, gozu: 1 }, ''); return odaCiz(false); }
  if (ne === 'sahipGozu') { if (history.state?.gozu) return history.back(); ziyaretciGozu = false; gozOnizleme = null; return odaCiz(false); }
  if (ne === 'paylas' || ne === 'linkGonder') {
    const url = petekLink(p.isim);
    try { if (navigator.share) return await navigator.share({ title: p.isim + '.nim', url }); } catch { return; }
    ne = 'linkKopya';
  }
  if (ne === 'linkKopya') { bildir(await panoyaYaz(petekLink(p.isim)) ? L('Bağlantı kopyalandı', 'Link copied') : petekLink(p.isim)); return; }
  if (ne === 'kasaGorunur' || ne === 'vitrinKaydet') {
    const v = odaDurum.v, s = ne === 'kasaGorunur'
      ? { kartlar: v.kartlar.includes('kasa') ? v.kartlar.filter((k) => k !== 'kasa') : [...v.kartlar, 'kasa'], vurgu: v.vurgu, tanitim: v.tanitim }
      : gorunumBagla.secim;
    try {
      const j = await ayarBirlestir(p, { 'vitrin.kartlar': s.kartlar.join(',') || 'yok', 'vitrin.vurgu': s.vurgu, tanitim: s.tanitim, 'vitrin.kapak': s.kapak || v.kapak || 'canli' });
      bildir(ne === 'kasaGorunur' ? (s.kartlar.includes('kasa') ? L('Kasan artık vitrinde görünüyor', 'Your vault now shows on your page') : L('Kasan artık yalnız sana görünür', 'Your vault is now visible only to you')) : L('Görünümün kaydedildi, sürüm #', 'Your page is saved, version #') + j.surum);
    } catch (e) { bildir(e.message); }
    return odaCiz(false);
  }
  if (ne === 'odaKapat') { if (ziyaretciGozu) return islem('sahipGozu'); return odaKapat(); }
  if (ne === 'cikis') { otYaz(p.isim, ''); bildir(L('Çıkış yapıldı', 'Signed out')); return odaCiz(false); }
  if (ne === 'ekle') { const k = $('yAn').value.trim(), t = $('yTu').value, v = $('yDe').value.trim();
    if (!/^[a-zA-Z0-9_.-]{1,40}$/.test(k)) return bildir(L('Anahtar: harf, rakam, _ . -', 'Key: letters, digits, _ . -'));
    if (t === 'sayi' && !Number.isFinite(Number(v))) return bildir(L('Değer sayı olmalı', 'Value must be a number'));
    odaCiz.satirEkle(k, t === 'ac' ? /^(1|true|açık|acik|on|evet|yes)$/i.test(v) || v === '' : t === 'sayi' ? Number(v) : v, t); $('yAn').value = ''; $('yDe').value = ''; return; }
  if (ne === 'kopyala') { bildir(await panoyaYaz(p.adres) ? L('Adres kopyalandı', 'Address copied') : p.adres); return; }
  const yetkiYok = async (r) => { if (r.status === 401) { otYaz(p.isim, ''); bildir(L('Oturum bitti, yeniden gir', 'Session ended, sign in again')); odaCiz(false); return true; } return false; };
  if (ne === 'bahsis') { const k = $('bahsisKutu'); if (k) k.hidden = !k.hidden; return; }
  if (ne === 'bahsisGonder') {
    // Tip: from the visitor's own wallet to the name owner's address, note "bahsis". Hive holds nothing.
    const nim = Number(el?.dataset?.nim); if (!(nim > 0)) return;
    const c = await cuzdan(); if (!c?.sendBasicTransactionWithData) return bildir(L('Cüzdan yok: Nimiq Pay ya da Heylogram Wallet ile aç', 'No wallet: open in Nimiq Pay or with Heylogram Wallet'));
    try {
      const r = await c.sendBasicTransactionWithData({ recipient: p.adres, value: Math.round(nim * 1e5), fee: 0, data: 'bahsis ' + p.isim + '.nim' });
      if (r?.error) throw new Error(r.error.message || 'reddedildi');
      bildir(L('Teşekkürler! Bahşiş gönderildi: ', 'Thank you! Tip sent: ') + nim + ' NIM'); $('bahsisKutu').hidden = true;
    } catch (e) { bildir(L('Gönderilmedi: ', 'Not sent: ') + e.message); }
    return;
  }
  if (ne === 'odemeOlustur') {
    const tutar = Number(String($('odemeTutar')?.value || '').replace(',', '.'));
    if (!(tutar > 0)) { $('odemeTutar')?.focus(); return bildir(L('Tutar yaz', 'Enter an amount')); }
    const r = await api('/api/kasa/' + p.isim, { method: 'POST', body: JSON.stringify({ tutar, not: $('odemeNot')?.value || '' }) }); if (await yetkiYok(r)) return;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return bildir({ tutar_gecersiz: L('Tutar geçersiz', 'Invalid amount'), cok_acik_satis: L('Çok fazla açık satış; bazılarını iptal et', 'Too many open sales; cancel some'), zincir_okunamadi: L('Zincire ulaşılamadı, tekrar dene', 'Could not reach the chain, try again') }[j.hata] || L('Olmadı: ', 'Failed: ') + (j.hata || r.status));
    odemeAktif = { isim: p.isim, s: j }; odemeCiz(p, j); return odemeListeYaz(p);
  }
  if (ne === 'odemeIptal') {
    const s = odemeAktif?.s; if (!s) return;
    await api(`/api/kasa/${p.isim}/${s.id}`, { method: 'DELETE' }).catch(() => null);
    odemeAktif = null; clearInterval(odemeZaman); return odaCiz(false);
  }
  if (ne === 'kartYazdir') {
    // printable "pay me by name" sheet: only this sheet is printed (body.yazdir in index.html)
    const p = secili.p, q = qrcode(0, 'M'); q.addData('nimiq:' + p.adres.replace(/\s/g, '')); q.make();
    const k = document.createElement('div'); k.id = 'yaziKart';
    k.innerHTML = `<div class="yk-kagit"><div class="yk-idn">${idSvg.get(p.adres) || ''}</div>
      <div class="yk-ad">${esc(p.isim)}<em>.nim</em></div><div class="yk-alt">${L('Bana isimle öde', 'Pay me by name')}</div>
      <div class="yk-qr">${q.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div>
      <div class="yk-not">${L('Nimiq Pay ile okut, tutarı yaz, onayla.', 'Scan with Nimiq Pay, type the amount, approve.')}</div>
      <div class="yk-adres">${esc(p.adres)}</div><div class="yk-site">hive.heylogram.com</div></div>
      <div class="yk-dug"><button class="a-btn ana" id="ykYaz">${L('Yazdır', 'Print')}</button><button class="a-btn ikinci" id="ykKapa">${L('Kapat', 'Close')}</button></div>`;
    document.body.append(k); document.body.classList.add('yazdir');
    const kapa = () => { k.remove(); document.body.classList.remove('yazdir'); };
    $('ykKapa').onclick = kapa; $('ykYaz').onclick = () => { try { window.print(); } catch {} };
    return;
  }
  if (ne === 'odemeYeni') { odemeAktif = null; clearInterval(odemeZaman); await odaCiz(false); $('odemeTutar')?.focus(); return; }
  if (ne === 'alanEkle') {
    const alan = ($('alanGir')?.value || '').trim(); if (!alan) return;
    const r = await api('/api/alan/' + p.isim, { method: 'POST', body: JSON.stringify({ alan }) }); if (await yetkiYok(r)) return;
    const j = await r.json().catch(() => ({}));
    const HATA = { alan_adi_gecersiz: L('Alan adı geçersiz', 'Invalid domain'), bu_alan_adi_baglanamaz: L('Bu alan adı bağlanamaz', 'This domain cannot be connected'), baska_isme_bagli: L('Bu alan adı başka bir isme bağlı', 'This domain belongs to another name'), en_cok_3_alan_adi: L('Bir isme en çok 3 alan adı', 'At most 3 domains per name'), bir_saat_sonra_yeniden_dene: L('Bir saat sonra yeniden dene', 'Try again in an hour') };
    bildir(r.ok ? L('Eklendi. Aşağıdaki DNS kayıtlarını gir; Hive dakikada bir kontrol eder.', 'Added. Enter the DNS records below; Hive checks every minute.') : (HATA[j.hata] || L('Olmadı: ', 'Failed: ') + (j.hata || r.status)));
    if (r.ok) $('alanGir').value = '';
    return alanlariYaz(p);
  }
  if (ne === 'alanSil') {
    const alan = el?.dataset?.alan; if (!alan || !confirm(alan + L(' bağlantısı kaldırılsın mı?', ' — remove this domain?'))) return;
    const r = await api('/api/alan/' + p.isim + '/' + encodeURIComponent(alan), { method: 'DELETE' }); if (await yetkiYok(r)) return;
    bildir(L('Kaldırılıyor; bir dakika içinde biter.', 'Removing; done within a minute.')); return alanlariYaz(p);
  }
  if (ne === 'zip') {
    const f = secilenZip?.isim === p.isim ? secilenZip.dosya : null; if (!f) return bildir(L('Önce .zip dosyasını seç', 'Choose a .zip file first'));
    if (zipYukleniyor) return;
    // fetch gives no upload progress; XMLHttpRequest is used to show a percentage
    zipYukleniyor = true;
    const cubuk = (oran, yazi) => { const el = $('zipIlerleme'); if (!el) return; el.hidden = false; el.querySelector('i').style.width = Math.round(oran * 100) + '%'; el.querySelector('span').textContent = yazi; };
    cubuk(0, L('Yükleniyor… %0', 'Uploading… 0%'));
    const sonuc = await new Promise((ok) => {
      const x = new XMLHttpRequest();
      x.open('PUT', API + '/api/yukle/' + p.isim); x.setRequestHeader('x-hive-oturum', OT(p.isim));
      x.upload.onprogress = (e) => { if (e.lengthComputable) cubuk(e.loaded / e.total, L('Yükleniyor… %', 'Uploading… ') + Math.round(e.loaded / e.total * 100) + (dil === 'en' ? '%' : '')); };
      x.upload.onload = () => cubuk(1, L('Yüklendi, açılıyor…', 'Uploaded, unpacking…'));
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} ok({ status: x.status, ok: x.status >= 200 && x.status < 300, j }); };
      x.onerror = () => ok({ status: 0, ok: false, j: { hata: L('bağlantı koptu', 'connection lost') } });
      x.onabort = x.ontimeout = () => ok({ status: 0, ok: false, j: { hata: L('yükleme durdu', 'upload stopped') } });
      x.timeout = 10 * 60 * 1000;
      x.send(f);
    });
    zipYukleniyor = false;
    if (sonuc.status === 401) { otYaz(p.isim, ''); bildir(L('Oturum bitti, yeniden gir', 'Session ended, sign in again')); return odaCiz(false); }
    if (sonuc.ok) secilenZip = null;
    bildir(sonuc.ok ? p.isim + L('.nim yayında: petek bal ile doluyor', '.nim is live: the cell fills with honey') : L('Olmadı: ', 'Failed: ') + (sonuc.j.hata || sonuc.status));
    if (!sonuc.ok) { cubuk(0, L('Olmadı: ', 'Failed: ') + (sonuc.j.hata || sonuc.status)); return; }
    await yukle(); return odaCiz(false);
  }
  if (ne === 'deploy') {
    const r = await api('/api/deploy/' + p.isim, { method: 'POST', body: JSON.stringify({ repo: $('repo').value.trim(), api: $('api').value.trim() || undefined }) });
    if (await yetkiYok(r)) return; if (!r.ok) { bildir(L('Başlamadı: ', 'Not started: ') + ((await r.json()).hata || r.status)); return; }
    bildir(L('Derleme başladı', 'Build started')); const isim = p.isim;
    const iz = setInterval(async () => {
      const d = await fetch(API + '/api/deploy/' + isim).then((x) => x.json());
      const el = $('dgun'); if (el && secili?.p.isim === isim) { el.innerHTML = d.gunluk.slice(-14).map(esc).join('<br>'); el.scrollTop = 1e6; }
      if (d.durum === 'yayinda' || d.durum === 'hata') { clearInterval(iz); bildir(d.durum === 'yayinda' ? isim + L('.nim yayında', '.nim is live') : L('Derleme hatası', 'Build error')); await yukle(); if (odaAcik && secili?.p.isim === isim) odaCiz(false); }
    }, 1200);
    return;
  }
  if (ne === 'kanit') {
    const url = $('disUrl').value.trim().replace(/\/+$/, ''); if (!/^https?:\/\//.test(url)) return bildir(L('Önce sitenin adresini yaz', 'Enter your site address first'));
    try {
      const mesaj = `Hive sitesi: ${p.isim}.nim = ${url}`, s = await imzala(mesaj, p.ornek); sonKanit[p.isim] = url;
      // One line = bee counter + signature (same format as kanitSatiri on the server). The line goes to the clipboard; if the clipboard is blocked (frame) it stays selected in the box.
      const satir = `<script src="${API || location.origin}/ari.js" data-isim="${p.isim}" data-imza="${s.publicKey}.${s.signature}" defer></script>`;
      $('kanit').innerHTML = `<div class="not">${L('Satır kopyalandı. Sitenin sayfasında <b>&lt;/body&gt;</b> etiketinden hemen önce yapıştır, siteyi yayınla, sonra 2 · Siteyi bağla.', 'Line copied. Paste it right before <b>&lt;/body&gt;</b> in your site page, publish, then press 2 · Link.')}</div>
        <textarea class="giris-kutu kanitMetin" id="kanitMetin" readonly rows="3" spellcheck="false">${esc(satir)}</textarea>
        <div class="dug ikinci" id="kanitKopya">${L('Satırı yeniden kopyala', 'Copy the line again')}</div>`;
      const kutu = $('kanitMetin'); kutu.onclick = () => kutu.select();
      const kopyala = async () => { if (await panoyaYaz(satir)) return bildir(L('Kopyalandı', 'Copied')); kutu.focus(); kutu.select(); bildir(L('Satır seçildi: Ctrl+C ile kopyala', 'Line selected: press Ctrl+C to copy')); };
      $('kanitKopya').onclick = kopyala; kopyala();
    } catch (e) { bildir(e.message); }
    return;
  }
  if (ne === 'bagla') {
    const r = await api('/api/bagla/' + p.isim, { method: 'POST', body: JSON.stringify({ url: $('disUrl').value.trim() }) }); if (await yetkiYok(r)) return; const j = await r.json();
    bildir(r.ok ? L('Bağlandı: petek senin sitene açılıyor', 'Linked: the cell now opens your site') : j.hata === 'kanit_yok' ? L('Satır sitende bulunamadı; yayınladın mı?', 'The line was not found on your site; did you publish it?') : j.hata === 'adres_herkese_acik_https_olmali' ? L('Adres https ile başlayan, herkese açık bir site olmalı', 'Use a public https address') : j.hata === 'kanit_gecersiz' ? L('Kanıt bu ismin sahibine ait değil', 'The proof is not from this name\'s owner') : L('Olmadı: ', 'Failed: ') + j.hata);
    if (r.ok) { await yukle(); odaCiz(false); } return;
  }
  if (ne === 'ayar') {
    const ayar = {};
    for (const d of document.querySelectorAll('#kv .kvS')) { const k = d.dataset.k, t = d.dataset.t;
      if (t === 'ac') ayar[k] = !d.querySelector('.anahtar').classList.contains('kapali');
      else { const v = d.querySelector('input').value; if (t === 'sayi') { if (!Number.isFinite(Number(v))) return bildir(k + L(': sayı olmalı', ': must be a number')); ayar[k] = Number(v); } else ayar[k] = v; } }
    const simdi = await fetch(API + '/api/ayar/' + p.isim).then((x) => x.json()), surum = (simdi.surum || 0) + 1;
    for (const [k, v] of Object.entries(simdi.ayar || {})) if (gorunumAnahtari(k)) ayar[k] = v;   // Look keys not shown in the list are kept
    try {
      const mesaj = `Hive ayarı: ${p.isim}.nim #${surum}\n` + JSON.stringify(ayar), s = await imzala(mesaj, p.ornek);
      const r = await fetch(API + '/api/ayar/' + p.isim, { method: 'PUT', body: JSON.stringify({ surum, ayar, ...s }) }); const j = await r.json();
      bildir(r.ok ? L('Ayar imzalandı, sürüm #', 'Settings signed, version #') + j.surum : L('Reddedildi: ', 'Refused: ') + j.hata);
    } catch (e) { bildir(e.message); }
    return odaCiz(false);
  }
  if (ne === 'yaz') { const r = await api(`/api/depo/${p.isim}/deneme_${Date.now() % 1000}`, { method: 'PUT', body: JSON.stringify('merhaba ' + new Date().toLocaleTimeString('tr')) }); if (await yetkiYok(r)) return; bildir(r.ok ? L('Depoya yazıldı', 'Written') : L('Reddedildi: kota', 'Refused: quota')); }
  if (ne === 'sis') { const r = await api(`/api/depo/${p.isim}/buyuk`, { method: 'PUT', body: 'x'.repeat(300 * 1024) }); if (await yetkiYok(r)) return; bildir(r.status === 413 ? L('Kota korudu: 300 KB reddedildi (sınır 256 KB)', 'Quota held: 300 KB refused (limit 256 KB)') : 'HTTP ' + r.status); }
  await yukle();
}

// ---- search
$('araForm').onsubmit = async (e) => {
  e.preventDefault(); const n = $('ara').value.trim().toLowerCase().replace(/\.nim$/, ''); if (!n) return;
  const h = hucre.find((x) => x.p.isim === n); if (h) return sec(h);
  const r = await fetch(API + '/api/isim/' + encodeURIComponent(n)).then((x) => x.json()).catch(() => null);
  if (r?.free) bildir(L(`${n}.nim boşta: ${(r.price / 1e5).toLocaleString('tr')} NIM. Pigeon'da al, kovanda petek açılsın.`, `${n}.nim is free: ${(r.price / 1e5).toLocaleString('en')} NIM. Get it in Pigeon and a cell opens in the hive.`));
  else if (r?.reserved) bildir(L(`${n}.nim ayrılmış`, `${n}.nim is reserved`)); else if (r?.invalid) bildir(L('Geçersiz isim', 'Invalid name')); else bildir(L('Bulunamadı', 'Not found'));
};
$('ornekli').onchange = (e) => { ornekli = e.target.checked; kapat(); yukle.ilk = false; yukle(); };

// ---- which cell to open at start: #n=<name> in the link ("See in hive" from Pigeon), else the wallet's own cell
function hashIsim() { const m = location.hash.match(/^#(n|yeni)=([a-z0-9-]{1,32})$/); if (m) try { history.replaceState(null, '', location.pathname + location.search); } catch {} return m ? { isim: m[2], yeni: m[1] === 'yeni' } : null; }
async function benimPetegim() {
  const c = await cuzdan(2500).catch(() => null); if (!c?.listAccounts) return null;
  const hesap = await c.listAccounts().catch(() => []);
  const adresler = new Set((Array.isArray(hesap) ? hesap : []).map((a) => String(typeof a === 'string' ? a : a?.address || '').replace(/\s/g, '').toUpperCase()));
  return hucre.find((h) => adresler.has(h.p.adres.replace(/\s/g, '').toUpperCase())) || null;
}
addEventListener('hashchange', () => { const n = hashIsim(); const h = n && hucre.find((x) => x.p.isim === n.isim); if (h && !odaAcik) { duvarCiz(); odaAc(h, n.yeni); } });

sabitMetinler();
await yukle(); setInterval(yukle, 5000);
{
  const n = hashIsim(), h = n && hucre.find((x) => x.p.isim === n.isim);
  if (h && n.yeni) { motor.dogur(h.p.isim, 500); bildir(L('Pigeon\'dan isim aldın: ', 'You got a name on Pigeon: ') + h.p.isim + '.nim'); setTimeout(() => { duvarCiz(); odaAc(h, true); }, 1900); }
  else if (h) { duvarCiz(); odaAc(h); }
  else if (n) bildir(L(n.isim + '.nim kovanda yok', n.isim + '.nim is not in the hive'));
  else benimPetegim().then((b) => { if (b && !secili) { motor.sec(b); bildir(L('Senin peteğin: ', 'Your cell: ') + b.p.isim + L('.nim · içine girmek için dokun', '.nim · tap to go inside')); } });
}
