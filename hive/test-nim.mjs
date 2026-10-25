// nim.js (Nimiq Names SDK) test. Names and prices are read from live Pigeon (read only); sign-in and user counting
// run on local Hive (5197, sample names on) with a fake wallet. No real money is sent: the fake wallet only records requests.
// Run: node server.mjs (in another window) -> node test-nim.mjs
import { demoCuzdan } from './kimlik.mjs';
const HIVE = 'http://127.0.0.1:5197';
let gecti = 0, kaldi = 0; const ok = (ad, k, ek = '') => { k ? gecti++ : kaldi++; console.log((k ? 'GEÇTİ ' : 'KALDI ') + ad + (ek ? '  ' + ek : '')); };
const hata = async (f) => { try { await f(); return null; } catch (e) { return e; } };

// fake wallet: signs like Nimiq Pay's window.nimiq, only records sends
let cuzdan = demoCuzdan(); const giden = [];
globalThis.window = { nimiq: {
  listAccounts: async () => [cuzdan.adres],
  sign: async (m) => cuzdan.imzala(m),
  sendBasicTransaction: async (tx) => { giden.push(tx); return { hash: 'deneme' }; },
  sendBasicTransactionWithData: async (tx) => { giden.push(tx); return { hash: 'deneme' }; },
} };
window.parent = window;

// the folder's package.json is commonjs; a temporary .mjs copy loads it as an ES module like in the browser
const { readFileSync, writeFileSync, rmSync } = await import('node:fs');
writeFileSync('./.nim-test.mjs', readFileSync('./nim.js'));
const { NimNames } = await import('./.nim-test.mjs');
rmSync('./.nim-test.mjs');
const nim = NimNames({ app: 'bahce', hive: HIVE });

// 1) name resolution (live Pigeon)
const m = await nim.resolve('mando');
ok('isimden adres', m?.address?.startsWith('NQ44'), m?.address);
ok('.nim ekiyle de çözer', (await nim.resolve('mando.nim'))?.address === m?.address);
ok('büyük harf de çözer', (await nim.resolve('MANDO'))?.address === m?.address);
ok('kayıtsız isim → null', (await nim.resolve('olmayanisim-xyz-123')) === null);
ok('geçersiz isim → null', (await nim.resolve('bad name!')) === null);
ok('adresten isim', (await nim.nameOf(m.address)) === 'mando');
ok('boşluksuz adresten de isim', (await nim.nameOf(m.address.replace(/\s/g, ''))) === 'mando');
ok('çöp adres → null', (await nim.nameOf('merhaba')) === null);
const f = await nim.price('olmayanisim-xyz-123');
ok('boş isim fiyatı NIM cinsinden', f.free === true && f.price > 0, JSON.stringify(f));
ok('alınmış isim boş değil', (await nim.price('mando')).free === false);

// 2) sign-in + lasting user count (local Hive)
const once = (await fetch(HIVE + '/api/hive').then((r) => r.json())).petekler.find((p) => p.isim === 'bahce')?.kullanici ?? 0;
const g1 = await nim.login();
ok('giriş: adres ve oturum anahtarı', g1.address.startsWith('NQ') && g1.key?.length > 10, g1.address);
await nim.login();
const say1 = (await fetch(HIVE + '/api/hive').then((r) => r.json())).petekler.find((p) => p.isim === 'bahce').kullanici;
ok('aynı cüzdan iki kez girince bir kullanıcı sayılır', say1 === once + 1, `${once} → ${say1}`);
cuzdan = demoCuzdan(); await nim.login();
const say2 = (await fetch(HIVE + '/api/hive').then((r) => r.json())).petekler.find((p) => p.isim === 'bahce').kullanici;
ok('başka cüzdan ikinci kullanıcı olur', say2 === say1 + 1, `${say1} → ${say2}`);
ok('app vermeden giriş açık hata verir', /app/.test((await hata(() => NimNames({ hive: HIVE }).login()))?.message || ''));
ok('geçersiz app adı reddedilir', !!(await hata(async () => NimNames({ app: 'Bad Name!' }))));

// 3) payment (no real money)
await nim.pay('mando', 1.5);
ok('isimle ödeme doğru adrese, luna cinsinden', giden.at(-1)?.recipient === m.address && giden.at(-1)?.value === 150000 && giden.at(-1)?.fee === 0, JSON.stringify(giden.at(-1)));
await nim.pay('mando', 2, 'merhaba');
ok('notlu ödeme', giden.at(-1)?.data === 'merhaba');
await nim.pay('mando', 1, 'ş'.repeat(50));
ok('uzun not 64 bayta kesilir', new TextEncoder().encode(giden.at(-1).data).length <= 64, new TextEncoder().encode(giden.at(-1).data).length + ' bayt');
ok('kayıtsız isme ödeme reddedilir', (await hata(() => nim.pay('olmayanisim-xyz-123', 1)))?.code === 'unknown_name');
ok('sıfır ya da eksi tutar reddedilir', !!(await hata(() => nim.pay('mando', 0))) && !!(await hata(() => nim.pay('mando', -3))));
const say = giden.length; await hata(() => nim.pay('mando', 'abc'));
ok('sayı olmayan tutarda cüzdana gidilmez', giden.length === say);

// 4) badge
const el = { textContent: '', dataset: {}, title: '' };
await nim.badge(el, m.address);
ok('rozet ismi yazar', el.textContent === 'mando.nim' && el.dataset.nim === 'mando');
const el2 = { textContent: 'NQ00', dataset: {}, title: '' };
await nim.badge(el2, 'NQ0000000000000000000000000000000000');
ok('ismi olmayan adreste rozet dokunmaz', el2.textContent === 'NQ00');

// 4b) sub-name display: own name large, parent name small
const lb = nim.label('mert.sunset.nim');
ok('alt isim etiketi', lb.own === 'mert' && lb.parent === 'sunset.nim' && lb.full === 'mert.sunset.nim');
ok('üst isim etiketi', nim.label('mando').parent === null && nim.label('mando').full === 'mando.nim');
ok('üç seviye kabul edilmez', nim.label('a.b.c') === null);
ok('alt isim çözümü kayıtsızsa null', (await nim.resolve('yokkisi.mando')) === null);

// 4c) sub-name: against a local Pigeon (new endpoints), no real money
const YEREL_PIGEON = 'http://127.0.0.1:5290';
const yerelVar = await fetch(YEREL_PIGEON + '/healthz').then((r) => r.ok).catch(() => false);
if (yerelVar) {
  const sahip = NimNames({ app: 'mando', pigeon: YEREL_PIGEON, hive: HIVE });
  ok('alt isimler varsayılan kapalı', (await sahip.subsOpen()) === false);
  ok('kapalıyken oyuncu alamaz (subs_closed)', (await hata(() => sahip.claimSub('mert')))?.code === 'subs_closed');
  ok('çok uzun alt isim reddi', (await hata(() => sahip.claimSub('x'.repeat(20))))?.code === 'too_long');
  const say0 = giden.length;
  await sahip.giveSub('mert', 'pigeon.nim');
  const g = giden.at(-1);
  ok('sahip verir: kasaya 1 luna + doğru not', giden.length === say0 + 1 && g.recipient === 'NQ38 H97B FAXR KR9J M2ES UPT0 LDA4 RLUE 0YNK' && g.value === 1 && g.data === 'alt:mert.mando:NQ3979PCJM4LN7JRPF8MEASA7N0TBDFGAL76', g.data);
  ok('bilinmeyen alıcıya verilmez', (await hata(() => sahip.giveSub('mert', 'yokboylebiri.nim')))?.code === 'unknown_name');
  const el3 = { textContent: '', dataset: {}, title: '', classList: { list: [], add(...c) { this.list.push(...c); } } };
  await sahip.badge(el3, m.address, { format: (l) => '@' + l.own, className: 'oyun-rozet kalin' });
  ok('rozet uygulamanın biçimiyle', el3.textContent === '@mando' && el3.classList.list.join(' ') === 'oyun-rozet kalin');
} else console.log('ATLANDI yerel Pigeon (5290) kapalı: alt isim testleri');

// 4d) safety: no payment goes to a mistyped address; name rule same as the server
ok('tek harfi yanlış adrese ödeme gitmez', (await hata(() => nim.pay('NQ44 XGY3 JVJT U1X2 XHBS 6852 GMFG TB1M K6X6', 1)))?.code === 'unknown_name');
ok('tireyle başlayan / çift tireli isim geçersiz', nim.label('-mert') === null && nim.label('a--b') === null && (await nim.resolve('-mert')) === null);

// 5) clear error when there is no wallet
delete window.nimiq;
const yok = await hata(() => NimNames({ app: 'bahce', hive: HIVE }).pay('mando', 1));
ok('cüzdan yoksa no_wallet', yok?.code === 'no_wallet', yok?.message);

// 6) the server serves the SDK
const r = await fetch(HIVE + '/nim.js');
ok('/nim.js sunuluyor, CORS açık', r.ok && r.headers.get('access-control-allow-origin') === '*' && (await r.text()).includes('export function NimNames'));

console.log(`\n${gecti} geçti, ${kaldi} kaldı`); process.exit(kaldi ? 1 : 0);
