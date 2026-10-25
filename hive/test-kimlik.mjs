// End to end: unauthorised write rejected, demo wallet sign-in, signed settings, fake signature rejected, external site proof, bee counter.
// The server must be running (node server.mjs). Run: node test-kimlik.mjs
import { createServer } from 'node:http';
import { demoCuzdan } from './kimlik.mjs';
const B = 'http://127.0.0.1:5197', J = (r) => r.json();
let gecti = 0, kaldi = 0;
const ok = (ad, kosul, ek = '') => { kosul ? gecti++ : kaldi++; console.log((kosul ? 'GEÇTİ ' : 'KALDI ') + ad + (ek ? '  ' + ek : '')); };
const post = (yol, govde, ot) => fetch(B + yol, { method: 'POST', body: JSON.stringify(govde), headers: { 'content-type': 'application/json', ...(ot ? { 'x-hive-oturum': ot } : {}) } });

// 1) no writes without sign-in
ok('girişsiz site yayınlama reddi', (await post('/api/site/garura', { baslik: 'x' })).status === 401);
ok('girişsiz deploy reddi', (await post('/api/deploy/garura', { repo: 'https://github.com/a/b' })).status === 401);
ok('girişsiz depo yazma reddi', (await fetch(B + '/api/depo/garura/k', { method: 'PUT', body: '1' })).status === 401);

// 2) the demo wallet signs only for sample names; it does not sign for a real name (pigeon)
const gm = await fetch(B + '/api/giris/pigeon').then(J);
ok('demo cüzdanı gerçek isme imza atmaz', (await post('/api/demo-imza', { mesaj: gm.mesaj })).status === 403);

// 3) sample name garura: sign-in with the demo wallet
const { mesaj } = await fetch(B + '/api/giris/garura').then(J);
const imza = await post('/api/demo-imza', { mesaj }).then(J);
const g = await post('/api/giris', { mesaj, ...imza }).then(J);
ok('sahip girişi', !!g.anahtar);
ok('aynı imzayla ikinci giriş reddi', (await post('/api/giris', { mesaj, ...imza })).status === 403);
ok('girişle site yayınlama', (await post('/api/site/garura', { baslik: 'Garura Hive' }, g.anahtar)).ok);
ok('oturum başka isme geçmez', (await post('/api/site/mert', { baslik: 'x' }, g.anahtar)).status === 401);

// 4) signed settings: the owner's signature passes, a foreign signature and an old version do not
const simdi = await fetch(B + '/api/ayar/garura').then(J), surum = (simdi.surum || 0) + 1, ayar = { odul_carpani: 2, sezon: 'yaz' };
const am = `Hive ayarı: garura.nim #${surum}\n` + JSON.stringify(ayar);
const ai = await post('/api/demo-imza', { mesaj: am }).then(J);
ok('sahibin imzalı ayarı kaydedilir', (await fetch(B + '/api/ayar/garura', { method: 'PUT', body: JSON.stringify({ surum, ayar, ...ai }) })).ok);
const yabanci = demoCuzdan(), ym = `Hive ayarı: garura.nim #${surum + 1}\n` + JSON.stringify({ odul_carpani: 999 });
ok('yabancı imzalı ayar reddi', (await fetch(B + '/api/ayar/garura', { method: 'PUT', body: JSON.stringify({ surum: surum + 1, ayar: { odul_carpani: 999 }, ...yabanci.imzala(ym) }) })).status === 403);
ok('eski sürüm reddi', (await fetch(B + '/api/ayar/garura', { method: 'PUT', body: JSON.stringify({ surum, ayar, ...ai }) })).status === 409);
const oku = await fetch(B + '/api/ayar/garura').then(J);
ok('ayar herkese açık ve imzalı', oku.ayar?.odul_carpani === 2 && !!oku.signature);

// 5) external site: /.well-known/hive.json proof
const PORT = 5196, url = `http://127.0.0.1:${PORT}`, km = `Hive sitesi: garura.nim = ${url}`;
const kanit = { isim: 'garura', mesaj: km, ...(await post('/api/demo-imza', { mesaj: km }).then(J)) };
let sunulan = kanit;
const dis = createServer((q, s) => { if (q.url === '/.well-known/hive.json') { s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify(sunulan)); } else { s.writeHead(200); s.end('<title>Garura dış site</title>'); } }).listen(PORT, '127.0.0.1');
await new Promise((r) => setTimeout(r, 200));
sunulan = { isim: 'garura', mesaj: km, ...yabanci.imzala(km) };
ok('yabancı imzalı kanıt reddi', (await post('/api/bagla/garura', { url }, g.anahtar)).status === 403);
sunulan = kanit;
const bg = await post('/api/bagla/garura', { url }, g.anahtar);
ok('sahibin kanıtıyla dış site bağlanır', bg.ok);
const h = await fetch(B + '/api/hive').then(J), pg = h.petekler.find((x) => x.isim === 'garura');
ok('petek dış siteye açılır', pg.site?.adres === url, pg.site?.adres);
dis.close();

// 6) bee counter
const once = pg.ziyaret.bugun;
ok('ari.js sunulur', (await fetch(B + '/ari.js')).headers.get('content-type').includes('javascript'));
const zr = await fetch(B + '/api/ziyaret/garura', { method: 'POST', headers: { origin: 'https://baska-site.com' } });
ok('dış siteden ziyaret sayılır (CORS açık)', zr.ok && zr.headers.get('access-control-allow-origin') === '*');
const sonra = (await fetch(B + '/api/hive').then(J)).petekler.find((x) => x.isim === 'garura').ziyaret.bugun;
ok('arı sayısı arttı', sonra === once + 1, `${once} → ${sonra}`);

console.log(`\n${gecti} geçti, ${kaldi} kaldı`); process.exit(kaldi ? 1 : 0);
