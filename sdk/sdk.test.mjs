// SDK tests: nim.js and hive-db.js with a fake wallet and a fake server. No network, no real money.
// Run: node sdk.test.mjs
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const ok = (name, cond, extra = '') => { cond ? passed++ : failed++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const throws = async (f) => { try { await f(); return null; } catch (e) { return e; } };

// fake server: answers by path, records every call
const calls = [];
let routes = {};
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body });
  const path = new URL(url).pathname.replace(/^\/(pigeon|hive)/, '');
  const hit = Object.entries(routes).find(([p]) => path === p || path.startsWith(p + '?'));
  const [status, body] = hit ? hit[1] : [404, { hata: 'yok' }];
  return { ok: status < 400, status, json: async () => body };
};

// fake wallet: signs like Nimiq Pay's window.nimiq, records sends
const sent = [];
const wallet = {
  listAccounts: async () => ['NQ00 TEST'],
  sign: async (m) => ({ publicKey: 'pk', signature: 'sig:' + m }),
  sendBasicTransaction: async (tx) => { sent.push(tx); return { hash: 'h1' }; },
  sendBasicTransactionWithData: async (tx) => { sent.push(tx); return { hash: 'h2' }; },
};
globalThis.window = { nimiq: wallet };
window.parent = window;

const { NimNames } = await import('./nim.js');
const { HiveDB } = await import('./hive-db.js');

const REG = 'NQ38 H97B FAXR KR9J M2ES UPT0 LDA4 RLUE 0YNK';   // the registry address fixed in nim.js
const MANDO = 'NQ38H97BFAXRKR9JM2ESUPT0LDA4RLUE0YNK';
const TYPO = 'NQ38 H97B FAXR KR9J M2ES UPT0 LDA4 RLUE 0YNL';   // one letter changed: checksum fails

// ---- nim.js
const nim = NimNames({ app: 'mygame' });
ok('app must be a valid name', !!(await throws(() => NimNames({ app: 'bad--name' }))));

routes = { '/api/name/mando': [200, { name: 'mando', address: MANDO }] };
const r = await nim.resolve('Mando.nim');
ok('resolve: name to address, spaced', r?.address === REG, r?.address);
calls.length = 0;
ok('resolve: invalid name returns null without asking the server', (await nim.resolve('a--b')) === null && calls.length === 0);
await nim.resolve('mando');
ok('resolve: second lookup comes from the cache', calls.length === 0);

routes['/api/address/' + MANDO] = [200, { name: 'mando', names: ['mando', 'mert'] }];
ok('nameOf: address to name', (await nim.nameOf(REG)) === 'mando');
calls.length = 0;
ok('nameOf: mistyped address returns null without asking the server', (await nim.nameOf(TYPO)) === null && calls.length === 0);
const all = await nim.allNames(REG);
ok('allNames: main name and every name', all.main === 'mando' && all.names.length === 2);

routes['/api/name/newname'] = [200, { free: true, price: 5000000 }];
const p = await nim.price('newname');
ok('price: luna to NIM', p.free === true && p.price === 50, JSON.stringify(p));

sent.length = 0;
await nim.pay('mando', 1.5, 'coffee');
ok('pay by name: right address, amount in luna, note kept', sent[0]?.recipient === REG && sent[0]?.value === 150000 && sent[0]?.data === 'coffee');
await nim.pay(REG, 2);
ok('pay to address without a note: plain transaction', sent[1]?.value === 200000 && !('data' in sent[1]));
await nim.pay(REG, 1, 'ş'.repeat(40));
ok('pay: note cut to 64 bytes on a character boundary', new TextEncoder().encode(sent[2].data).length <= 64 && !sent[2].data.includes('�'));
ok('pay: zero or negative amount refused', !!(await throws(() => nim.pay(REG, 0))) && !!(await throws(() => nim.pay(REG, -1))));
routes['/api/name/nobody'] = [200, { name: 'nobody', free: true, price: 5000000 }];   // the server's answer for a name nobody owns
const unknown = await throws(() => nim.pay('nobody', 1));
ok('pay: unknown name refused, nothing sent', unknown?.code === 'unknown_name' && sent.length === 3);
ok('pay: mistyped address is not paid', !!(await throws(() => nim.pay(TYPO, 1))) && sent.length === 3);

const l = nim.label('lale.mygame');
ok('label: sub-name shows own name large, parent small', l.own === 'lale' && l.parent === 'mygame.nim' && l.full === 'lale.mygame.nim');

sent.length = 0;
await nim.setMainName('mert');
ok('setMainName: 1 luna to the fixed registry with ana:<name>', sent[0]?.recipient === REG && sent[0]?.value === 1 && sent[0]?.data === 'ana:mert');

routes['/api/name/lale.mygame'] = [200, { open: false }];
ok('claimSub: refused while the owner has not opened sub-names', (await throws(() => nim.claimSub('lale')))?.code === 'subs_closed');
routes['/api/name/lale.mygame'] = [200, { open: true }];
await nim.claimSub('lale');
ok('claimSub: alt:<sub>.<app> to the registry', sent[1]?.recipient === REG && sent[1]?.data === 'alt:lale.mygame');
await nim.giveSub('lale', 'mando');
ok('giveSub: alt:<sub>.<app>:<address> to the registry', sent[2]?.data === 'alt:lale.mygame:' + MANDO);
ok('claimSub: too long for the app refused', (await throws(() => nim.claimSub('a'.repeat(20))))?.code === 'too_long');

routes['/api/oyuncu/giris/mygame'] = [200, { mesaj: 'Hive login mygame' }];
routes['/api/oyuncu/giris'] = [200, { adres: MANDO, anahtar: 'k1' }];
const me = await nim.login();
ok('login: signs the server message, returns address and name', me.address === REG && me.name === 'mando' && me.key === 'k1');

// ---- hive-db.js
const db = HiveDB('mygame', { api: 'https://api.heylogram.com/hive' });
ok('signIn: no wallet, clear error', !!(await throws(() => db.signIn({}))));
calls.length = 0;
const addr = await db.signIn(wallet);
const post = calls.find((c) => c.method === 'POST');
ok('signIn: posts the signed message, keeps the address', addr === MANDO && db.address === MANDO && JSON.parse(post.body).signature === 'sig:Hive login mygame');

routes['/api/db/mygame/scores'] = [200, [{ id: 'a', veri: { score: 9, id: 'spoof' } }]];
calls.length = 0;
const rows = await db.col('scores').where('level', '==', 2).where('tags', 'array-contains', 'x').orderBy('score', 'desc').limit(10).get();
const q = new URL(calls[0].url).searchParams;
ok('query: where, orderBy, limit in the URL', q.getAll('where').join('|') === 'level,==,2|tags,icerir,"x"' && q.get('orderBy') === 'score' && q.get('yon') === 'desc' && q.get('limit') === '10');
ok('query: rows carry the server id (a field cannot spoof it)', rows[0].id === 'a' && rows[0].score === 9);
ok('query: player key sent after signIn', calls[0].headers['x-hive-oyuncu'] === 'k1');

calls.length = 0;
await db.col('scores').doc(MANDO).set({ score: 10 }).catch(() => {});
ok('doc set: PUT to the document path', calls[0].method === 'PUT' && calls[0].url.endsWith('/api/db/mygame/scores/' + MANDO));
ok('doc get: missing document is null', (await db.col('scores').doc('none').get()) === null);
const denied = await throws(() => db.col('x').doc('y').delete());
ok('errors carry the HTTP status', denied?.status === 404);

routes['/api/siparis/mygame'] = [200, { id: 's1', urun: 'gem', ad: 'Gem', fiyat: 3, durum: 'odendi', to: MANDO, memo: 'm1' }];
const order = await db.buy('gem');
ok('buy: order fields in English, status paid', order.status === 'paid' && order.price === 3 && order.memo === 'm1');

// ---- the published SDK and the copies Hive serves stay the same
for (const f of ['nim.js', 'hive-db.js']) {
  const a = readFileSync(new URL('./' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const b = readFileSync(new URL('../hive/' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  ok(`sdk/${f} matches hive/${f}`, a === b);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
