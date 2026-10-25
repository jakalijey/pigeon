// Hive database test: Firestore-like structure, queries, rules, player sign-in, limits, speed.
// The server must be running on 5197 (local, sample names on). Run: node test-db.mjs
import { demoCuzdan } from './kimlik.mjs';
const B = 'http://127.0.0.1:5197', J = (r) => r.json();
let gecti = 0, kaldi = 0; const ok = (ad, k, ek = '') => { k ? gecti++ : kaldi++; console.log((k ? 'GEÇTİ ' : 'KALDI ') + ad + (ek ? '  ' + ek : '')); };
const istek = (yol, { yontem = 'GET', govde, sahip, oyuncu } = {}) => fetch(B + yol, { method: yontem, body: govde === undefined ? undefined : JSON.stringify(govde), headers: { 'content-type': 'application/json', ...(sahip ? { 'x-hive-oturum': sahip } : {}), ...(oyuncu ? { 'x-hive-oyuncu': oyuncu } : {}) } });
const post = (y, g) => fetch(B + y, { method: 'POST', body: JSON.stringify(g), headers: { 'content-type': 'application/json' } });
async function sahipGir(n) { const { mesaj } = await fetch(B + '/api/giris/' + n).then(J); return (await post('/api/giris', { mesaj, ...(await post('/api/demo-imza', { mesaj }).then(J)) }).then(J)).anahtar; }
async function oyuncuGir(n, cuzdan) { const { mesaj } = await fetch(B + '/api/oyuncu/giris/' + n).then(J); return post('/api/oyuncu/giris', { mesaj, ...cuzdan.imzala(mesaj) }).then(J); }

const N = 'bahce', S = await sahipGir(N);
// 1) structure: collection -> document -> nested fields (like a Firestore console)
const makale = { baslik: '101 yıl', etiketler: ['basin', 'tarih'], bulten: { yorum: 'kısa not', sss: [{ s: 'Ne oldu?', c: 'Kutlama' }, { s: 'Nerede?', c: 'Hai Phong' }] }, okunma: 12, yayinda: true };
ok('belge yaz (iç içe nesne + liste)', (await istek(`/api/db/${N}/makaleler/101-yil`, { yontem: 'PUT', govde: makale, sahip: S })).ok);
const geri = await istek(`/api/db/${N}/makaleler/101-yil`).then(J);
ok('iç içe alan aynen geri okunur', geri.veri?.bulten?.sss?.[1]?.c === 'Hai Phong');
ok('kısmi güncelleme (birleştir)', (await istek(`/api/db/${N}/makaleler/101-yil`, { yontem: 'PATCH', govde: { okunma: 13, bulten: { yorum: 'güncel' } }, sahip: S })).ok);
const g2 = await istek(`/api/db/${N}/makaleler/101-yil`).then(J);
ok('birleştirmede diğer alanlar korunur', g2.veri.okunma === 13 && g2.veri.bulten.yorum === 'güncel' && g2.veri.bulten.sss.length === 2);
const eklenen = await istek(`/api/db/${N}/makaleler`, { yontem: 'POST', govde: { baslik: 'otomatik kimlik', okunma: 3, yayinda: false }, sahip: S }).then(J);
ok('otomatik kimlikle ekle', !!eklenen.id);
// 2) query
for (let i = 0; i < 30; i++) await istek(`/api/db/${N}/skorlar/s${i}`, { yontem: 'PUT', govde: { oyuncu: 'ari' + i, puan: (i * 37) % 101, seviye: i % 3 }, sahip: S });
const ilk5 = await istek(`/api/db/${N}/skorlar?orderBy=puan&yon=desc&limit=5`).then(J);
ok('sırala + sınırla (en yüksek 5 puan)', ilk5.length === 5 && ilk5.every((b, i, a) => !i || a[i - 1].veri.puan >= b.veri.puan), ilk5.map((b) => b.veri.puan).join(','));
const filtre = await istek(`/api/db/${N}/skorlar?where=seviye,==,2&where=puan,>,50`).then(J);
ok('çoklu filtre (seviye 2 ve puan > 50)', filtre.length > 0 && filtre.every((b) => b.veri.seviye === 2 && b.veri.puan > 50), filtre.length + ' belge');
const etiket = await istek(`/api/db/${N}/makaleler?where=etiketler,icerir,"tarih"`).then(J);
ok('liste içinde arama (etiketler içerir)', etiket.length === 1 && etiket[0].id === '101-yil');
const ozet = await istek(`/api/db/${N}`).then(J);
ok('koleksiyon özeti', ozet.koleksiyonlar.length === 2, ozet.koleksiyonlar.map((k) => k.ad + ':' + k.belge).join(' '));
// 3) rules + player
ok('girişsiz yazma reddi', (await istek(`/api/db/${N}/skorlar/x`, { yontem: 'PUT', govde: { a: 1 } })).status === 401);
ok('kural: oyuncu kendi belgesine yazar', (await istek(`/api/db/${N}/oyuncular/kural`, { yontem: 'PUT', govde: { okuma: 'herkes', yazma: 'oyuncu' }, sahip: S })).ok);
const ali = demoCuzdan(), veli = demoCuzdan();
const ag = await oyuncuGir(N, ali), vg = await oyuncuGir(N, veli);
ok('oyuncu girişi (imza)', !!ag.anahtar && !!vg.anahtar);
const aliId = ag.adres;
ok('oyuncu kendi belgesine yazdı', (await istek(`/api/db/${N}/oyuncular/${aliId}`, { yontem: 'PUT', govde: { takma: 'ali', altin: 5 }, oyuncu: ag.anahtar })).ok);
ok('oyuncu başkasının belgesine YAZAMAZ', (await istek(`/api/db/${N}/oyuncular/${aliId}`, { yontem: 'PUT', govde: { altin: 9999 }, oyuncu: vg.anahtar })).status === 403);
ok('oyuncu sahibin koleksiyonuna YAZAMAZ', (await istek(`/api/db/${N}/skorlar/s1`, { yontem: 'PUT', govde: { puan: 9999 }, oyuncu: ag.anahtar })).status === 403);
ok('oyuncu oturumu başka uygulamada geçmez', (await istek(`/api/db/mert/oyuncular/${aliId}`, { yontem: 'PUT', govde: { a: 1 }, oyuncu: ag.anahtar })).status !== 200);
ok('kural: gizli koleksiyon (yalnız sahip okur)', (await istek(`/api/db/${N}/gizli/kural`, { yontem: 'PUT', govde: { okuma: 'sahip', yazma: 'sahip' }, sahip: S })).ok && (await istek(`/api/db/${N}/gizli/a`, { yontem: 'PUT', govde: { sir: 1 }, sahip: S })).ok);
ok('gizliyi herkes okuyamaz', (await istek(`/api/db/${N}/gizli/a`)).status === 403);
ok('gizliyi sahip okur', (await istek(`/api/db/${N}/gizli/a`, { sahip: S })).ok);
// 4) limits
ok('1 MB üstü belge reddi', (await istek(`/api/db/${N}/buyuk/a`, { yontem: 'PUT', govde: { x: 'y'.repeat(1100000) }, sahip: S })).status === 413);
ok('nesne olmayan belge reddi', (await istek(`/api/db/${N}/skorlar/z`, { yontem: 'PUT', govde: [1, 2], sahip: S })).status === 400);
// 5) speed: 3000 queries, 50 concurrent
const sure = []; const is = Array.from({ length: 3000 }); const t = performance.now();
await Promise.all(Array.from({ length: 50 }, async () => { while (is.length) { is.pop(); const a = performance.now(); const r = await fetch(B + `/api/db/${N}/skorlar?orderBy=puan&yon=desc&limit=10`); await r.text(); sure.push(performance.now() - a); } }));
sure.sort((a, b) => a - b);
console.log(`\nhız: 3000 sorgu (sırala+sınırla), 50 eşzamanlı → ${Math.round(3000 / ((performance.now() - t) / 1000))} sorgu/sn, ortanca ${sure[1500].toFixed(1)} ms, %95 ${sure[2850].toFixed(1)} ms`);
const o2 = await istek(`/api/db/${N}`).then(J); console.log('bugün okuma', o2.sayac.okuma, '/', o2.sinir.gunlukOkuma, '· yazma', o2.sayac.yazma, '/', o2.sinir.gunlukYazma, '· boyut', (o2.bayt / 1024).toFixed(1), 'KB /', o2.sinir.bayt / 1048576, 'MB');
console.log(`\n${gecti} geçti, ${kaldi} kaldı`); process.exit(kaldi ? 1 : 0);
