import assert from 'node:assert/strict';
import { buildTable, parseNote, priceOf, isValidName, paymentsFor, parseGift, parseRedeem, giftHash, giftStatus, giftOpen, GIFT_MIN_LEN, parseSub, isValidFullName, parseSubToggle, subsOpen } from './rules.mjs';

const REG = 'NQ31 7GP4 BBVA MCYB D6DG JU0N E1YH RFQ2 G5DB';
const PRICES = [[2, 1000e5], [3, 500e5], [4, 200e5], [5, 50e5]];
const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();
const hex = (s) => Buffer.from(s, 'utf8').toString('hex');
const tx = (o) => ({ recipient: REG, state: 'confirmed', executionResult: true, value: 200e5, blockHeight: 100, transactionHash: 'aa', sender: 'NQ00 AAAA', ...o, data: { raw: hex(o.note ?? 'nim:mert') } });
const opts = { registry: REG, prices: PRICES };
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('note parsing', () => {
  assert.equal(parseNote(hex('nim:mert')), 'mert');
  assert.equal(parseNote(hex('nim:Mert')), null);
  assert.equal(parseNote(hex('nim:me rt')), null);
  assert.equal(parseNote(hex('hello')), null);
  assert.equal(parseNote(hex('nim:-mert')), null);
});
t('valid names', () => { assert.ok(isValidName('a1-b')); assert.ok(!isValidName('a--b')); assert.ok(!isValidName('x'.repeat(33))); });
t('price by length', () => { assert.equal(priceOf('ab', PRICES), 1000e5); assert.equal(priceOf('abcd', PRICES), 200e5); assert.equal(priceOf('abcdefgh', PRICES), 50e5); assert.equal(priceOf('a', PRICES), 1000e5); });
t('first registration wins', () => {
  const { names } = buildTable([tx({ sender: 'NQ02 BBBB', blockHeight: 120, transactionHash: 'b1' }), tx({ sender: 'NQ01 AAAA', blockHeight: 110, transactionHash: 'a1' })], opts);
  assert.equal(names.get('mert').owner, 'NQ01AAAA');
});
t('same block: lower hash wins', () => {
  const { names } = buildTable([tx({ sender: 'NQ02 BBBB', transactionHash: 'ff' }), tx({ sender: 'NQ01 AAAA', transactionHash: '0f' })], opts);
  assert.equal(names.get('mert').owner, 'NQ01AAAA');
});
t('underpaid is ignored', () => { const { names } = buildTable([tx({ note: 'nim:abc', value: 499e5 })], opts); assert.equal(names.size, 0); });
t('pending or failed is ignored', () => {
  assert.equal(buildTable([tx({ state: 'pending' })], opts).names.size, 0);
  assert.equal(buildTable([tx({ executionResult: false })], opts).names.size, 0);
});
t('other recipient is ignored', () => { assert.equal(buildTable([tx({ recipient: 'NQ99 ZZZZ' })], opts).names.size, 0); });
t('reserved names cannot be taken', () => { assert.equal(buildTable([tx({ note: 'nim:nimiq', value: 1e12 })], opts).names.size, 0); });
t('primary name is the earliest', () => {
  const { primary } = buildTable([tx({ note: 'nim:second', blockHeight: 200, transactionHash: 'c' }), tx({ note: 'nim:first', blockHeight: 150, transactionHash: 'd' })], opts);
  assert.equal(primary.get('NQ00AAAA'), 'first');
});
t('request payments match the ode note', () => {
  const r = { id: 'ab12cd34', to: 'NQ55 TTTT', payments: [{ hash: 'old' }] };
  const p = (o) => tx({ recipient: 'NQ55 TTTT', ...o });
  const found = paymentsFor(r, [
    p({ note: 'ode:ab12cd34', transactionHash: 'h1', value: 5e5 }),
    p({ note: 'ode:ab12cd34 coffee', transactionHash: 'h2', value: 3e5 }),
    p({ note: 'ode:ab12cd345', transactionHash: 'h3' }),
    p({ note: 'ode:ab12cd34', transactionHash: 'old' }),
    p({ note: 'ode:ab12cd34', transactionHash: 'h4', state: 'pending' }),
    p({ note: 'ode:ab12cd34', transactionHash: 'h5', executionResult: false }),
    tx({ note: 'ode:ab12cd34', transactionHash: 'h6' }),
    p({ note: 'ode:ab12cd34', transactionHash: 'h1' }),
  ]);
  assert.deepEqual(found.map((f) => f.hash), ['h1', 'h2']);
  assert.equal(found.reduce((a, f) => a + f.value, 0), 8e5);
});
t('exact price is enough', () => { assert.equal(buildTable([tx({ note: 'nim:abcd', value: 200e5 })], opts).names.size, 1); });
t('included state counts', () => { assert.equal(buildTable([tx({ state: 'included' })], opts).names.size, 1); });
t('invalidated and expired are ignored', () => {
  assert.equal(buildTable([tx({ state: 'invalidated' })], opts).names.size, 0);
  assert.equal(buildTable([tx({ state: 'expired' })], opts).names.size, 0);
});
t('32 letters ok, 33 not', () => { assert.ok(isValidName('a'.repeat(32))); assert.ok(!isValidName('a'.repeat(33))); assert.equal(parseNote(hex('nim:' + 'a'.repeat(33))), null); });
t('note with spaces around is trimmed', () => { assert.equal(parseNote(hex('  nim:mert ')), 'mert'); });
t('registry address with or without spaces', () => {
  assert.equal(buildTable([tx({ recipient: REG.replace(/\s/g, '') })], opts).names.size, 1);
  assert.equal(buildTable([tx({})], { ...opts, registry: REG.replace(/\s/g, '').toLowerCase() }).names.size, 1);
});
t('second name does not change primary', () => {
  const { names, primary } = buildTable([tx({ note: 'nim:first', blockHeight: 100, transactionHash: 'a' }), tx({ note: 'nim:second', blockHeight: 101, transactionHash: 'b' })], opts);
  assert.equal(names.size, 2); assert.equal(primary.get('NQ00AAAA'), 'first');
});
t('late payment for taken name keeps first owner', () => {
  const { names } = buildTable([tx({ sender: 'NQ01 AAAA', blockHeight: 100 }), tx({ sender: 'NQ02 BBBB', blockHeight: 300, value: 1e12, transactionHash: 'zz' })], opts);
  assert.equal(names.get('mert').owner, 'NQ01AAAA');
});
t('short names cost more', () => { assert.ok(priceOf('ab', PRICES) > priceOf('abc', PRICES)); assert.ok(priceOf('abc', PRICES) > priceOf('abcd', PRICES)); assert.ok(priceOf('abcd', PRICES) > priceOf('abcde', PRICES)); });
t('uppercase or bad notes never register', () => {
  for (const n of ['NIM:mert', 'nim: mert', 'nim:mert!', 'nim:', 'nimmert', 'nim:a--b']) assert.equal(buildTable([tx({ note: n, value: 1e12 })], opts).names.size, 0, n);
});
t('request payment ignores other address and wrong state', () => {
  const r = { id: '0000aaaa', to: 'NQ55 TTTT', payments: [] };
  assert.equal(paymentsFor(r, [tx({ recipient: 'NQ55 TTTT', note: 'ode:0000aaaa', state: 'invalidated' })]).length, 0);
  assert.equal(paymentsFor(r, [tx({ recipient: 'NQ55 TTTX', note: 'ode:0000aaaa' })]).length, 0);
  assert.equal(paymentsFor(r, [tx({ recipient: 'NQ55TTTT', note: 'ode:0000aaaa' })]).length, 1);
});
// --- hediye kodu (kampanya)
const DAY = Date.UTC(2026, 10, 15, 12);                       // 15 Nov 2026, noon
const camp = (o) => ({ sender: REG, recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000', value: 1, blockHeight: 100, transactionHash: 'g0', state: 'confirmed', executionResult: true, timestamp: DAY - 86400000, ...o, data: { raw: hex(o.note) } });
const red = (o) => tx({ value: 1, timestamp: DAY, blockHeight: 200, ...o });
const CODE = 'HIVE100', H = giftHash(CODE);
const C = (count = 2, until = '20261130', extra = {}) => camp({ note: `hediye:${H}:${count}:${until}`, ...extra });

t('gift: note parsing', () => {
  assert.deepEqual(parseGift(hex(`hediye:${H}:100:20261130`)), { hash: H, count: 100, until: Date.UTC(2026, 10, 30, 23, 59, 59, 999) });
  assert.equal(parseGift(hex(`hediye:${H}:0:20261130`)), null);
  assert.equal(parseGift(hex(`hediye:XYZ:5:20261130`)), null);
  assert.deepEqual(parseRedeem(hex('nim:lavanta:HIVE100')), { name: 'lavanta', code: 'HIVE100' });
  assert.equal(parseRedeem(hex('nim:lavanta')), null);
  assert.equal(parseNote(hex('nim:lavanta:HIVE100')), null);   // the plain rule does not treat the gift note as a registration
  assert.equal(giftHash('hive100'), giftHash(' HIVE100 '));     // case and spaces do not matter
});
t('gift: valid code registers a 5+ name for free', () => {
  const { names } = buildTable([C(), red({ note: 'nim:lavanta:HIVE100', transactionHash: 'r1' })], opts);
  assert.equal(names.get('lavanta')?.owner, 'NQ00AAAA'); assert.equal(names.get('lavanta')?.gift, true);
});
t('gift: short names are not gifted', () => {
  const { names } = buildTable([C(), red({ note: 'nim:abcd:HIVE100', transactionHash: 'r1' })], opts);
  assert.equal(names.size, 0); assert.equal(GIFT_MIN_LEN, 5);
});
t('gift: quota runs out', () => {
  const { names } = buildTable([C(2), red({ note: 'nim:birinci:HIVE100', transactionHash: 'r1', sender: 'NQ01 BIR' }), red({ note: 'nim:ikinci:HIVE100', transactionHash: 'r2', blockHeight: 201, sender: 'NQ02 IKI' }), red({ note: 'nim:ucuncu:HIVE100', transactionHash: 'r3', blockHeight: 202, sender: 'NQ03 UC' })], opts);
  assert.ok(names.has('birinci') && names.has('ikinci')); assert.ok(!names.has('ucuncu'));
});
t('gift: one address gets at most one gift per campaign', () => {
  const { names } = buildTable([C(5), red({ note: 'nim:birinci:HIVE100', transactionHash: 'r1' }), red({ note: 'nim:ikinci:HIVE100', transactionHash: 'r2', blockHeight: 201 })], opts);
  assert.ok(names.has('birinci')); assert.ok(!names.has('ikinci'));
});
t('gift: expired campaign does not work', () => {
  const { names } = buildTable([C(5, '20261114'), red({ note: 'nim:lavanta:HIVE100', transactionHash: 'r1' })], opts);
  assert.equal(names.size, 0);
});
t('gift: only the registry can open a campaign', () => {
  const { names } = buildTable([C(5, '20261130', { sender: 'NQ66 KOTU' }), red({ note: 'nim:lavanta:HIVE100', transactionHash: 'r1' })], opts);
  assert.equal(names.size, 0);
});
t('gift: redemption before the campaign does not count', () => {
  const { names } = buildTable([C(5, '20261130', { blockHeight: 300 }), red({ note: 'nim:lavanta:HIVE100', transactionHash: 'r1', blockHeight: 200 })], opts);
  assert.equal(names.size, 0);
});
t('gift: wrong code falls back to the normal price', () => {
  assert.equal(buildTable([C(), red({ note: 'nim:lavanta:YANLIS1' })], opts).names.size, 0);
  assert.equal(buildTable([C(), red({ note: 'nim:lavanta:YANLIS1', value: 50e5 })], opts).names.size, 1);
});
t('gift: a taken name does not use the quota', () => {
  const { names } = buildTable([C(1), tx({ note: 'nim:lavanta', value: 50e5, blockHeight: 150, transactionHash: 'p1', sender: 'NQ09 ILK' }), red({ note: 'nim:lavanta:HIVE100', transactionHash: 'r1' }), red({ note: 'nim:baskasi:HIVE100', transactionHash: 'r2', blockHeight: 201 })], opts);
  assert.equal(names.get('lavanta').owner, 'NQ09ILK'); assert.equal(names.get('baskasi')?.gift, true);
});
t('gift: failed or pending campaign tx is ignored', () => {
  assert.equal(buildTable([C(5, '20261130', { state: 'pending' }), red({ note: 'nim:lavanta:HIVE100' })], opts).names.size, 0);
});
t('gift: other registry payouts (with other notes) change nothing', () => {
  const before = buildTable([tx({ note: 'nim:mert' })], opts);
  const after = buildTable([tx({ note: 'nim:mert' }), camp({ note: 'Garura Hive odul', transactionHash: 'o1' })], opts);
  assert.deepEqual([...after.names.keys()], [...before.names.keys()]);
});
t('gift: status shows the remaining quota', () => {
  const s = giftStatus([C(3), red({ note: 'nim:lavanta:HIVE100', transactionHash: 'r1' })], opts, 'hive100');
  assert.equal(s.left, 2); assert.equal(giftStatus([C(3)], opts, 'BASKA'), null);
});

t('gift: box is shown only while a campaign is open', () => {
  assert.equal(giftOpen([tx({ note: 'nim:mert' })], opts, DAY), false);
  assert.equal(giftOpen([C(1)], opts, DAY), true);
  assert.equal(giftOpen([C(1), red({ note: 'nim:lavanta:HIVE100', transactionHash: 'r1' })], opts, DAY), false);   // hak bitti
  assert.equal(giftOpen([C(5, '20261114')], opts, DAY), false);                                                      // expired
});

// --- personal gift from the registry
const GIVE = (o) => ({ sender: REG, recipient: 'NQ44 XGY3 JVJT U1X2 XHBS 6852 GMFG TB1M K6X5', value: 1, blockHeight: 100, transactionHash: 'k1', state: 'confirmed', executionResult: true, ...o, data: { raw: hex(o.note) } });
t('personal gift: registry gives a name to an address', () => {
  const { names } = buildTable([GIVE({ note: 'nim:sunset' })], opts);
  assert.equal(names.get('sunset')?.owner, 'NQ44XGY3JVJTU1X2XHBS6852GMFGTB1MK6X5'); assert.equal(names.get('sunset')?.personal, true);
});
t('personal gift: only the registry can give, reserved still blocked, first wins', () => {
  assert.equal(buildTable([GIVE({ note: 'nim:sunset', sender: 'NQ66 KOTU' })], opts).names.size, 0);
  assert.equal(buildTable([GIVE({ note: 'nim:nimiq' })], opts).names.size, 0);
  const { names } = buildTable([tx({ note: 'nim:sunset', value: 50e5, blockHeight: 90, transactionHash: 'p0', sender: 'NQ09 ILK' }), GIVE({ note: 'nim:sunset' })], opts);
  assert.equal(names.get('sunset').owner, 'NQ09ILK');
});
t('registry names itself through the burn address', () => {
  const own = GIVE({ recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000', transactionHash: 'k9', note: 'nim:heylogram' });
  const { names } = buildTable([own], opts);
  assert.equal(names.get('heylogram')?.owner, REG.replace(/\s/g, ''));
  assert.equal(buildTable([{ ...own, sender: 'NQ00 AAAA' }], opts).names.has('heylogram'), false);   // only the registry
  assert.equal(buildTable([{ ...own, note: undefined, data: { raw: Buffer.from('nim:admin').toString('hex') } }], opts).names.has('admin'), false);   // reserved still blocked
});
t('personal gift: payouts without notes change nothing', () => {
  assert.equal(buildTable([GIVE({ note: '' })], opts).names.size, 0);
});
t('personal gift does not use campaign quota', () => {
  const s = giftStatus([C(3), GIVE({ note: 'nim:sunset', blockHeight: 150, transactionHash: 'k2' })], opts, 'HIVE100');
  assert.equal(s.left, 3);
});

// --- alt isim
const OWN = 'NQ01 AAAA';
const parentReg = tx({ note: 'nim:sunset', value: 50e5, blockHeight: 100, transactionHash: 'p1', sender: OWN });
const sub = (note, o = {}) => tx({ note, value: 1, blockHeight: 200, transactionHash: 's' + note.length, sender: OWN, ...o });
const PLAYER = 'NQ39 79PC JM4L N7JR PF8M EASA 7N0T BDFG AL76';
t('sub-name: parsing', () => {
  assert.deepEqual(parseSub(hex('alt:mert.sunset')), { sub: 'mert', parent: 'sunset', name: 'mert.sunset', to: null });
  assert.equal(parseSub(hex(`alt:mert.sunset:${PLAYER.replace(/ /g, '')}`)).to, PLAYER.replace(/ /g, ''));
  assert.equal(parseSub(hex('alt:Mert.sunset')), null);
  assert.equal(parseSub(hex('alt:a.b.c')), null);
  assert.equal(parseSub(hex('alt:mert.sunset:bozuk')), null);
  assert.ok(isValidFullName('mert.sunset') && isValidFullName('sunset') && !isValidFullName('a.b.c') && !isValidFullName('.sunset'));
});
t('sub-name: parent owner gives a sub-name to a player', () => {
  const { names } = buildTable([parentReg, sub(`alt:mert.sunset:${PLAYER.replace(/ /g, '')}`)], opts);
  assert.equal(names.get('mert.sunset')?.owner, PLAYER.replace(/ /g, '')); assert.equal(names.get('mert.sunset')?.parent, 'sunset');
});
t('sub-name: without an address it goes to the parent owner', () => {
  assert.equal(buildTable([parentReg, sub('alt:mert.sunset')], opts).names.get('mert.sunset')?.owner, 'NQ01AAAA');
});
t('sub-name: only the parent owner can give', () => {
  assert.equal(buildTable([parentReg, sub('alt:mert.sunset', { sender: 'NQ66 KOTU' })], opts).names.has('mert.sunset'), false);
});
t('sub-name: parent must exist before', () => {
  assert.equal(buildTable([sub('alt:mert.sunset', { blockHeight: 50 }), { ...parentReg }], opts).names.has('mert.sunset'), false);
  assert.equal(buildTable([sub('alt:mert.yok')], opts).names.size, 0);
});
t('sub-name: first one wins, same name under two parents is fine', () => {
  const other = tx({ note: 'nim:hive1', value: 50e5, blockHeight: 101, transactionHash: 'p2', sender: OWN });
  const { names } = buildTable([parentReg, other, sub('alt:mert.sunset', { transactionHash: 'a1' }), sub(`alt:mert.sunset:${PLAYER.replace(/ /g, '')}`, { transactionHash: 'a2', blockHeight: 201 }), sub('alt:mert.hive1', { transactionHash: 'a3' })], opts);
  assert.equal(names.get('mert.sunset').owner, 'NQ01AAAA'); assert.ok(names.has('mert.hive1'));
});
t('sub-name: top-level names are unaffected', () => {
  const { names } = buildTable([parentReg, sub('alt:mert.sunset'), tx({ note: 'nim:mert', value: 200e5, blockHeight: 300, transactionHash: 'm1', sender: 'NQ77 BASKA' })], opts);
  assert.equal(names.get('mert').owner, 'NQ77BASKA'); assert.equal(names.get('mert.sunset').owner, 'NQ01AAAA');
});

// --- open sub-names (the player claims one)
const ACK = (open, o = {}) => tx({ note: (open ? 'altac:' : 'altkapa:') + 'sunset', value: 1, blockHeight: 150, transactionHash: 'ac' + (open ? 1 : 0), sender: OWN, ...o });
const P2 = 'NQ88 OYUN CUOY UNCU OYUN CUOY UNCU OYUN CUOY';
t('open subs: toggle parsing', () => {
  assert.deepEqual(parseSubToggle(hex('altac:sunset')), { parent: 'sunset', open: true });
  assert.deepEqual(parseSubToggle(hex('altkapa:sunset')), { parent: 'sunset', open: false });
  assert.equal(parseSubToggle(hex('altac:Sunset')), null);
});
t('open subs: closed by default, a player cannot take one', () => {
  assert.equal(buildTable([parentReg, sub('alt:mert.sunset', { sender: P2 })], opts).names.has('mert.sunset'), false);
});
t('open subs: when the owner opens, a player takes one for himself', () => {
  const { names } = buildTable([parentReg, ACK(true), sub('alt:mert.sunset', { sender: P2 })], opts);
  assert.equal(names.get('mert.sunset')?.owner, compact(P2)); assert.equal(names.get('mert.sunset')?.claimed, true);
});
t('open subs: a player cannot give to someone else', () => {
  assert.equal(buildTable([parentReg, ACK(true), sub(`alt:mert.sunset:${PLAYER.replace(/ /g, '')}`, { sender: P2 })], opts).names.has('mert.sunset'), false);
});
t('open subs: only the owner can open, closing stops new claims', () => {
  assert.equal(buildTable([parentReg, ACK(true, { sender: 'NQ66 KOTU' }), sub('alt:mert.sunset', { sender: P2 })], opts).names.has('mert.sunset'), false);
  const { names } = buildTable([parentReg, ACK(true), sub('alt:ilk.sunset', { sender: P2, transactionHash: 'c1', blockHeight: 160 }), ACK(false, { blockHeight: 170 }), sub('alt:ikinci.sunset', { sender: P2, transactionHash: 'c2', blockHeight: 180 })], opts);
  assert.ok(names.has('ilk.sunset')); assert.ok(!names.has('ikinci.sunset'));
});
t('open subs: status', () => {
  assert.equal(subsOpen([parentReg, ACK(true)], opts, 'sunset'), true);
  assert.equal(subsOpen([parentReg, ACK(true), ACK(false, { blockHeight: 170 })], opts, 'sunset'), false);
  assert.equal(subsOpen([parentReg], opts, 'sunset'), false);
});

t('address checksum: a mistyped address gets nothing', () => {
  assert.equal(buildTable([GIVE({ note: 'nim:sunset', recipient: 'NQ44 XGY3 JVJT U1X2 XHBS 6852 GMFG TB1M K6X6' })], opts).names.size, 0);
  assert.equal(buildTable([parentReg, sub('alt:mert.sunset:NQ3979PCJM4LN7JRPF8MEASA7N0TBDFGAL77')], opts).names.has('mert.sunset'), false);
});
t('reverse name: a sub-name given by someone else does not become your name', () => {
  const { primary } = buildTable([parentReg, sub(`alt:dolandirici.sunset:${PLAYER.replace(/ /g, '')}`)], opts);
  assert.equal(primary.get(PLAYER.replace(/ /g, '')), undefined);
  const own = buildTable([parentReg, ACK(true), sub('alt:mert.sunset', { sender: PLAYER })], opts);
  assert.equal(own.primary.get(PLAYER.replace(/ /g, '')), 'mert.sunset');
});
t('reserved words cannot be sub-names', () => {
  assert.equal(buildTable([parentReg, sub('alt:admin.sunset')], opts).names.has('admin.sunset'), false);
});
t('registry branch: an HTLC sender cannot act as the registry', () => {
  assert.equal(buildTable([GIVE({ note: 'nim:sunset', senderType: 'htlc' })], opts).names.size, 0);
  assert.equal(buildTable([GIVE({ note: 'nim:sunset', payer: 'NQ99 BASKA' })], opts).names.size, 0);
});
t('pending creator: a tx whose sender is not resolved yet is skipped', () => {
  assert.equal(buildTable([tx({ note: 'nim:mert', sender: null })], opts).names.size, 0);
});

console.log(`${n} tests passed`);
