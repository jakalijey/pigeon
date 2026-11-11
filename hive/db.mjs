// Hive database: Firestore-like structure per name -> collection -> document -> nested fields (object, list, number, text, boolean).
// Query: where (==, !=, <, <=, >, >=, contains), orderBy, limit. Rules per collection:
//   read: 'herkes' (anyone) | 'sahip' (owner)      write: 'sahip' | 'oyuncu' (player; a player only writes the document whose id = their own Nimiq address)
//   fields: { skor: { tur: 'sayi', min: 0, max: 1000000, tamsayi, artan }, ad: { tur: 'yazi', enCok: 40, gerekli, sabit } }
//   sadeceTanimli (defined only): undefined fields cannot be written · aralik (interval): same document at most once every N seconds (owner exempt)
//   Checks run on the server (like Firebase security rules); the browser cannot bypass them. The owner is exempt from artan/sabit/aralik.
// Persistence: one JSON file per name (DATA_DIR/db/<name>.json), cached in memory, writes go to disk batched and atomically.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export const SINIR = { gunlukOkuma: 50000, gunlukYazma: 20000, bayt: 50 * 1024 * 1024, belgeBayt: 1024 * 1024, koleksiyon: 100, derinlik: 20 };
const AD = /^[a-zA-Z0-9_-]{1,64}$/;

export function veritabani(kok) {
  const klasor = join(kok, 'db'); mkdirSync(klasor, { recursive: true });
  const bellek = new Map(), kirli = new Set();
  const dosya = (n) => join(klasor, n + '.json');
  function al(n) {
    if (!bellek.has(n)) { let v = { k: {}, kural: {}, sayac: {} }; try { if (existsSync(dosya(n))) v = { ...v, ...JSON.parse(readFileSync(dosya(n), 'utf8')) }; } catch {} bellek.set(n, v); }
    return bellek.get(n);
  }
  setInterval(() => { for (const n of kirli) { try { writeFileSync(dosya(n) + '.tmp', JSON.stringify(bellek.get(n))); renameSync(dosya(n) + '.tmp', dosya(n)); } catch {} } kirli.clear(); }, 1000);
  const bugun = () => new Date().toISOString().slice(0, 10);
  function say(n, tur) { const v = al(n), g = bugun(); if (v.sayac.gun !== g) v.sayac = { gun: g, okuma: 0, yazma: 0 }; v.sayac[tur]++; kirli.add(n);
    return v.sayac[tur] <= (tur === 'okuma' ? SINIR.gunlukOkuma : SINIR.gunlukYazma); }
  const boyut = (n) => Buffer.byteLength(JSON.stringify(al(n).k));
  function derinlikTamam(x, d = 0) { if (d > SINIR.derinlik) return false; if (x && typeof x === 'object') return Object.values(x).every((y) => derinlikTamam(y, d + 1)); return true; }
  function alanAl(o, yol) { return String(yol).split('.').reduce((x, k) => (x == null ? undefined : x[k]), o); }
  const KARS = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b, 'icerir': (a, b) => Array.isArray(a) && a.includes(b) };
  const kural = (n, k) => ({ okuma: 'herkes', yazma: 'sahip', ...(al(n).kural[k] || {}) });
  const TURLER = ['sayi', 'yazi', 'dogru', 'liste', 'nesne'];
  const ALAN_AD = /^[a-zA-Z0-9_]{1,40}$/;
  const sayiMi = (x) => typeof x === 'number' && Number.isFinite(x);
  function alanKurali(a) {   // cleans a field rule sent by the owner: known keys only, correct types
    const o = {};
    if (TURLER.includes(a?.tur)) o.tur = a.tur;
    for (const k of ['min', 'max']) if (sayiMi(a?.[k])) o[k] = a[k];
    if (Number.isInteger(a?.enCok) && a.enCok >= 0 && a.enCok <= 100000) o.enCok = a.enCok;
    for (const k of ['gerekli', 'tamsayi', 'artan', 'sabit']) if (a?.[k] === true) o[k] = true;
    return o;
  }
  const turu = (x) => Array.isArray(x) ? 'liste' : x === null ? 'bos' : typeof x === 'number' ? 'sayi' : typeof x === 'string' ? 'yazi' : typeof x === 'boolean' ? 'dogru' : 'nesne';
  function denetle(r, yeni, eski, sahip) {
    const A = r.alanlar || {};
    if (r.sadeceTanimli) for (const k of Object.keys(yeni)) if (!A[k]) throw hata(400, 'izinsiz_alan:' + k);
    for (const [ad, a] of Object.entries(A)) {
      const x = yeni[ad];
      if (x === undefined) { if (a.gerekli) throw hata(400, 'eksik_alan:' + ad); continue; }
      const t = turu(x);
      if (a.tur && a.tur !== t) throw hata(400, 'alan_turu:' + ad);
      if (t === 'sayi') {
        if (!Number.isFinite(x)) throw hata(400, 'alan_turu:' + ad);
        if (a.tamsayi && !Number.isInteger(x)) throw hata(400, 'alan_tamsayi:' + ad);
        if (a.min != null && x < a.min) throw hata(400, 'alan_kucuk:' + ad);
        if (a.max != null && x > a.max) throw hata(400, 'alan_buyuk:' + ad);
      }
      if ((t === 'yazi' || t === 'liste') && a.enCok != null && x.length > a.enCok) throw hata(400, 'alan_uzun:' + ad);
      if (!sahip && eski && eski[ad] !== undefined) {
        if (a.sabit && JSON.stringify(eski[ad]) !== JSON.stringify(x)) throw hata(400, 'alan_sabit:' + ad);
        if (a.artan && typeof eski[ad] === 'number' && typeof x === 'number' && x < eski[ad]) throw hata(400, 'alan_azalamaz:' + ad);
      }
    }
  }

  return {
    SINIR,
    ozet(n) { const v = al(n); return { koleksiyonlar: Object.entries(v.k).map(([ad, b]) => ({ ad, belge: Object.keys(b).length, kural: kural(n, ad) })), bayt: boyut(n), sinir: SINIR, sayac: v.sayac.gun === bugun() ? v.sayac : { okuma: 0, yazma: 0 } }; },
    kural, kuralYaz(n, k, yeni) { if (!AD.test(k)) throw hata(400, 'koleksiyon_adi');
      // parts not sent stay as they were (choosing read/write does not delete the field rules)
      const eski = kural(n, k), r = { okuma: eski.okuma, yazma: eski.yazma };
      if ('okuma' in yeni) r.okuma = ['herkes', 'sahip'].includes(yeni.okuma) ? yeni.okuma : 'herkes';
      if ('yazma' in yeni) r.yazma = ['sahip', 'oyuncu'].includes(yeni.yazma) ? yeni.yazma : 'sahip';
      const alanlar = 'alanlar' in yeni ? yeni.alanlar : eski.alanlar;
      if (alanlar && typeof alanlar === 'object' && !Array.isArray(alanlar)) {
        const e = Object.entries(alanlar).filter(([ad]) => ALAN_AD.test(ad)).slice(0, 40).map(([ad, a]) => [ad, alanKurali(a)]);
        if (e.length) r.alanlar = Object.fromEntries(e);
      }
      const sadece = 'sadeceTanimli' in yeni ? yeni.sadeceTanimli === true : eski.sadeceTanimli === true; if (sadece && r.alanlar) r.sadeceTanimli = true;
      const aralik = Math.round(Number('aralik' in yeni ? yeni.aralik : eski.aralik) || 0); if (aralik > 0) r.aralik = Math.min(aralik, 86400);
      al(n).kural[k] = r; kirli.add(n); return r; },
    // reader: kim = { sahip: bool, oyuncu: 'NQ..' | null }
    okumaIzni(n, k, kim) { return kural(n, k).okuma === 'herkes' || kim.sahip; },
    yazmaIzni(n, k, id, kim) { if (kim.sahip) return true; const r = kural(n, k); return r.yazma === 'oyuncu' && !!kim.oyuncu && id === kim.oyuncu; },
    say,
    belge(n, k, id) { return al(n).k[k]?.[id] ?? null; },
    sorgu(n, k, { where = [], orderBy, yon = 'asc', limit = 50 } = {}) {
      let liste = Object.entries(al(n).k[k] || {}).map(([id, veri]) => ({ id, veri }));
      for (const [alan, op, deger] of where) { const f = KARS[op]; if (!f) throw hata(400, 'operator'); liste = liste.filter((b) => f(alanAl(b.veri, alan), deger)); }
      if (orderBy) liste.sort((a, b) => { const x = alanAl(a.veri, orderBy), y = alanAl(b.veri, orderBy); return (x > y ? 1 : x < y ? -1 : 0) * (yon === 'desc' ? -1 : 1); });
      return liste.slice(0, Math.max(1, Math.min(500, Number(limit) || 50)));
    },
    yaz(n, k, id, veri, { birlestir = false, sahip = true } = {}) {
      if (!AD.test(k) || !AD.test(String(id).replace(/\s/g, ''))) throw hata(400, 'ad');
      if (veri === null || typeof veri !== 'object' || Array.isArray(veri)) throw hata(400, 'belge_nesne_olmali');
      if (!derinlikTamam(veri)) throw hata(400, 'cok_derin');
      if (Buffer.byteLength(JSON.stringify(veri)) > SINIR.belgeBayt) throw hata(413, 'belge_buyuk');
      const v = al(n); if (!v.k[k] && Object.keys(v.k).length >= SINIR.koleksiyon) throw hata(413, 'koleksiyon_sinir');
      const eski = v.k[k]?.[id]; const yeni = birlestir && eski ? derinBirlestir(eski, veri) : veri;
      const r = kural(n, k);
      denetle(r, yeni, eski, sahip);
      if (!sahip && r.aralik) {   // frequent writes to the same document: last write time is kept apart from the document
        const z = ((v.zaman ||= {})[k] ||= {}), son = z[id] || 0;
        if (Date.now() - son < r.aralik * 1000) throw hata(429, 'cok_sik_yazma');
        z[id] = Date.now();
      }
      v.k[k] ||= {}; v.k[k][id] = yeni;
      if (boyut(n) > SINIR.bayt) { if (eski === undefined) delete v.k[k][id]; else v.k[k][id] = eski; throw hata(413, 'depo_sinir'); }
      kirli.add(n); return yeni;
    },
    ekle(n, k, veri, ayar = {}) { const id = randomBytes(10).toString('base64url'); return { id, veri: this.yaz(n, k, id, veri, ayar) }; },
    sil(n, k, id) { const v = al(n); if (v.k[k]) { delete v.k[k][id]; if (!Object.keys(v.k[k]).length) delete v.k[k]; } kirli.add(n); },   // last write time is not deleted: delete+write cannot skip the interval
  };
}
function derinBirlestir(a, b) { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? derinBirlestir(a[k], v) : v; return o; }
function hata(kod, mesaj) { return Object.assign(new Error(mesaj), { kod }); }
