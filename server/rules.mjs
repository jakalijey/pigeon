export const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
export const RESERVED = new Set(['nim', 'nimiq', 'admin', 'support', 'help', 'official', 'team', 'wallet', 'pay', 'registry', 'root', 'system']);

export function isValidName(name) {
  return typeof name === 'string' && NAME_RE.test(name) && !name.includes('--');
}

export function priceOf(name, table) {
  const n = Math.max(2, Math.min(5, name.length));
  const row = table.find(([len]) => len === n);
  return row ? row[1] : Infinity;
}

export function parseNote(hex) {
  if (!hex) return null;
  let text;
  try { text = Buffer.from(hex, 'hex').toString('utf8'); } catch { return null; }
  const m = /^nim:([a-z0-9-]{1,32})$/.exec(text.trim());
  return m && isValidName(m[1]) ? m[1] : null;
}

const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();

export function registrationsFrom(txs, { registry, prices }) {
  const reg = compact(registry);
  const out = [];
  for (const t of txs) {
    if (compact(t.recipient) !== reg) continue;
    if (t.state !== 'included' && t.state !== 'confirmed') continue;
    if (t.executionResult === false) continue;
    const name = parseNote(t.data?.raw);
    if (!name || RESERVED.has(name)) continue;
    if (t.value < priceOf(name, prices)) continue;
    out.push({ name, owner: compact(t.sender), height: t.blockHeight ?? 0, hash: t.transactionHash, time: t.timestamp ?? 0, paid: t.value });
  }
  return out.sort((a, b) => a.height - b.height || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
}

export function buildTable(txs, opts) {
  const names = new Map();
  const primary = new Map();
  for (const r of registrationsFrom(txs, opts)) {
    if (names.has(r.name)) continue;
    names.set(r.name, r);
    if (!primary.has(r.owner)) primary.set(r.owner, r.name);
  }
  return { names, primary };
}

export function paymentsFor(request, txs) {
  const to = compact(request.to);
  const tag = 'ode:' + request.id;
  const known = new Set(request.payments.map((p) => p.hash));
  const out = [];
  for (const t of txs) {
    if (compact(t.recipient) !== to || known.has(t.transactionHash)) continue;
    if (t.state !== 'included' && t.state !== 'confirmed') continue;
    if (t.executionResult === false) continue;
    let text = '';
    try { text = t.data?.raw ? Buffer.from(t.data.raw, 'hex').toString('utf8').trim() : ''; } catch {}
    if (text !== tag && !text.startsWith(tag + ' ')) continue;
    known.add(t.transactionHash);
    out.push({ from: compact(t.sender), value: t.value, hash: t.transactionHash, height: t.blockHeight, time: t.timestamp });
  }
  return out;
}
