// Small ZIP reader (read only): extracts files from the central directory. Compression: none (0) or deflate (8).
// Safety: absolute paths, "..", drive letters and backslashes are rejected; total unpacked size and file count are limited.
import { inflateRawSync } from 'node:zlib';

export function zipAc(buf, { enCokBayt = 60 * 1024 * 1024, enCokDosya = 3000 } = {}) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('zip değil');
  const sayi = buf.readUInt16LE(e + 10), cdBas = buf.readUInt32LE(e + 16);
  if (sayi > enCokDosya) throw new Error('çok fazla dosya');
  const out = []; let p = cdBas, toplam = 0;
  for (let k = 0; k < sayi; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bozuk zip');
    const yontem = buf.readUInt16LE(p + 10), sikBoy = buf.readUInt32LE(p + 20), acBoy = buf.readUInt32LE(p + 24);
    const adU = buf.readUInt16LE(p + 28), ekU = buf.readUInt16LE(p + 30), yorumU = buf.readUInt16LE(p + 32), yerel = buf.readUInt32LE(p + 42);
    const ad = buf.toString('utf8', p + 46, p + 46 + adU).split('\\').join('/'); p += 46 + adU + ekU + yorumU;   // Windows tools write backslashes
    if (ad.endsWith('/')) continue;
    if (/^\/|^[a-zA-Z]:|(^|\/)\.\.(\/|$)/.test(ad)) throw new Error('güvensiz yol: ' + ad);
    toplam += acBoy; if (toplam > enCokBayt) throw new Error('açılmış boyut sınırı aşıldı');
    const lAd = buf.readUInt16LE(yerel + 26), lEk = buf.readUInt16LE(yerel + 28), veri = buf.subarray(yerel + 30 + lAd + lEk, yerel + 30 + lAd + lEk + sikBoy);
    const icerik = yontem === 0 ? Buffer.from(veri) : yontem === 8 ? inflateRawSync(veri, { maxOutputLength: acBoy + 1 }) : null;
    if (!icerik) throw new Error('desteklenmeyen sıkıştırma: ' + ad);
    out.push({ ad, icerik });
  }
  // if there is a single top folder (dist/...) strip it
  const ilk = out.map((f) => f.ad.split('/')[0]); const tek = out.length && ilk.every((x) => x === ilk[0]) && out.every((f) => f.ad.includes('/'));
  return tek ? out.map((f) => ({ ...f, ad: f.ad.slice(ilk[0].length + 1) })) : out;
}
