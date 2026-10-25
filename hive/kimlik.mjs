// Hive identity: recognises the name owner by wallet signature. No secrets: only public key + signature + registry owner are compared.
// Nimiq Pay / Nimiq Hub message signature: signed data = SHA-256("\x16Nimiq Signed Message:\n" + length + message).
// Some wallets sign the raw message; both are tried.
const N = await import(process.env.NIMIQ_CORE || 'file:///C:/nim-isim/server/node_modules/@nimiq/core/nodejs/index.mjs');
import { randomBytes } from 'node:crypto';

const enc = new TextEncoder();
const ONEK = '\x16Nimiq Signed Message:\n';
export const kompakt = (a) => String(a || '').replace(/\s/g, '').toUpperCase();
const hex = (h) => Uint8Array.from(String(h).match(/../g).map((x) => parseInt(x, 16)));

export function imzaliVeri(mesaj) {
  const m = enc.encode(mesaj), on = enc.encode(ONEK + m.length);
  const tam = new Uint8Array(on.length + m.length); tam.set(on); tam.set(m, on.length);
  return N.Hash.computeSha256(tam);
}
// Verifies a message signature; returns the signer's address (compact) if valid, else null.
export function imzaDogrula(mesaj, publicKey, signature) {
  try {
    const pub = N.PublicKey.fromHex(publicKey), sig = N.Signature.deserialize(hex(signature));
    if (pub.verify(sig, imzaliVeri(mesaj)) || pub.verify(sig, enc.encode(mesaj))) return kompakt(pub.toAddress().toUserFriendlyAddress());
  } catch {}
  return null;
}

// Demo wallet: owner of the sample names. Local demo ONLY; never used for real names.
export function demoCuzdan(kayitli) {
  const k = kayitli ? N.PrivateKey.fromHex(kayitli) : N.PrivateKey.generate(), pub = N.PublicKey.derive(k);
  return {
    gizli: k.toHex(), adres: pub.toAddress().toUserFriendlyAddress(),
    imzala(mesaj) { return { publicKey: pub.toHex(), signature: Buffer.from(N.Signature.create(k, pub, imzaliVeri(mesaj)).serialize()).toString('hex') }; },
  };
}

// Sign-in: one-time code -> signed message -> session key (24 hours)
const kodlar = new Map(), oturumlar = new Map();
export function girisMesaji(isim) {
  const kod = randomBytes(8).toString('hex'), mesaj = `Hive girişi: ${isim}.nim\nBu imza yalnız Hive panelini açar, para göndermez.\nKod: ${kod}`;
  kodlar.set(kod, { isim, mesaj, zaman: Date.now() }); if (kodlar.size > SINIR.kod) kodlar.delete(kodlar.keys().next().value);
  return mesaj;
}
export function girisYap(mesaj, publicKey, signature, sahipAdresi) {
  const kod = (String(mesaj).match(/Kod: ([0-9a-f]{16})$/) || [])[1], k = kod && kodlar.get(kod);
  if (!k || Date.now() - k.zaman > 5 * 60000) return { hata: 'kod_gecersiz' };
  kodlar.delete(kod);
  // the signed text must be EXACTLY the text the server issued: a matching code alone is not enough (no session from a text naming another name)
  if (String(mesaj) !== k.mesaj) return { hata: 'mesaj_degisik' };
  const imzalayan = imzaDogrula(mesaj, publicKey, signature);
  if (!imzalayan) return { hata: 'imza_gecersiz' };
  if (imzalayan !== kompakt(sahipAdresi(k.isim))) return { hata: 'sahip_degil', imzalayan };
  const anahtar = randomBytes(24).toString('hex'); oturumlar.set(anahtar, { isim: k.isim, bitis: Date.now() + 86400000 });
  return { anahtar, isim: k.isim };
}
export function oturum(anahtar, isim) { const o = oturumlar.get(String(anahtar || '')); return !!(o && o.isim === isim && o.bitis > Date.now()); }

// One-line proof: the bee-counter script on the site's page also carries the signature
//   <script src=".../ari.js" data-isim="pigeon" data-imza="<public key>.<signature>"></script>
// The signed text is always "Hive sitesi: <name>.nim = <address>"; the server knows the address, it is not written in the line.
export const kanitSatiri = (api, isim, publicKey, signature) => `<script src="${api}/ari.js" data-isim="${isim}" data-imza="${publicKey}.${signature}" defer></script>`;
export function satirKaniti(html, isim) {
  for (const etiket of String(html).match(/<script\b[^>]*>/gi) || []) {
    if (!/ari\.js/.test(etiket)) continue;
    const ad = (etiket.match(/data-isim\s*=\s*["']([a-z0-9-]{1,32})["']/i) || [])[1], imza = (etiket.match(/data-imza\s*=\s*["']([0-9a-f]{64})\.([0-9a-f]{128})["']/i) || []);
    if (ad === isim && imza[1]) return { publicKey: imza[1].toLowerCase(), signature: imza[2].toLowerCase() };
  }
  return null;
}

// Signed settings: the JSON { isim, surum, ayar } is signed with the owner's wallet. Wherever it is stored, an unsigned change does not pass.
export const ayarMesaji = (isim, surum, ayar) => `Hive ayarı: ${isim}.nim #${surum}\n` + JSON.stringify(ayar);

// Player sign-in: a user of an app (name.nim) signs with their own Nimiq address; they need not be an owner.
// The session is bound to that app and that address; in the database a player can only write the document whose id = their own address (by rule).
const oyuncuKod = new Map(), oyuncular = new Map();
export function oyuncuMesaji(isim) {
  const kod = randomBytes(8).toString('hex'), mesaj = `Hive oyuncu girişi: ${isim}.nim\nBu imza yalnız seni tanıtır, para göndermez.\nKod: ${kod}`;
  oyuncuKod.set(kod, { isim, mesaj, zaman: Date.now() }); if (oyuncuKod.size > SINIR.kod) oyuncuKod.delete(oyuncuKod.keys().next().value);
  return mesaj;
}
export function oyuncuGiris(mesaj, publicKey, signature) {
  const kod = (String(mesaj).match(/Kod: ([0-9a-f]{16})$/) || [])[1], k = kod && oyuncuKod.get(kod);
  if (!k || Date.now() - k.zaman > 5 * 60000) return { hata: 'kod_gecersiz' };
  oyuncuKod.delete(kod);
  if (String(mesaj) !== k.mesaj) return { hata: 'mesaj_degisik' };
  const adres = imzaDogrula(mesaj, publicKey, signature); if (!adres) return { hata: 'imza_gecersiz' };
  const anahtar = randomBytes(24).toString('hex'); oyuncular.set(anahtar, { isim: k.isim, adres, bitis: Date.now() + 7 * 86400000 });
  return { anahtar, adres, isim: k.isim };
}
// Memory limit: expired codes and sessions are dropped every minute; if the map still fills up the oldest go (code requests cannot fill memory)
const SINIR = { kod: 20000, oturum: 50000 };
function budama(harita, enCok, bitti) { for (const [k, v] of harita) if (bitti(v)) harita.delete(k); while (harita.size > enCok) harita.delete(harita.keys().next().value); }
setInterval(() => { const t = Date.now(), kodBitti = (v) => t - v.zaman > 5 * 60000, otBitti = (v) => v.bitis < t;
  budama(kodlar, SINIR.kod, kodBitti); budama(oyuncuKod, SINIR.kod, kodBitti); budama(oturumlar, SINIR.oturum, otBitti); budama(oyuncular, SINIR.oturum, otBitti); }, 60000).unref();
export function oyuncu(anahtar, isim) { const o = oyuncular.get(String(anahtar || '')); return o && o.isim === isim && o.bitis > Date.now() ? o.adres : null; }
