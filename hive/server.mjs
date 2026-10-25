// Hive: the hive of Nimiq names (server).
// Cells come from the LIVE registry (Pigeon /api/names). Site, visit and storage data are kept in a local file;
// in production each site gets its own JSON store.
// Quota: storage size and daily operation limit per name (like a free tier), so no single name can fill the server.
//
// Run: node server.mjs  ->  http://127.0.0.1:5197
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, renameSync, existsSync, statSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { zipAc } from './zip.mjs';
import { demoCuzdan, girisMesaji, girisYap, oturum, imzaDogrula, kompakt, ayarMesaji, oyuncuMesaji, oyuncuGiris, oyuncu, satirKaniti } from './kimlik.mjs';
import { veritabani } from './db.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';
import { lookup as dnsLookup } from 'node:dns/promises';

const KOK = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5197;
const PIGEON = process.env.PIGEON_API || 'https://signal.heylogram.tv/pigeonapi';
const DEFTER_UYGULAMA = process.env.DEFTER_UYGULAMA || 'pigeon';   // the .nim name of the app that keeps the name registry
// CANLI=1 (live): sample names, demo wallet, ?deneme and GitHub builds are OFF; only the real registry + uploading built files.
const CANLI = process.env.CANLI === '1';
const VERI_KOK = process.env.DATA_DIR || KOK;
const VERI = join(VERI_KOK, 'veri.json');
const IDENTICONS = process.env.IDENTICONS || 'C:/nim-isim/server/node_modules/@nimiq/identicons/dist/identicons.bundle.min.js';

// Quota (per name). Requests over it are rejected; an owner cannot fill the server without a paid tier.
export const KOTA = { depoBayt: 1024 * 1024, gunlukIslem: 50000, anahtarBoyu: 64 };

// --- local data: { siteler: {name: {baslik, yayin}}, ziyaret: {name: {gun, bugun, toplam}}, depo: {name: {key: value}}, islem: {name: {gun, sayi}} }
let veri = { siteler: {}, ziyaret: {}, depo: {}, islem: {}, kullanici: {} };
try { veri = { ...veri, ...JSON.parse(readFileSync(VERI, 'utf8')) }; } catch {}
let kirli = false;
setInterval(() => { if (!kirli) return; kirli = false; try { writeFileSync(VERI + '.tmp', JSON.stringify(veri)); renameSync(VERI + '.tmp', VERI); } catch {} }, 1500);
const bugun = () => new Date().toISOString().slice(0, 10);

// Sample names: so the hive does not look empty; marked as "sample" on screen. Real names always come first.
const ORNEK = CANLI ? [] : ['knock', 'garura', 'mert', 'ayse', 'kahveci', 'deniz', 'fırın', 'atolye', 'muzik', 'elif', 'kitapci', 'oyun', 'bahce', 'can', 'tamirci', 'sokak', 'pazar', 'yolcu', 'ressam']
  .map((n) => n.replace('ı', 'i'))
  .map((name, i) => ({ name, address: sahteAdres(name), height: 0, time: Date.now() - (i + 1) * 86400000 * 2, ornek: true }));
function sahteAdres(s) {           // stable, validly formatted address for sample names (only to draw an identicon)
  const A = '0123456789ABCDEFGHJKLMNPQRSTUVXY'; let h = 2166136261, out = '';
  for (let k = 0; k < 32; k++) { h ^= s.charCodeAt(k % s.length) + k; h = Math.imul(h, 16777619) >>> 0; out += A[h % 32]; }
  return 'NQ00 ' + out.match(/.{4}/g).join(' ');
}
// Some sample names have a published site and visitors (first start only).
if (!CANLI && !veri.ornekKuruldu) {
  const site = { garura: 'Garura Hive', kahveci: 'Mahalle Kahvecisi', muzik: 'Sokak Müziği', oyun: 'Arı Oyunu', atolye: 'Ahşap Atölye', pazar: 'Pazar Yeri', ressam: 'Resim Defteri' };
  for (const [n, b] of Object.entries(site)) veri.siteler[n] = { baslik: b, yayin: Date.now() - 86400000 };
  const z = { garura: 140, kahveci: 34, muzik: 61, oyun: 220, atolye: 9, pazar: 18, ressam: 3, mert: 2 };
  for (const [n, s] of Object.entries(z)) veri.ziyaret[n] = { gun: bugun(), bugun: s, toplam: s * 6 };
  veri.depo.garura = { skor_en_yuksek: '1840', sezon: 'bahar', uye_sayisi: '57' };
  veri.ornekKuruldu = true; kirli = true;
}

const DB = veritabani(VERI_KOK);
// demo wallet: owner of the sample names (local demo only)
const demo = demoCuzdan(veri.demoGizli); if (!veri.demoGizli) { veri.demoGizli = demo.gizli; kirli = true; }
veri.ayarlar ||= {};

// --- live registry
let defter = { isimler: [], zaman: 0, hata: null };
async function defterOku() {
  try {
    const r = await fetch(PIGEON + '/api/names', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    defter = { isimler: await r.json(), zaman: Date.now(), hata: null };
  } catch (e) { defter.hata = String(e.message || e); }
}
await defterOku(); setInterval(defterOku, 20000);

function ziyaretBugun(n) { const z = veri.ziyaret[n]; return z && z.gun === bugun() ? z.bugun : 0; }
function depoBayt(n) { return Buffer.byteLength(JSON.stringify(veri.depo[n] || {})); }
function islemBugun(n) { const x = veri.islem[n]; return x && x.gun === bugun() ? x.sayi : 0; }
function islemSay(n) { const x = veri.islem[n]; if (!x || x.gun !== bugun()) veri.islem[n] = { gun: bugun(), sayi: 1 }; else x.sayi++; kirli = true; }

// --- SALES: Hive only issues the bill and watches the chain; money goes from the buyer DIRECTLY to the name owner.
// Products live in the owner's SIGNED settings: key "urunler" = JSON [{ id, ad (name), fiyat (price in NIM), stok (stock) }]. An order = a payment request
// to the owner's address on Pigeon (note "ode:<id>"); when Pigeon finds the payment on chain the order becomes "odendi" (paid). Only Hive writes orders
// (not in the database), so neither a site nor a player can fake "paid". A player sees their own orders, the owner sees all.
const QR_YEREL = 'C:/nim-isim/web/node_modules/qrcode-generator/qrcode.js';
const SIPARIS_SURE = 24 * 3600 * 1000, LUNA = 100000;
function urunler(n) {
  let l = veri.ayarlar?.[n]?.ayar?.urunler;
  try { if (typeof l === 'string') l = JSON.parse(l); } catch { return []; }
  return (Array.isArray(l) ? l : []).filter((u) => u && /^[a-z0-9-]{1,32}$/.test(u.id) && Number(u.fiyat) > 0 && Number(u.fiyat) <= 1e6)
    .map((u) => ({ id: u.id, ad: String(u.ad || u.id).slice(0, 60), fiyat: Number(u.fiyat), stok: Number.isFinite(Number(u.stok)) ? Math.max(0, Math.floor(Number(u.stok))) : null }));
}
const siparisler = (n) => ((veri.siparis ||= {})[n] ||= {});
// Stock: paid + still pending orders hold a place (otherwise 200 people could pay for a stock of 1)
const ayrilan = (n, urun) => Object.values(siparisler(n)).filter((s) => s.urun === urun && (s.durum === 'odendi' || s.durum === 'bekliyor' || s.durum === 'ayriliyor')).length;
const siparisGor = (s) => ({ id: s.id, urun: s.urun, ad: s.ad, fiyat: s.value / LUNA, durum: s.durum, zaman: s.zaman, odeme: s.odeme || null, memo: s.memo, to: s.to });
const SIPARIS_SORU_ARA = 60 * 1000, SIPARIS_SAKLA = 30 * 86400 * 1000, SIPARIS_TAVAN = 1000;
let yoklaniyor = false;
async function siparisSor(s) {   // Pigeon's answer only counts if the id, recipient address and amount match the order
  const r = await fetch(PIGEON + '/api/request/' + s.id, { signal: AbortSignal.timeout(8000) }).then((x) => x.ok ? x.json() : null).catch(() => null);
  if (!r || r.id !== s.id || kompakt(r.to) !== kompakt(s.to) || Number(r.value) !== s.value) return null;
  return r;
}
async function siparisYokla() {   // runs one round at a time; asks about each pending order at most once a minute
  if (yoklaniyor) return; yoklaniyor = true;
  try {
    for (const [n, liste] of Object.entries(veri.siparis || {})) {
      for (const s of Object.values(liste)) {
        if (s.durum !== 'bekliyor' || Date.now() - (s.sorgu || 0) < SIPARIS_SORU_ARA) continue;
        s.sorgu = Date.now();
        const r = await siparisSor(s);
        if (s.durum !== 'bekliyor') continue;   // may have changed elsewhere during the await
        if (r?.status === 'paid') {
          s.durum = 'odendi';   // stock was reserved when the order was opened; a paid order is always delivered
          s.odeme = { tutar: r.paid, odemeler: (r.payments || []).slice(0, 5).map((p) => ({ hash: p.hash, from: p.from, tutar: p.value })) };
          kirli = true; continue;
        }
        // 24 hours passed: Pigeon must have been asked in this round before dropping it (no answer = keep waiting)
        if (Date.now() - s.zaman > SIPARIS_SURE && r) { s.durum = r.status === 'partial' ? 'kismi_odendi' : 'suresi_doldu'; if (r.status === 'partial') s.odeme = { tutar: r.paid }; kirli = true; }
      }
      // pruning: finished orders older than 30 days are deleted; at most 1000 records per name
      const biten = Object.values(liste).filter((s) => s.durum !== 'bekliyor');
      for (const s of biten) if (Date.now() - s.zaman > SIPARIS_SAKLA) { delete liste[s.id]; kirli = true; }
      const kalan = Object.values(liste);
      if (kalan.length > SIPARIS_TAVAN) for (const s of kalan.filter((x) => x.durum !== 'bekliyor').sort((a, b) => a.zaman - b.zaman).slice(0, kalan.length - SIPARIS_TAVAN)) { delete liste[s.id]; kirli = true; }
    }
  } finally { yoklaniyor = false; }
}
setInterval(() => siparisYokla().catch(() => {}), 20000);
const siparisHiz = new Map();   // at most 20 orders per IP per hour (makes it harder to flood the queue with free wallets)
function siparisHizAsimi(req) {
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || ''), simdi = Date.now();
  const l = (siparisHiz.get(ip) || []).filter((z) => simdi - z < 3600000); l.push(simdi); siparisHiz.set(ip, l);
  if (siparisHiz.size > 20000) siparisHiz.delete(siparisHiz.keys().next().value);
  return l.length > 20;
}

// --- TAKE PAYMENT (shop till): the owner types the amount, Hive gives a one-time QR, the customer scans it with their wallet and pays.
// Nimiq Pay drops the note from a scanned nimiq: link (source: nimiq-pay useStringParser, message: undefined). So
// the payment is recognised by its AMOUNT, not its note: every open sale has a unique amount (1-999 luna added at the end), and
// when exactly that amount reaches the owner's address after the sale opened, it becomes "paid". Wallets that keep notes may also send "kasa:<id>".
// Money goes straight to the owner; Hive only watches the chain (Pigeon /api/incoming).
const KASA_SURE = 15 * 60 * 1000, KASA_PAY = 5 * 60 * 1000, KASA_ACIK = 20, KASA_SAKLA = 30 * 86400 * 1000, KASA_TAVAN = 500;
const kasaSatislari = (n) => ((veri.kasa ||= {})[n] ||= {});
const kasaGor = (s) => ({ id: s.id, tutar: s.value / LUNA, istenen: s.istenen, not: s.not, durum: s.durum, zaman: s.zaman, bitis: s.zaman + KASA_SURE, odeme: s.odeme || null, qr: s.qr });
const nimTutar = (luna) => (luna / LUNA).toFixed(5).replace(/\.?0+$/, '');
let kasaYoklaniyor = false;
async function kasaYokla() {   // runs one round at a time; only asks about addresses that have an open sale
  if (kasaYoklaniyor) return; kasaYoklaniyor = true;
  try {
    for (const liste of Object.values(veri.kasa || {})) {
      for (const s of Object.values(liste)) if (s.durum === 'bekliyor' && Date.now() - s.zaman > KASA_SURE + KASA_PAY) { s.durum = 'suresi_doldu'; kirli = true; }
      const acik = Object.values(liste).filter((s) => s.durum === 'bekliyor').sort((a, b) => a.zaman - b.zaman);
      const adresler = [...new Set(acik.map((s) => s.to))];
      for (const to of adresler) {
        const bunlar = acik.filter((s) => s.to === to), since = Math.max(0, Math.min(...bunlar.map((s) => s.yukseklik)) - 5);
        const gelen = await fetch(`${PIGEON}/api/incoming/${encodeURIComponent(to)}?since=${since}`, { signal: AbortSignal.timeout(8000) }).then((r) => r.ok ? r.json() : null).catch(() => null);
        if (!Array.isArray(gelen)) continue;
        const kullanilan = new Set(Object.values(liste).map((s) => s.odeme?.hash).filter(Boolean));
        for (const s of bunlar) {
          if (s.durum !== 'bekliyor') continue;
          const t = gelen.find((x) => !kullanilan.has(x.hash) && (x.state === 'included' || x.state === 'confirmed') && Number(x.height) >= s.yukseklik
            && (Number(x.value) === s.value || String(x.note || '').trim().split(' ')[0] === 'kasa:' + s.id && Number(x.value) >= s.value));
          if (!t) continue;
          kullanilan.add(t.hash);
          s.durum = 'odendi'; s.odeme = { hash: t.hash, from: t.from, fromName: t.fromName || null, tutar: Number(t.value) / LUNA, zaman: Date.now() }; kirli = true;
        }
      }
      for (const s of Object.values(liste)) if (s.durum !== 'bekliyor' && Date.now() - s.zaman > KASA_SAKLA) { delete liste[s.id]; kirli = true; }
      const hepsi = Object.values(liste);
      if (hepsi.length > KASA_TAVAN) for (const s of hepsi.filter((x) => x.durum !== 'bekliyor').sort((a, b) => a.zaman - b.zaman).slice(0, hepsi.length - KASA_TAVAN)) { delete liste[s.id]; kirli = true; }
    }
  } finally { kasaYoklaniyor = false; }
}
setInterval(() => kasaYokla().catch(() => {}), 4000);

// --- BEE NAMES (general, for every cell): a bee can have two names:
//   kendi (own): the wallet's own .nim name (primary name on Pigeon, e.g. mert)
//   alt (sub):   their name under this cell (e.g. lale.garura)
// Shown: own name by default, else the sub-name, else a short address. If both exist the player chooses per cell
// (veri.adTercih[name][ADDRESS] = 'kendi' | 'alt'). Sub-names do not become cells on the hive map; they are listed only inside their own cell.
const kendiAdOnbellek = new Map(), altAdOnbellek = new Map();
async function kendiAdi(adres) {
  const a = kompakt(adres), c = kendiAdOnbellek.get(a);
  if (c && Date.now() - c.zaman < 10 * 60000) return c.ad;
  const ad = await fetch(PIGEON + '/api/address/' + a, { signal: AbortSignal.timeout(6000) }).then((r) => r.ok ? r.json() : null).then((j) => j?.name || null).catch(() => c?.ad ?? null);
  kendiAdOnbellek.set(a, { ad, zaman: Date.now() }); if (kendiAdOnbellek.size > 20000) kendiAdOnbellek.delete(kendiAdOnbellek.keys().next().value);
  return ad;
}
async function altAdlar(n) {   // [{ name: 'lale.garura', address }]
  const c = altAdOnbellek.get(n);
  if (c && Date.now() - c.zaman < 20000) return c.liste;
  const liste = await fetch(PIGEON + '/api/subs/' + n, { signal: AbortSignal.timeout(6000) }).then((r) => r.ok ? r.json() : []).catch(() => c?.liste || []);
  altAdOnbellek.set(n, { liste: Array.isArray(liste) ? liste : [], zaman: Date.now() });
  return altAdOnbellek.get(n).liste;
}
const kisaAdres = (a) => { const k = kompakt(a); return k.slice(0, 4) + '…' + k.slice(-4); };
async function ariAdi(n, adres) {
  const a = kompakt(adres);
  const [kendi, altlar] = await Promise.all([kendiAdi(a), altAdlar(n)]);
  const alt = altlar.find((x) => kompakt(x.address) === a)?.name || null;
  const tercih = veri.adTercih?.[n]?.[a] || null;
  const gorunen = (tercih === 'alt' && alt) ? alt + '.nim' : kendi ? kendi + '.nim' : alt ? alt + '.nim' : kisaAdres(a);
  return { adres: a, kendi, alt, tercih, gorunen };
}

// --- OWN DOMAIN (like Vercel): the owner enters a domain, Hive leaves a request file; a worker on the host
// gets the certificate and wires it into nginx once DNS points to us, then writes the state to alan/durum.json. The container never touches the host.
const ALAN_ISTEK = join(VERI_KOK, 'alan', 'istek'), ALAN_DURUM = join(VERI_KOK, 'alan-durum', 'durum.json');   // the state folder belongs to root (the worker writes it); Hive only reads
const ALAN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const ALAN_YASAK = ['heylogram.com', 'heylogram.tv', 'heylogram.net', 'jjvoi.com', 'contaboserver.net', 'localhost', 'nim'];
const alanYasak = (a) => ALAN_YASAK.some((s) => a === s || a.endsWith('.' + s));
const ALAN_KAYIT = { A: '109.199.123.89', AAAA: '2a02:c207:2332:1419::1' };
// Ownership: only the owner can write the domain's DNS -> TXT _hive.<domain> = hive-dogrulama=<name> (like Vercel's verification record)
const alanKayitlari = (n, alan) => ({ ...ALAN_KAYIT, TXT: { ad: '_hive.' + alan, deger: 'hive-dogrulama=' + n } });
const alanDurumu = () => { try { return JSON.parse(readFileSync(ALAN_DURUM, 'utf8')); } catch { return {}; } };
function alanIstekleri() {   // requests the worker has not processed yet
  try { return readdirSync(ALAN_ISTEK).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(readFileSync(join(ALAN_ISTEK, f), 'utf8')); } catch { return null; } }).filter(Boolean); } catch { return []; }
}
function alanIstekYaz(islem, alan, isim) {
  mkdirSync(ALAN_ISTEK, { recursive: true });
  const ad = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.json';
  writeFileSync(join(ALAN_ISTEK, ad + '.tmp'), JSON.stringify({ islem, alan, isim, zaman: Date.now() })); renameSync(join(ALAN_ISTEK, ad + '.tmp'), join(ALAN_ISTEK, ad));
}
function alanListesi(n) {
  const d = alanDurumu(), liste = Object.entries(d).filter(([, v]) => v.isim === n).map(([alan, v]) => ({ alan, durum: v.durum, not: v.not || '', adlar: v.adlar || [alan], kayit: alanKayitlari(n, alan) }));
  const istekler = alanIstekleri();
  for (const r of istekler) if (r.isim === n && r.islem === 'ekle' && !liste.some((x) => x.alan === r.alan)) liste.push({ alan: r.alan, durum: 'sirada', not: '', adlar: [r.alan], kayit: alanKayitlari(n, r.alan) });
  for (const r of istekler) if (r.isim === n && r.islem === 'sil') { const x = liste.find((y) => y.alan === r.alan); if (x) x.durum = 'kaldiriliyor'; }
  return liste;
}

// lasting users = addresses that took a sub-name under this name + distinct addresses that came in via SDK/player sign-in (each person once)
function kullaniciSay(n, subs) {
  const k = new Set(Object.keys(veri.kullanici?.[n] || {}).map((a) => a.replace(/\s/g, '').toUpperCase()));
  for (const a of subs || []) k.add(String(a).replace(/\s/g, '').toUpperCase());
  return k.size;
}
function petek(r) {
  const n = r.name, s = veri.siteler[n];
  return {
    isim: n, adres: r.address, sira: r.index || null, zaman: r.time, ornek: !!r.ornek,
    site: s ? { baslik: s.baslik, yayin: s.yayin, repo: s.repo || null, adres: s.dis || (existsSync(join(SITELER, n, 'index.html')) ? (process.env.SITE_KOK || '') + '/s/' + n + '/' : null), dis: s.dis || null } : null,
    ayarSurum: veri.ayarlar?.[n]?.surum || 0,
    ziyaret: { bugun: ziyaretBugun(n), toplam: veri.ziyaret[n]?.toplam || 0 },
    // lasting users: distinct addresses that signed in to the app; the users of the registry app (Pigeon) are the name owners
    kullanici: n === DEFTER_UYGULAMA ? defter.isimler.length : kullaniciSay(n, r.subs),
    kota: { depo: depoBayt(n), depoSinir: KOTA.depoBayt, islem: islemBugun(n), islemSinir: KOTA.gunlukIslem },
    db: (({ koleksiyonlar, bayt, sayac }) => ({ koleksiyon: koleksiyonlar.length, bayt, ...sayac }))(DB.ozet(n)),
  };
}

const gercekAdlar = () => new Set(defter.isimler.map((r) => r.name));
function kovan(ornekli, deneme = 0) {
  const gercek = defter.isimler.map(petek);
  // ?deneme=N: temporary fake names to see how the hive grows with N names (not saved)
  const sahte = Array.from({ length: CANLI ? 0 : Math.min(2000, deneme) }, (_, i) => petek({ name: 'deneme' + (i + 1), address: sahteAdres('d' + i), time: 0, ornek: true }))
    .map((p, i) => ({ ...p, site: i % 3 === 0 ? { baslik: 'deneme', yayin: 0 } : null, ziyaret: { bugun: (i * 37) % 23, toplam: 0 } }));
  const ad = gercekAdlar();
  const ornek = ornekli ? ORNEK.filter((o) => !ad.has(o.name)).map(petek) : [];
  return { canli: CANLI, petekler: [...gercek, ...ornek, ...sahte], gercek: gercek.length, defterZamani: defter.zaman, defterHata: defter.hata, kota: KOTA };
}

const tip = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
function gonder(res, kod, govde, t = 'application/json') {
  res.writeHead(kod, { 'content-type': t, 'cache-control': 'no-store' });
  res.end(typeof govde === 'string' || Buffer.isBuffer(govde) ? govde : JSON.stringify(govde));
}
async function govdeOku(req, sinir) {
  let b = ''; for await (const c of req) { b += c; if (b.length > sinir) throw Object.assign(new Error('buyuk'), { kod: 413 }); }
  return b;
}
const isimGecerli = (n) => /^[a-z0-9-]{1,32}$/.test(n);
const bilinen = (n) => gercekAdlar().has(n) || ORNEK.some((o) => o.name === n);
const ornekMi = (n) => !gercekAdlar().has(n) && ORNEK.some((o) => o.name === n);
// name owner: the on-chain address for a real name, the demo wallet for a sample name
const sahipAdresi = (n) => gercekAdlar().has(n) ? defter.isimler.find((r) => r.name === n).address : ornekMi(n) ? demo.adres : null;
const yetkili = (req, n) => oturum(req.headers['x-hive-oturum'], n);
const izinVer = (res) => { res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'content-type'); };


// ---- DEPLOY: static site from a GitHub repo. Download (tarball) -> install deps (install scripts OFF) -> build -> siteler/<name>.
// Server code is never run; only the built static files are served. In production this step should run in an offline, limited container.
const SITELER = join(VERI_KOK, 'siteler'), DERLE = join(VERI_KOK, 'derle');
// IMAGES (shop window): cover + product photos. Only the owner uploads; the file type is read from the content (first bytes), not the extension.
// No code runs when serving: fixed content type, nosniff, CSP default-src 'none'.
const MEDYA = join(VERI_KOK, 'medya'), MEDYA_AD = /^(kapak|urun-[a-z0-9-]{1,32})$/, MEDYA_BAYT = 1536 * 1024, MEDYA_TAVAN = 40;
const MEDYA_TUR = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
function medyaTuru(b) {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
function medyaListe(n) {
  const k = join(MEDYA, n); if (!existsSync(k)) return [];
  return readdirSync(k).map((d) => { const [ad, uz] = d.split('.'); return MEDYA_AD.test(ad) && MEDYA_TUR[uz] ? { ad, tur: uz, zaman: Math.round(statSync(join(k, d)).mtimeMs), bayt: statSync(join(k, d)).size } : null; }).filter(Boolean);
}
const isler = {};                       // name -> { durum, gunluk[] }
function calistir(komut, argv, cwd, env, gunluk, sure = 600000) {
  return new Promise((ok, red) => {
    const c = spawn(komut, argv, { cwd, env: { ...process.env, ...env }, shell: process.platform === 'win32' });
    const yaz = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) gunluk.push(l.slice(0, 200)); if (gunluk.length > 400) gunluk.splice(0, gunluk.length - 400); };
    c.stdout.on('data', yaz); c.stderr.on('data', yaz);
    const z = setTimeout(() => { c.kill(); red(new Error('zaman aşımı')); }, sure);
    c.on('close', (k) => { clearTimeout(z); k === 0 ? ok() : red(new Error(komut + ' çıkış ' + k)); });
  });
}
async function deployEt(n, repo, api) {
  const is = isler[n] = { durum: 'basladi', gunluk: [], bas: Date.now() }; const g = is.gunluk;
  try {
    const m = String(repo).match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/); if (!m) throw new Error('yalnız https://github.com/kullanici/depo');
    const hedef = join(DERLE, n + '-' + Date.now()); mkdirSync(hedef, { recursive: true });
    is.durum = 'indiriliyor'; g.push('İndiriliyor: ' + m[1] + '/' + m[2]);
    const r = await fetch(`https://codeload.github.com/${m[1]}/${m[2]}/tar.gz/HEAD`); if (!r.ok) throw new Error('indirilemedi ' + r.status);
    writeFileSync(join(hedef, '_kaynak.tgz'), Buffer.from(await r.arrayBuffer()));
    await calistir('tar', ['-xzf', '_kaynak.tgz', '--strip-components=1'], hedef, {}, g);
    const pk = JSON.parse(readFileSync(join(hedef, 'package.json'), 'utf8'));
    const vite = !!(pk.devDependencies?.vite || pk.dependencies?.vite);
    if (!vite) throw new Error('Şimdilik yalnız Vite ile derlenen statik siteler: bu depoda sunucu kodu var ya da derleyici tanınmadı');
    is.durum = 'kuruluyor'; g.push('Bağımlılıklar kuruluyor (kurulum betikleri kapalı)');
    await calistir('npm', [existsSync(join(hedef, 'package-lock.json')) ? 'ci' : 'install', '--ignore-scripts', '--no-audit', '--no-fund'], hedef, {}, g);
    is.durum = 'derleniyor'; g.push('Derleniyor');
    await calistir('npx', ['vite', 'build', `--base=/s/${n}/`, '--outDir', 'hive_cikti'], hedef, api ? { VITE_RELAY_URL: `/s/${n}/api` } : {}, g);
    const yer = join(SITELER, n); rmSync(yer, { recursive: true, force: true }); cpSync(join(hedef, 'hive_cikti'), yer, { recursive: true });
    const baslik = (readFileSync(join(yer, 'index.html'), 'utf8').match(/<title>([^<]{1,60})<\/title>/i) || [])[1] || n + '.nim';
    veri.siteler[n] = { baslik, yayin: Date.now(), repo, api: api || null }; kirli = true;
    is.durum = 'yayinda'; g.push('Yayında: /s/' + n + '/  (' + Math.round((Date.now() - is.bas) / 1000) + ' sn)');
  } catch (e) { is.durum = 'hata'; g.push('HATA: ' + (e.message || e)); }
}
const TIPLER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
  '.htm': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.avif': 'image/avif',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };
// An uploaded site runs in its own sandbox: its origin is not ours (no cookies, storage or same-origin requests) and the browser does not sniff types
// Bee counter: the same address counts for the same name once a day (cannot be inflated by reloading)
const sayilan = new Set(); let sayGun = '';
function ilkZiyaret(req, n) { const g = bugun(); if (g !== sayGun) { sayilan.clear(); sayGun = g; } if (sayilan.size > 300000) return false;
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || ''), k = n + '|' + ip; if (sayilan.has(k)) return false; sayilan.add(k); return true; }
// External site to link: https and public addresses only (so our server does not probe its own internal network)
// The signed line (or hive.json) on the site proves the owner of <n>.nim links it to <url>; the signature is the proof, not who asks
async function kanitDogrula(n, url) {
  // Proof file: first /.well-known/hive.json; /hive.json for hosts that do not serve dot folders; heylogram.com code sites serve files under /api/d/<name>/
  const kod = url.match(/^https:\/\/([a-z0-9-]+)\.heylogram\.com$/);
  const adaylar = [url + '/.well-known/hive.json', url + '/hive.json', ...(kod ? [url + '/api/d/' + kod[1] + '/hive.json'] : [])];
  const beklenen = `Hive sitesi: ${n}.nim = ${url}`;
  // The page itself first: if the bee-counter line carries the signature, one paste is enough (on code sites the page is under /api/d/<name>/)
  let j = null;
  for (const a of [url + '/', ...(kod ? [url + '/api/d/' + kod[1], url + '/api/d/' + kod[1] + '/'] : [])]) {   // a code-site page is served without the trailing / (with / it returns 308)
    const html = await fetch(a, { signal: AbortSignal.timeout(8000), redirect: 'error' }).then((r) => r.ok ? r.text() : '').catch(() => '');
    const k = satirKaniti(html.slice(0, 3 * 1024 * 1024), n); if (k) { j = { mesaj: beklenen, ...k }; break; }
  }
  if (!j) for (const a of adaylar) { j = await fetch(a, { signal: AbortSignal.timeout(8000), redirect: 'error' }).then((r) => r.ok ? r.json() : null).catch(() => null); if (j?.mesaj) break; j = null; }
  if (!j) return { hata: 'kanit_yok', beklenen };
  const imzalayan = j.mesaj === beklenen ? imzaDogrula(j.mesaj, j.publicKey, j.signature) : null;
  if (!imzalayan || imzalayan !== kompakt(sahipAdresi(n))) return { hata: 'kanit_gecersiz', beklenen };
  return { ok: true };
}
function siteBagla(n, url) {
  veri.siteler[n] = { ...(veri.siteler[n] || {}), baslik: veri.siteler[n]?.baslik || n + '.nim', yayin: Date.now(), dis: url }; kirli = true;
  rmSync(join(SITELER, n), { recursive: true, force: true });
}
// Linking without the "Link" button: the first visit to a page that carries the signed line links it (a coding agent can do the
// whole job once the owner has signed). Only when the cell has no site or another external site, never over an uploaded one;
// one check per name and origin every 30 minutes, so visits cannot be used to make the server fetch pages again and again.
const otoDenenen = new Map();
async function otoBagla(n, koken) {
  if (!/^https:\/\/[\w.-]+$/.test(koken || '')) return;
  const s = veri.siteler[n];
  if (s?.dis === koken || (s && !s.dis)) return;
  const k = n + '|' + koken, t = Date.now();
  if (t - (otoDenenen.get(k) || 0) < 30 * 60e3) return;
  if (otoDenenen.size > 5000) otoDenenen.clear();
  otoDenenen.set(k, t);
  if (!(await disAdresGuvenli(koken))) return;
  if ((await kanitDogrula(n, koken)).ok) siteBagla(n, koken);
}
async function disAdresGuvenli(url) {
  let u; try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.port && u.port !== '443' || !/\.[a-z]{2,}$/i.test(u.hostname) || /^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) return false;
  const adresler = await dnsLookup(u.hostname, { all: true }).catch(() => []);
  return adresler.length > 0 && adresler.every(({ address: a }) => !/^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|::$|f[cd]|fe80|::ffff:(10|127|192\.168|172\.(1[6-9]|2\d|3[01]))\.)/i.test(a));
}
const KUTU = { 'content-security-policy': 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads', 'x-content-type-options': 'nosniff' };
async function siteSun(req, res, n, yol) {
  const site = veri.siteler[n];
  // the site's own external API (proxy): only to the single address the owner set, passed through the same origin
  if (yol.startsWith('api/') || yol === 'api') {
    if (!site?.api) return gonder(res, 404, { hata: 'api yok' });
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.from(await govdeOku(req, 1024 * 1024));
    const r = await fetch(site.api + '/' + yol.slice(4) + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
      { method: req.method, body, headers: { 'content-type': req.headers['content-type'] || 'application/json', ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}) } }).catch(() => null);
    if (!r) return gonder(res, 502, { hata: 'api ulaşılamadı' });
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  const kok = join(SITELER, n); let dosya = normalize(join(kok, yol || 'index.html'));
  if (!dosya.startsWith(kok)) return gonder(res, 403, { hata: 'yasak' });
  if (!existsSync(dosya) || statSync(dosya).isDirectory()) dosya = join(kok, 'index.html');      // single-page app
  if (!existsSync(dosya)) return gonder(res, 404, { hata: 'site yok' });
  if (dosya.endsWith('index.html') && ilkZiyaret(req, n)) { const z = veri.ziyaret[n]; if (!z || z.gun !== bugun()) veri.ziyaret[n] = { gun: bugun(), bugun: 1, toplam: (z?.toplam || 0) + 1 }; else { z.bugun++; z.toplam++; } kirli = true; }
  const tur = TIPLER[extname(dosya).toLowerCase()]; if (!tur) return gonder(res, 404, { hata: 'dosya_turu_yok' });
  res.writeHead(200, { 'content-type': tur, 'cache-control': 'no-cache', ...KUTU }); res.end(readFileSync(dosya));
}

// per-IP per-minute counter (nginx sets X-Real-IP itself); the map is reset every minute
const HIZ = { kod: 30, imza: 20 }, hizSayac = new Map();
setInterval(() => hizSayac.clear(), 60000).unref();
function hizAsimi(req, tur) {
  const k = tur + '|' + String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  const n = (hizSayac.get(k) || 0) + 1; if (hizSayac.size < 200000) hizSayac.set(k, n);
  return n > HIZ[tur];
}
const sunucu = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let p = u.pathname; let m;
  if (p.startsWith('/kovanapi/')) p = p.slice(9);                         // when it arrives with the nginx prefix
  if (p.startsWith('/api/') || p === '/ari.js') {
    res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'content-type, x-hive-oturum, x-hive-oyuncu'); res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  // rate limit on sign-in endpoints: requesting a code and sending a signature (so the code map cannot be filled to evict real users' codes, and fake users cannot be flooded in)
  if (/^\/api\/(oyuncu\/)?giris(\/|$)/.test(p) && hizAsimi(req, p.endsWith('/giris') && req.method === 'POST' ? 'imza' : 'kod')) return gonder(res, 429, { hata: 'yavas' });
  try {
    if (p === '/healthz') return gonder(res, 200, { ok: true, canli: CANLI, isim: defter.isimler.length, hata: defter.hata });
    if (p === '/' || p === '/index.html') return gonder(res, 200, readFileSync(join(KOK, 'index.html')), tip['.html']);
    if (p === '/identicons.js') return gonder(res, 200, readFileSync(IDENTICONS), tip['.js']);
    if (p === '/qrcode.js' && existsSync(QR_YEREL)) return gonder(res, 200, 'const m={exports:{}};(function(module,exports){' + readFileSync(QR_YEREL, 'utf8') + '})(m,m.exports);export default m.exports;', tip['.js']);   // local development only (the live bundle carries the QR library inside)
    if (p === '/paket') return gonder(res, 200, readFileSync(join(KOK, 'dist', 'index.html')), tip['.html']);   // for trying the single-file bundle locally
    if (p === '/uygulama.js') return gonder(res, 200, readFileSync(join(KOK, 'uygulama.js')), tip['.js']);
    if (p === '/motor.js') return gonder(res, 200, readFileSync(join(KOK, 'motor.js')), tip['.js']);
    if (p === '/pixi.mjs') { res.writeHead(200, { 'content-type': tip['.js'], 'cache-control': 'max-age=86400' }); return res.end(readFileSync(join(KOK, 'vendor', 'pixi.mjs'))); }
    if (p === '/api/hive') return gonder(res, 200, kovan(u.searchParams.get('ornek') !== '0', Number(u.searchParams.get('deneme')) || 0));
    if ((m = p.match(/^\/s\/([a-z0-9-]{1,32})(?:\/(.*))?$/))) return siteSun(req, res, m[1], decodeURIComponent(m[2] || ''));
    // shop-window images: /m/<name>/<file>  (public)
    if ((m = p.match(/^\/m\/([a-z0-9-]{1,32})\/([a-z0-9-]{1,40})$/)) && req.method === 'GET') {
      const g = medyaListe(m[1]).find((x) => x.ad === m[2]); if (!g) return gonder(res, 404, { hata: 'yok' });
      res.writeHead(200, { 'content-type': MEDYA_TUR[g.tur], 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'", 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' });
      return res.end(readFileSync(join(MEDYA, m[1], m[2] + '.' + g.tur)));
    }


    // --- DATABASE (Firestore-like): /api/db/<name>[/<collection>[/<document>]]
    if ((m = p.match(/^\/api\/oyuncu\/giris\/([a-z0-9-]{1,32})$/))) { const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' }); return gonder(res, 200, { mesaj: oyuncuMesaji(n) }); }
    if (p === '/api/oyuncu/giris' && req.method === 'POST') { const b = JSON.parse(await govdeOku(req, 4000) || '{}'); const r = oyuncuGiris(b.mesaj, b.publicKey, b.signature);
      // every distinct address that signs in is a lasting user of that app (a lasting bee in the hive); the first sign-in time is kept
      if (!r.hata) { const k = ((veri.kullanici ||= {})[r.isim] ||= {}); if (!k[r.adres] && Object.keys(k).length < 100000) { k[r.adres] = Date.now(); kirli = true; } }
      return gonder(res, r.hata ? 403 : 200, r); }
    // Bee name: GET /api/ad/<name>/<address> public · PUT /api/ad/<name> {tercih:'kendi'|'alt'} only a signed-in player, for themselves
    if ((m = p.match(/^\/api\/ad\/([a-z0-9-]{1,32})\/([0-9A-Za-z %]{36,80})$/)) && req.method === 'GET') {
      if (!bilinen(m[1])) return gonder(res, 404, { hata: 'isim yok' });
      let a = ''; try { a = kompakt(decodeURIComponent(m[2])); } catch {}
      if (!/^NQ[0-9]{2}[0-9A-HJ-NP-VXY]{32}$/.test(a)) return gonder(res, 400, { hata: 'adres_gecersiz' });
      return gonder(res, 200, await ariAdi(m[1], a));
    }
    if ((m = p.match(/^\/api\/ad\/([a-z0-9-]{1,32})$/)) && req.method === 'PUT') {
      const n = m[1], kim = oyuncu(req.headers['x-hive-oyuncu'], n); if (!kim) return gonder(res, 401, { hata: 'oyuncu_girisi_gerekli' });
      const tercih = JSON.parse(await govdeOku(req, 500) || '{}').tercih;
      if (!['kendi', 'alt'].includes(tercih)) return gonder(res, 400, { hata: 'tercih_kendi_ya_da_alt' });
      const t = ((veri.adTercih ||= {})[n] ||= {}); if (Object.keys(t).length < 100000) { t[kompakt(kim)] = tercih; kirli = true; }
      return gonder(res, 200, await ariAdi(n, kim));
    }
    // Sales: GET /api/urunler/<name> public · POST /api/siparis/<name> {urun} signed-in player · GET /api/siparis/<name> a player gets their own, the owner gets all
    if ((m = p.match(/^\/api\/urunler\/([a-z0-9-]{1,32})$/)) && req.method === 'GET') {
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      return gonder(res, 200, { urunler: ornekMi(n) ? [] : urunler(n).map((u) => ({ ...u, kalan: u.stok == null ? null : Math.max(0, u.stok - ayrilan(n, u.id)) })), satici: sahipAdresi(n) });
    }
    if ((m = p.match(/^\/api\/siparis\/([a-z0-9-]{1,32})$/))) {
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      const sahip = yetkili(req, n), alici = oyuncu(req.headers['x-hive-oyuncu'], n);
      if (req.method === 'GET') {
        if (!sahip && !alici) return gonder(res, 401, { hata: 'giris_gerekli' });
        const simdiki = kompakt(sahipAdresi(n));   // if the name changed hands, the new owner does not see the old owner's buyers
        const l = Object.values(siparisler(n)).filter((s) => sahip ? kompakt(s.to) === simdiki : kompakt(s.alici) === kompakt(alici)).sort((a, b) => b.zaman - a.zaman).slice(0, 200);
        return gonder(res, 200, { siparisler: l.map((s) => ({ ...siparisGor(s), ...(sahip ? { alici: s.alici } : {}) })) });
      }
      if (req.method === 'POST') {
        if (!alici) return gonder(res, 401, { hata: 'oyuncu_girisi_gerekli' });
        if (ornekMi(n)) return gonder(res, 409, { hata: 'ornek_isimde_satis_yok' });   // sample names are owned by Hive's demo wallet: money must not come to us
        if (siparisHizAsimi(req)) return gonder(res, 429, { hata: 'yavas' });
        const istenen = String(JSON.parse(await govdeOku(req, 500) || '{}').urun || '');
        const urun = urunler(n).find((u) => u.id === istenen);
        if (!urun) return gonder(res, 404, { hata: 'urun_yok' });
        if (urun.stok != null && ayrilan(n, urun.id) >= urun.stok) return gonder(res, 409, { hata: 'stok_bitti' });
        const liste = Object.values(siparisler(n));
        if (liste.filter((s) => s.durum === 'bekliyor' && kompakt(s.alici) === kompakt(alici)).length >= 3) return gonder(res, 429, { hata: 'bekleyen_siparis_cok' });
        if (liste.filter((s) => s.durum === 'bekliyor' || s.durum === 'ayriliyor').length >= 50) return gonder(res, 429, { hata: 'yogun' });
        const satici = sahipAdresi(n); if (!satici) return gonder(res, 409, { hata: 'satici_yok' });
        // the slot is reserved BEFORE the fetch: concurrent requests cannot exceed the limits
        const gecici = 'ayir-' + randomBytes(6).toString('hex');
        siparisler(n)[gecici] = { id: gecici, urun: urun.id, alici: kompakt(alici), durum: 'ayriliyor', zaman: Date.now() };
        const r = await fetch(PIGEON + '/api/request', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ to: satici, value: Math.round(urun.fiyat * LUNA), note: (n + ' ' + urun.id).slice(0, 50) }) }).then((x) => x.ok ? x.json() : null).catch(() => null);
        delete siparisler(n)[gecici];
        if (!r?.id || !/^[0-9a-f]{8}$/.test(r.id) || kompakt(r.to) !== kompakt(satici) || Number(r.value) !== Math.round(urun.fiyat * LUNA) || siparisler(n)[r.id]) return gonder(res, 502, { hata: 'odeme_istegi_acilamadi' });
        siparisler(n)[r.id] = { id: r.id, urun: urun.id, ad: urun.ad, alici: kompakt(alici), value: r.value, to: r.to, memo: r.memo, durum: 'bekliyor', zaman: Date.now() };
        kirli = true;
        return gonder(res, 201, siparisGor(siparisler(n)[r.id]));
      }
    }
    // Own domain: GET list + DNS instructions · POST {alan} link · DELETE /<domain> remove (name owner only)
    if ((m = p.match(/^\/api\/alan\/([a-z0-9-]{1,32})(?:\/([a-z0-9.-]{4,253}))?$/))) {
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      if (!yetkili(req, n)) return gonder(res, 401, { hata: 'giris_gerekli' });
      if (req.method === 'GET' && !m[2]) return gonder(res, 200, { alanlar: alanListesi(n), kayit: ALAN_KAYIT });
      if (req.method === 'POST' && !m[2]) {
        const alan = String(JSON.parse(await govdeOku(req, 600) || '{}').alan || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
        if (!ALAN_RE.test(alan)) return gonder(res, 400, { hata: 'alan_adi_gecersiz' });
        if (alanYasak(alan)) return gonder(res, 400, { hata: 'bu_alan_adi_baglanamaz' });
        const tum = alanDurumu(), d = tum[alan];
        if (d && d.isim !== n && d.durum !== 'hata') return gonder(res, 409, { hata: 'baska_isme_bagli' });
        if (Object.entries(tum).some(([k, v]) => k !== alan && v.durum === 'hazir' && (v.adlar || []).includes(alan))) return gonder(res, 409, { hata: 'baska_isme_bagli' });
        if (d && d.isim === n && d.durum === 'hata' && Date.now() / 1000 - (d.son || 0) < 3600) return gonder(res, 429, { hata: 'bir_saat_sonra_yeniden_dene' });   // Let's Encrypt rate limit
        if (alanIstekleri().some((r) => r.alan === alan && r.isim !== n && r.islem === 'ekle')) return gonder(res, 409, { hata: 'baska_isme_bagli' });
        if (alanListesi(n).filter((x) => x.alan !== alan).length >= 3) return gonder(res, 400, { hata: 'en_cok_3_alan_adi' });
        alanIstekYaz('ekle', alan, n);
        return gonder(res, 202, { ok: true, alanlar: alanListesi(n), kayit: ALAN_KAYIT });
      }
      if (req.method === 'DELETE' && m[2]) { alanIstekYaz('sil', m[2], n); return gonder(res, 202, { ok: true, alanlar: alanListesi(n) }); }
      return gonder(res, 405, { hata: 'yontem' });
    }
    // The cell's bees (with names): signed-in users + those who took this cell's sub-name, at most 100, first come first
    // Take payment: name owner only (must be signed in to Hive on the till device)
    if ((m = p.match(/^\/api\/kasa\/([a-z0-9-]{1,32})(?:\/([0-9a-f]{8}))?$/))) {
      const [, n, id] = m; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      if (!yetkili(req, n)) return gonder(res, 401, { hata: 'giris_gerekli' });
      const liste = kasaSatislari(n);
      if (req.method === 'GET' && id) { kasaYokla().catch(() => {}); return liste[id] ? gonder(res, 200, kasaGor(liste[id])) : gonder(res, 404, { hata: 'satis_yok' }); }
      if (req.method === 'GET') return gonder(res, 200, { satislar: Object.values(liste).sort((a, b) => b.zaman - a.zaman).slice(0, 30).map(kasaGor) });
      if (req.method === 'DELETE' && id) { const s = liste[id]; if (!s) return gonder(res, 404, { hata: 'satis_yok' }); if (s.durum === 'bekliyor') { s.durum = 'iptal'; kirli = true; } return gonder(res, 200, kasaGor(s)); }
      if (req.method === 'POST' && !id) {
        if (ornekMi(n)) return gonder(res, 409, { hata: 'ornek_isimde_satis_yok' });
        const b = JSON.parse(await govdeOku(req, 2000) || '{}'), istenen = Number(b.tutar);
        if (!(istenen > 0 && istenen <= 1000000)) return gonder(res, 400, { hata: 'tutar_gecersiz' });
        const to = sahipAdresi(n); if (!to) return gonder(res, 409, { hata: 'satici_yok' });
        const acik = Object.values(liste).filter((s) => s.durum === 'bekliyor');
        if (acik.length >= KASA_ACIK) return gonder(res, 429, { hata: 'cok_acik_satis' });
        const head = await fetch(PIGEON + '/api/registry', { signal: AbortSignal.timeout(8000) }).then((r) => r.ok ? r.json() : null).then((j) => Number(j?.head) || 0).catch(() => 0);
        if (!head) return gonder(res, 502, { hata: 'zincir_okunamadi' });
        // unique amount: must not clash with another open sale to the same address (from any name)
        const dolu = new Set(Object.values(veri.kasa || {}).flatMap((l) => Object.values(l)).filter((s) => s.durum === 'bekliyor' && kompakt(s.to) === kompakt(to)).map((s) => s.value));
        const taban = Math.round(istenen * LUNA); let value = 0;
        for (let i = 0; i < 50 && !value; i++) { const v = taban + 1 + Math.floor(Math.random() * 999); if (!dolu.has(v)) value = v; }
        if (!value) return gonder(res, 429, { hata: 'cok_acik_satis' });
        const sid = randomBytes(4).toString('hex'), not = String(b.not || '').replace(/[\u0000-\u001f]/g, '').slice(0, 40);
        let mesaj = `kasa:${sid} ${n}.nim`; while (Buffer.byteLength(mesaj) > 64) mesaj = mesaj.slice(0, -1);
        const qr = `nimiq:${kompakt(to)}?amount=${nimTutar(value)}&message=${encodeURIComponent(mesaj)}&label=${encodeURIComponent(n + '.nim')}`;
        const s = { id: sid, to: kompakt(to), value, istenen, not, zaman: Date.now(), yukseklik: head, durum: 'bekliyor', qr };
        liste[sid] = s; kirli = true;
        return gonder(res, 201, kasaGor(s));
      }
      return gonder(res, 405, { hata: 'yontem' });
    }
    // image list is public; upload/delete owner only
    if ((m = p.match(/^\/api\/medya\/([a-z0-9-]{1,32})(?:\/([a-z0-9-]{1,40}))?$/))) {
      const [, n, ad] = m; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      if (req.method === 'GET' && !ad) return gonder(res, 200, { gorseller: medyaListe(n).map(({ ad, zaman, bayt }) => ({ ad, zaman, bayt })) });
      if (!yetkili(req, n)) return gonder(res, 401, { hata: 'giris_gerekli' });
      if (!ad || !MEDYA_AD.test(ad)) return gonder(res, 400, { hata: 'ad_gecersiz' });
      const k = join(MEDYA, n), eskiler = () => medyaListe(n).filter((x) => x.ad === ad).forEach((x) => rmSync(join(k, x.ad + '.' + x.tur), { force: true }));
      if (req.method === 'DELETE') { eskiler(); return gonder(res, 200, { ok: true }); }
      if (req.method !== 'PUT') return gonder(res, 405, { hata: 'yontem' });
      const parca = []; let boy = 0;
      for await (const c of req) { boy += c.length; if (boy > MEDYA_BAYT) return gonder(res, 413, { hata: 'en_cok_1_5mb' }); parca.push(c); }
      const b = Buffer.concat(parca), tur = medyaTuru(b); if (!tur) return gonder(res, 400, { hata: 'yalniz_png_jpg_webp' });
      const liste = medyaListe(n); if (!liste.some((x) => x.ad === ad) && liste.length >= MEDYA_TAVAN) return gonder(res, 413, { hata: 'en_cok_40_gorsel' });
      mkdirSync(k, { recursive: true }); eskiler(); writeFileSync(join(k, ad + '.' + tur), b);
      return gonder(res, 200, { ok: true, ad, adres: '/m/' + n + '/' + ad + '?v=' + Date.now() });
    }
    if ((m = p.match(/^\/api\/arilar\/([a-z0-9-]{1,32})$/)) && req.method === 'GET') {
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      const zaman = new Map(Object.entries(veri.kullanici?.[n] || {}).map(([a, z]) => [kompakt(a), z]));
      for (const s of await altAdlar(n)) { const a = kompakt(s.address); if (!zaman.has(a)) zaman.set(a, s.time || 0); }
      const sirali = [...zaman.entries()].sort((x, y) => x[1] - y[1]).slice(0, 100);
      const arilar = [];
      for (let i = 0; i < sirali.length; i += 5) arilar.push(...await Promise.all(sirali.slice(i, i + 5).map(([a]) => ariAdi(n, a))));   // at most 5 concurrent requests to Pigeon
      // no full address in the public list: who uses this app is not exposed at address level
      return gonder(res, 200, { toplam: zaman.size, arilar: arilar.map((x) => ({ ...x, adres: kisaAdres(x.adres) })) });
    }
    if ((m = p.match(/^\/api\/db\/([a-z0-9-]{1,32})(?:\/([a-zA-Z0-9_-]{1,64}))?(?:\/([A-Za-z0-9_-]{1,64}))?(\/kural)?$/))) {
      let [, n, k, id, kuralYolu] = m; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      if (id === 'kural' && !kuralYolu) { id = undefined; kuralYolu = '/kural'; }   // 'kural' is a reserved document name: the collection's rules
      const kim = { sahip: yetkili(req, n), oyuncu: oyuncu(req.headers['x-hive-oyuncu'], n) };
      try {
        if (!k) return gonder(res, 200, DB.ozet(n));
        if (kuralYolu) { if (req.method !== 'PUT') return gonder(res, 200, DB.kural(n, k)); if (!kim.sahip) return gonder(res, 401, { hata: 'giris_gerekli' }); return gonder(res, 200, DB.kuralYaz(n, k, JSON.parse(await govdeOku(req, 16000) || '{}'))); }
        if (req.method === 'GET') {
          if (!DB.okumaIzni(n, k, kim)) return gonder(res, 403, { hata: 'okuma_izni_yok' });
          if (!DB.say(n, 'okuma')) return gonder(res, 429, { hata: 'gunluk_okuma_siniri', sinir: DB.SINIR.gunlukOkuma });
          if (id) { const b = DB.belge(n, k, id); return b == null ? gonder(res, 404, { hata: 'belge_yok' }) : gonder(res, 200, { id, veri: b }); }
          const where = u.searchParams.getAll('where').map((w) => { const [alan, op, ...d] = w.split(','); let deger = d.join(','); try { deger = JSON.parse(deger); } catch {} return [alan, op, deger]; });
          return gonder(res, 200, DB.sorgu(n, k, { where, orderBy: u.searchParams.get('orderBy') || undefined, yon: u.searchParams.get('yon') || 'asc', limit: u.searchParams.get('limit') }));
        }
        const belgeId = req.method === 'POST' ? null : id;
        if (req.method !== 'POST' && !belgeId) return gonder(res, 400, { hata: 'belge_kimligi_gerekli' });
        if (req.method === 'POST' && !kim.sahip && DB.kural(n, k).yazma === 'oyuncu') return gonder(res, 403, { hata: 'oyuncu_kendi_adresine_yazar' });
        if (belgeId && !DB.yazmaIzni(n, k, belgeId, kim)) return gonder(res, kim.sahip || kim.oyuncu ? 403 : 401, { hata: 'yazma_izni_yok' });
        if (req.method === 'POST' && !kim.sahip) return gonder(res, 401, { hata: 'giris_gerekli' });
        if (!DB.say(n, 'yazma')) return gonder(res, 429, { hata: 'gunluk_yazma_siniri', sinir: DB.SINIR.gunlukYazma });
        if (req.method === 'DELETE') { DB.sil(n, k, belgeId); return gonder(res, 200, { ok: true }); }
        const veri = JSON.parse(await govdeOku(req, DB.SINIR.belgeBayt + 1000) || 'null');
        if (req.method === 'POST') return gonder(res, 200, DB.ekle(n, k, veri, { sahip: kim.sahip }));
        return gonder(res, 200, { id: belgeId, veri: DB.yaz(n, k, belgeId, veri, { birlestir: req.method === 'PATCH', sahip: kim.sahip }) });
      } catch (e) { return gonder(res, e.kod || 400, { hata: String(e.message) }); }
    }
    // --- sign-in: message to sign -> signature -> session
    if ((m = p.match(/^\/api\/giris\/([a-z0-9-]{1,32})$/))) {
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      return gonder(res, 200, { mesaj: girisMesaji(n), sahip: sahipAdresi(n), ornek: ornekMi(n) });
    }
    if (p === '/api/giris' && req.method === 'POST') {
      const b = JSON.parse(await govdeOku(req, 4000) || '{}');
      const r = girisYap(b.mesaj, b.publicKey, b.signature, sahipAdresi);
      return gonder(res, r.hata ? 403 : 200, r);
    }
    // the demo wallet signs only for SAMPLE names (to try without Nimiq Pay)
    if (p === '/api/demo-imza' && CANLI) return gonder(res, 404, { hata: 'yok' });
    if (p === '/api/demo-imza' && req.method === 'POST') {
      const b = JSON.parse(await govdeOku(req, 4000) || '{}'); const n = (String(b.mesaj).match(/^Hive (?:girişi|ayarı|sitesi): ([a-z0-9-]{1,32})\.nim/) || [])[1];
      if (!n || !ornekMi(n)) return gonder(res, 403, { hata: 'demo cüzdanı yalnız örnek isimler için' });
      return gonder(res, 200, demo.imzala(String(b.mesaj)));
    }

    // --- signed settings: anyone reads and verifies; they change only with the owner's signature and a higher version
    if ((m = p.match(/^\/api\/ayar\/([a-z0-9-]{1,32})$/))) {
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' }); izinVer(res);
      if (req.method === 'GET') return gonder(res, 200, veri.ayarlar[n] || { isim: n, surum: 0, ayar: {} });
      if (req.method === 'PUT') {
        const b = JSON.parse(await govdeOku(req, 16000) || '{}'), eski = veri.ayarlar[n]?.surum || 0, surum = Number(b.surum);
        if (!(surum > eski)) return gonder(res, 409, { hata: 'surum_eski', simdiki: eski });
        const imzalayan = imzaDogrula(ayarMesaji(n, surum, b.ayar), b.publicKey, b.signature);
        if (!imzalayan || imzalayan !== kompakt(sahipAdresi(n))) return gonder(res, 403, { hata: 'imza_sahibin_degil' });
        veri.ayarlar[n] = { isim: n, surum, ayar: b.ayar, publicKey: b.publicKey, signature: b.signature, mesaj: ayarMesaji(n, surum, b.ayar) }; kirli = true;
        return gonder(res, 200, { ok: true, surum });
      }
    }

    // --- upload a built site: .zip (index.html at the root or in a single folder). No code is RUN on the server, files are only served.
    if ((m = p.match(/^\/api\/yukle\/([a-z0-9-]{1,32})$/)) && req.method === 'PUT') {
      const n = m[1]; if (!yetkili(req, n)) return gonder(res, 401, { hata: 'giris_gerekli' });
      const parca = []; let boy = 0;
      for await (const c of req) { boy += c.length; if (boy > 20 * 1024 * 1024) return gonder(res, 413, { hata: 'en_cok_20mb' }); parca.push(c); }
      let dosyalar; try { dosyalar = zipAc(Buffer.concat(parca)); } catch (e) { return gonder(res, 400, { hata: String(e.message) }); }
      if (!dosyalar.some((f) => f.ad === 'index.html')) return gonder(res, 400, { hata: 'index_html_yok' });
      // Site files only: programs/installers/archives (exe, apk, msi, bat, zip ...) are not distributed from our address
      const yasak = dosyalar.filter((f) => !f.ad.endsWith('/') && !TIPLER[extname(f.ad).toLowerCase()]).map((f) => f.ad);
      if (yasak.length) return gonder(res, 400, { hata: 'dosya_turu_yasak', dosyalar: yasak.slice(0, 10) });
      if (dosyalar.some((f) => !normalize(join(SITELER, 'x', f.ad)).startsWith(join(SITELER, 'x') + sep))) return gonder(res, 400, { hata: 'guvensiz_yol' });
      const gecici = join(SITELER, '.' + n + '-' + Date.now()), yer = join(SITELER, n);
      for (const f of dosyalar) { const hedef = normalize(join(gecici, f.ad)); if (!hedef.startsWith(gecici)) return gonder(res, 400, { hata: 'guvensiz_yol' }); mkdirSync(dirname(hedef), { recursive: true }); writeFileSync(hedef, f.icerik); }
      rmSync(yer, { recursive: true, force: true }); renameSync(gecici, yer);
      const baslik = (readFileSync(join(yer, 'index.html'), 'utf8').match(/<title>([^<]{1,60})<\/title>/i) || [])[1] || n + '.nim';
      veri.siteler[n] = { ...(veri.siteler[n] || {}), baslik, yayin: Date.now(), dis: null, repo: null }; kirli = true;
      return gonder(res, 200, { ok: true, dosya: dosyalar.length, baslik });
    }
    // --- link a site on its own server: the signed bee-counter line on the page (or the older way: hive.json) must carry the owner's signature
    if ((m = p.match(/^\/api\/bagla\/([a-z0-9-]{1,32})$/)) && req.method === 'POST') {
      const n = m[1]; if (!yetkili(req, n)) return gonder(res, 401, { hata: 'giris_gerekli' });
      const b = JSON.parse(await govdeOku(req, 2000) || '{}'), url = String(b.url || '').replace(/\/+$/, '');
      if (!/^https?:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/.test(url)) return gonder(res, 400, { hata: 'adres_gecersiz' });
      if (!(await disAdresGuvenli(url))) return gonder(res, 400, { hata: 'adres_herkese_acik_https_olmali' });
      const k = await kanitDogrula(n, url);
      if (k.hata === 'kanit_yok') return gonder(res, 400, { hata: 'kanit_yok' });
      if (k.hata) return gonder(res, 403, { hata: 'kanit_gecersiz', beklenen: k.beklenen });
      siteBagla(n, url);
      return gonder(res, 200, { ok: true, dis: url });
    }
    // bee counter for external sites: <script src=".../ari.js" data-isim="knock"></script>
    if (p === '/nim.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'max-age=300' }); return res.end(readFileSync(join(KOK, 'nim.js'))); }
    // guide for developers and coding tools (llms.txt format): same address as the SDK
    if (p === '/llms.txt' || p === '/llms-full.txt') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'max-age=300' }); return res.end(readFileSync(join(KOK, p.slice(1)))); }
    if (p === '/hive-db.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'max-age=300' }); return res.end(readFileSync(join(KOK, 'hive-db.js'))); }
    if (p === '/ari.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'max-age=300' });
      return res.end(`(function(){var s=document.currentScript,n=s&&s.dataset.isim;if(!n)return;var k='hive-ari-'+n+'-'+new Date().toISOString().slice(0,10);try{if(localStorage.getItem(k))return;localStorage.setItem(k,'1')}catch(e){}fetch(${JSON.stringify(process.env.API_KOK || 'http://127.0.0.1:' + PORT)}+'/api/ziyaret/'+n,{method:'POST',mode:'cors'}).catch(function(){})})();`);
    }
    if ((m = p.match(/^\/api\/deploy\/([a-z0-9-]{1,32})$/))) {
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      if (req.method === 'GET') return gonder(res, 200, isler[n] || { durum: 'yok', gunluk: [] });
      if (req.method === 'POST') {
        if (CANLI) return gonder(res, 403, { hata: 'github_derleme_yakinda' });
        if (!yetkili(req, n)) return gonder(res, 401, { hata: 'giris_gerekli' });
        if (isler[n] && !['yayinda', 'hata'].includes(isler[n].durum)) return gonder(res, 409, { hata: 'zaten derleniyor' });
        const b = JSON.parse(await govdeOku(req, 2000) || '{}');
        if (b.api && !/^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(b.api)) return gonder(res, 400, { hata: 'api adresi https olmalı' });
        deployEt(n, b.repo, b.api); return gonder(res, 202, { ok: true });
      }
    }

    // visit: each time a name's site is opened the bee count goes up
    if ((m = p.match(/^\/api\/ziyaret\/([a-z0-9-]{1,32})$/)) && (req.method === 'POST' || req.method === 'OPTIONS')) {
      izinVer(res); if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      otoBagla(n, String(req.headers.origin || '')).catch(() => {});
      if (!ilkZiyaret(req, n)) return gonder(res, 200, { bugun: ziyaretBugun(n) });
      const z = veri.ziyaret[n]; if (!z || z.gun !== bugun()) veri.ziyaret[n] = { gun: bugun(), bugun: 1, toplam: (z?.toplam || 0) + 1 }; else { z.bugun++; z.toplam++; }
      kirli = true; return gonder(res, 200, { bugun: veri.ziyaret[n].bugun });
    }
    // publish a site (demo): the cell fills with honey
    if ((m = p.match(/^\/api\/site\/([a-z0-9-]{1,32})$/)) && req.method === 'POST') {
      const n = m[1]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' }); if (!yetkili(req, n)) return gonder(res, 401, { hata: 'giris_gerekli' });
      const b = JSON.parse(await govdeOku(req, 2000) || '{}');
      veri.siteler[n] = { ...(veri.siteler[n] || {}), baslik: String(b.baslik || n + '.nim').slice(0, 60), yayin: Date.now() }; kirli = true;
      return gonder(res, 200, { ok: true });
    }
    // storage: key-value per name, with QUOTA
    if ((m = p.match(/^\/api\/depo\/([a-z0-9-]{1,32})(?:\/([a-z0-9_.-]{1,64}))?$/))) {
      const n = m[1], k = m[2]; if (!bilinen(n)) return gonder(res, 404, { hata: 'isim yok' });
      if (islemBugun(n) >= KOTA.gunlukIslem) return gonder(res, 429, { hata: 'gunluk_kota', sinir: KOTA.gunlukIslem });
      islemSay(n);
      if (req.method === 'GET') return gonder(res, 200, k ? { [k]: veri.depo[n]?.[k] ?? null } : (veri.depo[n] || {}));
      if ((req.method === 'PUT' || req.method === 'DELETE') && !yetkili(req, n)) return gonder(res, 401, { hata: 'giris_gerekli' });
      if (req.method === 'PUT' && k) {
        const deger = await govdeOku(req, KOTA.depoBayt);
        const yeni = { ...(veri.depo[n] || {}), [k]: deger };
        if (Buffer.byteLength(JSON.stringify(yeni)) > KOTA.depoBayt) return gonder(res, 413, { hata: 'depo_kota', sinir: KOTA.depoBayt });
        veri.depo[n] = yeni; kirli = true; return gonder(res, 200, { ok: true, bayt: depoBayt(n) });
      }
      if (req.method === 'DELETE' && k) { if (veri.depo[n]) delete veri.depo[n][k]; kirli = true; return gonder(res, 200, { ok: true }); }
      return gonder(res, 405, { hata: 'yontem' });
    }
    if ((m = p.match(/^\/api\/isim\/([a-z0-9-]{1,32})$/))) {
      const n = m[1]; if (!isimGecerli(n)) return gonder(res, 400, { hata: 'gecersiz' });
      const r = await fetch(PIGEON + '/api/name/' + n, { signal: AbortSignal.timeout(8000) }).then((x) => x.json()).catch(() => null);
      return gonder(res, 200, r || { hata: 'defter' });
    }
    gonder(res, 404, { hata: 'yok' });
  } catch (e) { gonder(res, e.kod || 500, { hata: String(e.message || e) }); }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  sunucu.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`Hive: http://127.0.0.1:${PORT}  (defter: ${defter.isimler.length} gerçek isim${defter.hata ? ', HATA ' + defter.hata : ''})`));
}
export { sunucu, kovan };
