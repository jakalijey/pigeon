import assert from 'node:assert/strict';
import { vaultOwner, vaultOwnerFromCreation, findVaults } from './vaults.mjs';

const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();
const pretty = (a) => compact(a);
const USER = 'NQ11 USER';
const OTHER = 'NQ22 OTHER';
const PAY = 'NQ33 PAYSIGNER';
const ok = { state: 'confirmed', executionResult: true };
const htlcData = (sender) => ({ type: 'htlc', sender, recipient: PAY, hashAlgorithm: 'blake2b', hashRoot: '00', hashCount: 1, timeout: 0 });
// vault creation: from the user (top-up) or from an older vault (Pay extends it); the refund address is always the user
const create = (from, fromType, vault, owner) => ({ ...ok, sender: from, senderType: fromType, recipient: vault, recipientType: 'htlc', value: 100, data: htlcData(owner) });
const drain = (vault, to) => ({ ...ok, sender: vault, senderType: 'htlc', recipient: to, recipientType: 'basic', value: 100, data: { type: 'raw', raw: '' } });

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

function fakeChain(history, accounts) {
  return {
    historyOf: async (a) => history[compact(a)] || [],
    account: async (a) => accounts[compact(a)] || { type: 'basic', balance: 0 },
    compact, pretty,
  };
}

await t('owner of a vault the user created is the user', async () => {
  const txs = [create(USER, 'basic', 'NQ44 V1', USER)];
  assert.equal(vaultOwner(txs, compact('NQ44 V1'), compact), compact(USER));
});

await t('owner of an extended vault is the user, not the old vault', async () => {
  const txs = [create('NQ44 V1', 'htlc', 'NQ55 V2', USER)];
  assert.equal(vaultOwner(txs, compact('NQ55 V2'), compact), compact(USER));
});

await t('an HTLC address is never returned as owner', async () => {
  const noData = { ...create('NQ44 V1', 'htlc', 'NQ55 V2', USER), data: { type: 'raw', raw: '' } };
  assert.equal(vaultOwner([noData], compact('NQ55 V2'), compact), null);
  assert.equal(vaultOwnerFromCreation(drain('NQ44 V1', USER), compact), null);
});

await t('vault created directly by the user is found', async () => {
  const c = fakeChain({ [compact(USER)]: [create(USER, 'basic', 'NQ44 V1', USER)] },
    { [compact('NQ44 V1')]: { type: 'htlc', sender: USER, balance: 500, timeout: 9 } });
  const v = await findVaults(compact(USER), c);
  assert.deepEqual(v.map((x) => [x.address, x.value]), [[compact('NQ44 V1'), 500]]);
});

await t('vault extended twice is followed to the live one', async () => {
  const c = fakeChain({
    [compact(USER)]: [create(USER, 'basic', 'NQ44 V1', USER)],
    [compact('NQ44 V1')]: [create(USER, 'basic', 'NQ44 V1', USER), create('NQ44 V1', 'htlc', 'NQ55 V2', USER)],
    [compact('NQ55 V2')]: [create('NQ44 V1', 'htlc', 'NQ55 V2', USER), create('NQ55 V2', 'htlc', 'NQ66 V3', USER)],
  }, { [compact('NQ66 V3')]: { type: 'htlc', sender: USER, balance: 700, timeout: 9 } });
  const v = await findVaults(compact(USER), c);
  assert.deepEqual(v.map((x) => [x.address, x.value]), [[compact('NQ66 V3'), 700]]);
});

await t('a vault paid back to the user (top-up) is not counted', async () => {
  const c = fakeChain({
    [compact(USER)]: [create(USER, 'basic', 'NQ44 V1', USER), drain('NQ44 V1', USER), create(USER, 'basic', 'NQ77 V4', USER)],
    [compact('NQ44 V1')]: [create(USER, 'basic', 'NQ44 V1', USER), drain('NQ44 V1', USER)],
  }, { [compact('NQ77 V4')]: { type: 'htlc', sender: USER, balance: 300, timeout: 9 } });
  const v = await findVaults(compact(USER), c);
  assert.deepEqual(v.map((x) => [x.address, x.value]), [[compact('NQ77 V4'), 300]]);
});

await t('a vault moved into a vault of someone else is not counted', async () => {
  const c = fakeChain({
    [compact(USER)]: [create(USER, 'basic', 'NQ44 V1', USER)],
    [compact('NQ44 V1')]: [create(USER, 'basic', 'NQ44 V1', USER), create('NQ44 V1', 'htlc', 'NQ88 X', OTHER)],
  }, { [compact('NQ88 X')]: { type: 'htlc', sender: OTHER, balance: 900, timeout: 9 } });
  const v = await findVaults(compact(USER), c);
  assert.deepEqual(v, []);
});

await t('the work is bounded', async () => {
  const history = { [compact(USER)]: [create(USER, 'basic', 'NQ0 V0', USER)] };
  for (let i = 0; i < 100; i++) history[compact('NQ0 V' + i)] = [create('NQ0 V' + i, 'htlc', 'NQ0 V' + (i + 1), USER)];
  let calls = 0;
  const c = fakeChain(history, {});
  const counted = { ...c, account: async (a) => { calls++; return c.account(a); }, maxReads: 10 };
  await findVaults(compact(USER), counted);
  assert.ok(calls <= 10, 'reads stop at maxReads');
});

console.log(`${n} tests passed`);
