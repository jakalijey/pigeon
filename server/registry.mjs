import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { buildTable, isValidName, priceOf, RESERVED } from './rules.mjs';

const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();

export async function createRegistry({ chain, registry, prices, cacheFile, log = console.log }) {
  if (!registry) return { open: false, lookup: () => null, reverse: () => null, info: () => ({ open: false }) };

  const txs = new Map();
  try { for (const t of JSON.parse(readFileSync(cacheFile, 'utf8'))) txs.set(t.transactionHash, t); } catch {}
  let table = { names: new Map(), primary: new Map() };
  const rebuild = () => { table = buildTable([...txs.values()], { registry, prices }); };
  const save = () => {
    try { writeFileSync(cacheFile + '.tmp', JSON.stringify([...txs.values()])); renameSync(cacheFile + '.tmp', cacheFile); } catch (e) { log('registry: cache not saved', e.message); }
  };
  const add = (t) => {
    const old = txs.get(t.transactionHash);
    if (old && old.state === t.state) return false;
    txs.set(t.transactionHash, { transactionHash: t.transactionHash, sender: t.sender, recipient: t.recipient, value: t.value, data: t.data, state: t.state, executionResult: t.executionResult, blockHeight: t.blockHeight, timestamp: t.timestamp });
    return true;
  };

  const since = Math.max(0, ...[...txs.values()].map((t) => t.blockHeight || 0)) - 100;
  for (const t of await chain.history(registry, Math.max(0, since))) add(t);
  rebuild(); save();
  log(`registry: ${table.names.size} names from ${txs.size} transactions`);

  await chain.listen([registry], (t) => {
    if (compact(t.recipient) !== compact(registry)) return;
    if (add(t)) { rebuild(); save(); }
  });

  function lookup(name) {
    if (!isValidName(name)) return { name, invalid: true };
    if (RESERVED.has(name)) return { name, reserved: true };
    const r = table.names.get(name);
    return r ? { name, address: r.owner, since: r.time, height: r.height, tx: r.hash } : { name, free: true, price: priceOf(name, prices) };
  }
  const reverse = (address) => table.primary.get(compact(address)) || null;
  const info = () => ({ open: true, registry, prices, names: table.names.size });

  return { open: true, lookup, reverse, info };
}
