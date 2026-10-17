import assert from 'node:assert/strict';
import { buildTable, parseNote, priceOf, isValidName, paymentsFor } from './rules.mjs';

const REG = 'NQ31 7GP4 BBVA MCYB D6DG JU0N E1YH RFQ2 G5DB';
const PRICES = [[2, 1000e5], [3, 500e5], [4, 200e5], [5, 50e5]];
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
console.log(`${n} tests passed`);
