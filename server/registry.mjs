import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { analyze, tableFrom, giftOpenFrom, giftStatusFrom, isValidName, isValidFullName, priceOf, RESERVED } from './rules.mjs';

const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();

export async function createRegistry({ chain, registry, prices, cacheFile, log = console.log }) {
  if (!registry) return { open: false, lookup: () => null, reverse: () => null, info: () => ({ open: false }), list: () => [] };

  const txs = new Map();
  try { for (const t of JSON.parse(readFileSync(cacheFile, 'utf8'))) txs.set(t.transactionHash, t); } catch {}

  // The table is rebuilt ONCE when new transactions arrive; requests only read the prepared result (no full scan per request)
  let state = { table: { names: new Map(), primary: new Map() }, meta: { campaigns: new Map(), openSubs: new Set() }, top: [], subs: new Map() };
  const rebuild = () => {
    const meta = analyze([...txs.values()], { registry, prices });
    const table = tableFrom(meta);
    const top = [...table.names.keys()].filter((k) => !k.includes('.'));
    const subs = new Map();                   // parent name -> sub-name records
    for (const r of table.names.values()) if (r.parent) { if (!subs.has(r.parent)) subs.set(r.parent, []); subs.get(r.parent).push(r); }
    state = { table, meta, top, subs };
  };
  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);                  // art arda gelen olaylarda diske tek seferde yaz
    saveTimer = setTimeout(() => {
      try { writeFileSync(cacheFile + '.tmp', JSON.stringify([...txs.values()])); renameSync(cacheFile + '.tmp', cacheFile); } catch (e) { log('registry: cache not saved', e.message); }
    }, 1500);
  };

  // A payment from a Nimiq Pay vault (HTLC) belongs to the address that created the vault. If that cannot be resolved yet the transaction WAITS (sender null)
  // and is retried later; a name is never given to an HTLC address (nobody can sign for it, the name would be locked forever).
  const add = async (t) => {
    const old = txs.get(t.transactionHash);
    if (old && old.state === t.state && 'payer' in old && old.sender) return false;
    let sender = t.sender;
    if (t.senderType === 'htlc') sender = (await chain.creatorOf(t.sender).catch(() => null)) || null;
    txs.set(t.transactionHash, { transactionHash: t.transactionHash, sender, payer: t.sender, senderType: t.senderType, recipient: t.recipient, value: t.value, data: t.data, state: t.state, executionResult: t.executionResult, blockHeight: t.blockHeight, timestamp: t.timestamp });
    return true;
  };
  const retryPending = async () => {
    let changed = false;
    for (const t of txs.values()) {
      if (t.sender || t.senderType !== 'htlc') continue;
      const c = await chain.creatorOf(t.payer).catch(() => null);
      if (c) { t.sender = c; changed = true; }
    }
    if (changed) { rebuild(); save(); }
  };

  for (const t of await chain.history(registry, 0)) await add(t);
  // old cache entries that stored the HTLC address as owner (sender === payer) are resolved again
  for (const t of txs.values()) if (t.senderType === 'htlc' && t.sender && compact(t.sender) === compact(t.payer)) t.sender = null;
  await retryPending();
  rebuild(); save();
  log(`registry: ${state.table.names.size} names from ${txs.size} transactions`);
  setInterval(() => retryPending().catch(() => {}), 120000).unref?.();

  await chain.listen([registry], (t) => {
    // payments to the registry (registrations) and its own outgoing ones (gift campaigns, personal gifts)
    if (compact(t.recipient) !== compact(registry) && compact(t.sender) !== compact(registry)) return;
    add(t).then((changed) => { if (changed) { rebuild(); save(); } });
  });

  function lookup(name) {
    const { table, meta, top } = state;
    // sub-name (mert.sunset): only the parent owner gives one (or a player claims one when the owner opened them)
    if (name.includes('.')) {
      if (!isValidFullName(name)) return { name, invalid: true };
      const r = table.names.get(name), parent = name.split('.')[1], p = table.names.get(parent);
      if (r) return { name, address: r.owner, since: r.time, height: r.height, tx: r.hash, parent };
      return { name, sub: true, parent, parentOwner: p ? p.owner : null, open: !!p && meta.openSubs.has(parent) };
    }
    if (!isValidName(name)) return { name, invalid: true };
    if (RESERVED.has(name)) return { name, reserved: true };
    const r = table.names.get(name);
    return r ? { name, address: r.owner, since: r.time, height: r.height, tx: r.hash, index: top.indexOf(name) + 1, subsOpen: meta.openSubs.has(name) } : { name, free: true, price: priceOf(name, prices) };
  }
  const reverse = (address) => state.table.primary.get(compact(address)) || null;
  const info = () => ({ open: true, registry, prices, names: state.table.names.size });
  // The hive map shows parent names only, in order; sub-names are users of their parent (subs = unique sub-name owners)
  const subsOf = (parent) => (state.subs.get(parent) || []).map((r) => ({ name: r.name, address: r.owner, height: r.height, time: r.time }));
  const list = () => state.top.map((name, i) => { const r = state.table.names.get(name); return { name, address: r.owner, height: r.height, time: r.time, index: i + 1, subs: [...new Set((state.subs.get(name) || []).map((x) => x.owner))].slice(0, 10000) }; });

  const gift = (code) => giftStatusFrom(state.meta, code);
  const giftActive = () => giftOpenFrom(state.meta);

  return { open: true, lookup, reverse, info, list, subsOf, gift, giftActive };
}
