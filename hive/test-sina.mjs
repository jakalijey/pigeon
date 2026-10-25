// Hive test (local server, demo wallet): 1) publishing a real app via zip, 2) linking a site on its own server,
// 3) storage load test (speed/durability), 4) quota. Run: node test-sina.mjs  (server must be running on 5197)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const B = 'http://127.0.0.1:5197', J = (r) => r.json();
const post = (y, g, ot) => fetch(B + y, { method: 'POST', body: JSON.stringify(g), headers: { 'content-type': 'application/json', ...(ot ? { 'x-hive-oturum': ot } : {}) } });
async function gir(isim) { const { mesaj } = await fetch(B + '/api/giris/' + isim).then(J); return (await post('/api/giris', { mesaj, ...(await post('/api/demo-imza', { mesaj }).then(J)) }).then(J)).anahtar; }
const yuzde = (a, q) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * q)].toFixed(1);

// 1) Knock, a real app: built as a user would (vite build --base=./) and zipped
console.log('\n== 1) Gerçek uygulama: Knock (.zip) → oyun.nim');
const ot1 = await gir('oyun');
let t = performance.now();
const y = await fetch(B + '/api/yukle/oyun', { method: 'PUT', body: readFileSync('derle/knock-site.zip'), headers: { 'x-hive-oturum': ot1 } }).then(J);
console.log('yükleme:', y.ok ? 'tamam' : y.hata, y.dosya, 'dosya,', Math.round(performance.now() - t), 'ms, başlık:', y.baslik);
const html = await fetch(B + '/s/oyun/').then((r) => r.text());
const varliklar = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((m) => m[1]);
const durum = await Promise.all(varliklar.map((v) => fetch(B + '/s/oyun/' + v).then((r) => r.status + ' ' + v)));
console.log('sayfanın dosyaları:', durum.join(' · '));

// 2) Site on its own server: like a site on another machine (5196), with a signed /.well-known/hive.json inside
console.log('\n== 2) Kendi sunucusundaki site → atolye.nim');
const PORT = 5196, url = `http://127.0.0.1:${PORT}`, mesaj = `Hive sitesi: atolye.nim = ${url}`;
const kanit = { isim: 'atolye', mesaj, ...(await post('/api/demo-imza', { mesaj }).then(J)) };
const dis = createServer((q, s) => {
  if (q.url === '/.well-known/hive.json') { s.writeHead(200, { 'content-type': 'application/json' }); return s.end(JSON.stringify(kanit)); }
  s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(`<!doctype html><title>Ahşap Atölye</title><h1>Ahşap Atölye</h1><script src="${B}/ari.js" data-isim="atolye"></script>`);
}).listen(PORT, '127.0.0.1');
await new Promise((r) => setTimeout(r, 200));
const ot2 = await gir('atolye');
const bg = await post('/api/bagla/atolye', { url }, ot2).then(J);
const pg = (await fetch(B + '/api/hive').then(J)).petekler.find((x) => x.isim === 'atolye');
console.log('bağlama:', bg.ok ? 'tamam' : bg.hata, '· petek açılınca giden adres:', pg.site?.adres);

// 3) Storage load test
console.log('\n== 3) Depo yük testi (kahveci.nim)');
const ot3 = await gir('kahveci');
const yazSure = [];
for (let i = 0; i < 200; i++) { t = performance.now(); await fetch(B + `/api/depo/kahveci/skor_${i}`, { method: 'PUT', body: JSON.stringify({ oyuncu: 'ari' + i, puan: i * 7 }), headers: { 'x-hive-oturum': ot3 } }); yazSure.push(performance.now() - t); }
console.log(`yazma: 200 kayıt, ortanca ${yuzde(yazSure, 0.5)} ms, %95 ${yuzde(yazSure, 0.95)} ms`);
const okuSure = []; let hata = 0; t = performance.now();
const isler = Array.from({ length: 2000 }, (_, i) => i);
await Promise.all(Array.from({ length: 50 }, async () => { while (isler.length) { const i = isler.pop(); const a = performance.now(); const r = await fetch(B + `/api/depo/kahveci/skor_${i % 200}`); if (!r.ok) hata++; await r.text(); okuSure.push(performance.now() - a); } }));
const top = (performance.now() - t) / 1000;
console.log(`okuma: 2000 istek, 50 eşzamanlı → ${Math.round(2000 / top)} istek/sn, ortanca ${yuzde(okuSure, 0.5)} ms, %95 ${yuzde(okuSure, 0.95)} ms, hata ${hata}`);
const hepsi = await fetch(B + '/api/depo/kahveci').then(J);
console.log('tüm depoyu tek istekte okuma:', Object.keys(hepsi).length, 'anahtar');

// 4) Quota
console.log('\n== 4) Kota');
const k = (await fetch(B + '/api/hive').then(J)).petekler.find((x) => x.isim === 'kahveci').kota;
console.log(`bugünkü işlem ${k.islem}/${k.islemSinir}, depo ${(k.depo / 1024).toFixed(1)}/${k.depoSinir / 1024} KB`);
const buyuk = await fetch(B + '/api/depo/kahveci/buyuk', { method: 'PUT', body: 'x'.repeat(300 * 1024), headers: { 'x-hive-oturum': ot3 } });
console.log('300 KB yazma denemesi:', buyuk.status, buyuk.status === 413 ? '(kota korudu)' : '');
dis.close(); process.exit(0);
