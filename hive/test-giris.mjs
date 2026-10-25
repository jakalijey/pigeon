// Sign-in text attack test: a signature with the right code but a changed text must NOT open a session (owner and player).
// The server must be running on 5197 (local, sample names on). Run: node test-giris.mjs
import { demoCuzdan } from './kimlik.mjs';
const B = 'http://127.0.0.1:5197', J = (r) => r.json();
let gecti = 0, kaldi = 0; const ok = (ad, k, ek = '') => { k ? gecti++ : kaldi++; console.log((k ? 'GEÇTİ ' : 'KALDI ') + ad + (ek ? '  ' + ek : '')); };
const post = (y, g) => fetch(B + y, { method: 'POST', body: JSON.stringify(g), headers: { 'content-type': 'application/json' } });
const imzala = (mesaj) => post('/api/demo-imza', { mesaj }).then(J);   // owner of the sample names (local demo wallet)

// owner sign-in: the normal path works
const { mesaj } = await fetch(B + '/api/giris/bahce').then(J);
const normal = await post('/api/giris', { mesaj, ...(await imzala(mesaj)) }).then(J);
ok('normal sahip girişi', !!normal.anahtar);

// attack: code for bahce, but the text the victim sees in the wallet names another name
const { mesaj: m2 } = await fetch(B + '/api/giris/bahce').then(J);
const kod = m2.match(/Kod: ([0-9a-f]{16})$/)[1];
const sahte = `Hive oyuncu girişi: eglence.nim\nBu imza yalnız seni tanıtır, para göndermez.\nKod: ${kod}`;
const r2 = await post('/api/giris', { mesaj: sahte, ...(await imzala(sahte)) });
const j2 = await r2.json();
ok('değiştirilmiş metinle sahip oturumu AÇILMAZ', r2.status === 403 && !j2.anahtar, j2.hata);

// the same code cannot be used again (the attack attempt burned the code)
const r3 = await post('/api/giris', { mesaj: m2, ...(await imzala(m2)) });
ok('kullanılan kod tekrar geçmez', r3.status === 403);

// player sign-in: normal and changed text
const oyuncu = demoCuzdan();
const { mesaj: o1 } = await fetch(B + '/api/oyuncu/giris/bahce').then(J);
const og = await post('/api/oyuncu/giris', { mesaj: o1, ...oyuncu.imzala(o1) }).then(J);
ok('normal oyuncu girişi', !!og.anahtar);
const { mesaj: o2 } = await fetch(B + '/api/oyuncu/giris/bahce').then(J);
const okod = o2.match(/Kod: ([0-9a-f]{16})$/)[1];
const osahte = `Oyunumuza hoş geldin!\nKod: ${okod}`;
const r4 = await post('/api/oyuncu/giris', { mesaj: osahte, ...oyuncu.imzala(osahte) });
ok('değiştirilmiş metinle oyuncu oturumu AÇILMAZ', r4.status === 403, (await r4.json()).hata);

console.log(`\n${gecti} geçti, ${kaldi} kaldı`); process.exit(kaldi ? 1 : 0);
