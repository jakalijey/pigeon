import { createHash } from 'node:crypto';

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

// Nimiq adresi: "NQ" + 2 denetim hanesi + Nimiq alfabesinde 32 karakter (I, O, W, Z yok) ve IBAN mod-97 denetimi.
export function isAddress(a) {
  const c = compact(a);
  if (!/^NQ[0-9]{2}[0-9A-HJ-NP-VXY]{32}$/.test(c)) return false;
  let r = 0;
  for (const ch of c.slice(4) + c.slice(0, 4)) { const v = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55); for (const d of v) r = (r * 10 + +d) % 97; }
  return r === 1;
}

// Gift code (campaign). The registry writes the code's fingerprint on chain: "hediye:<fp>:<count>:<YYYYMMDD>" (fp = SHA-256(code)[0..16], code upper-case).
// The user sends any amount with "nim:<name>:<code>"; if the campaign is open, has slots left and the name has GIFT_MIN_LEN+ letters, it registers for free.
// The code becomes public on first use; a campaign is "first N people". Plain "nim:<name>" registrations work as before.
export const GIFT_MIN_LEN = 5;
export const giftHash = (code) => createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex').slice(0, 16);
const text = (hex) => { try { return hex ? Buffer.from(hex, 'hex').toString('utf8').trim() : ''; } catch { return ''; } };

export function parseGift(hex) {
  const m = /^hediye:([0-9a-f]{16}):([1-9][0-9]{0,4}):(20[0-9]{2})([01][0-9])([0-3][0-9])$/.exec(text(hex));
  if (!m) return null;
  const until = Date.UTC(+m[3], +m[4] - 1, +m[5], 23, 59, 59, 999);
  return Number.isFinite(until) ? { hash: m[1], count: +m[2], until } : null;
}
export function parseRedeem(hex) {
  const m = /^nim:([a-z0-9-]{1,32}):([A-Za-z0-9-]{4,24})$/.exec(text(hex));
  return m && isValidName(m[1]) ? { name: m[1], code: m[2] } : null;
}

const counts = (t) => (t.state === 'included' || t.state === 'confirmed') && t.executionResult !== false;
const order = (a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0) || (a.transactionHash < b.transactionHash ? -1 : a.transactionHash > b.transactionHash ? 1 : 0);

// Sub-name: the parent owner sends "alt:<sub>.<parent>[:<address>]" → <sub>.<parent> goes to that address (or to the owner if none).
// One level only; the parent must be registered BEFORE the sub-name and the sender must be its owner at that time. The registry can also
// gift a name to an address by sending "nim:<name>" to it (an outgoing transaction with a note; game payouts carry no note).
export const SUB_RE = /^alt:([a-z0-9-]{1,32})\.([a-z0-9-]{1,32})(?::(NQ[0-9]{2}[0-9A-Z]{32}))?$/;
export function parseSub(hex) {
  const m = SUB_RE.exec(text(hex));
  return m && isValidName(m[1]) && isValidName(m[2]) ? { sub: m[1], parent: m[2], name: m[1] + '.' + m[2], to: m[3] || null } : null;
}
// Open sub-names: after the parent owner sends "altac:<parent>", anyone can claim "alt:<sub>.<parent>" for themselves (no address, from their own wallet);
// "altkapa:<parent>" closes it. A game lets players take their username this way. Giving a sub-name to someone else stays the owner's job.
export function parseSubToggle(hex) {
  const m = /^alt(ac|kapa):([a-z0-9-]{1,32})$/.exec(text(hex));
  return m && isValidName(m[2]) ? { parent: m[2], open: m[1] === 'ac' } : null;
}
export const isValidFullName = (n) => { const p = String(n).split('.'); return (p.length === 1 || p.length === 2) && p.every(isValidName); };

// Single pass in block order; campaigns and personal gifts come from the registry's own (plain) outgoing transactions. The FIRST valid registration of a name wins.
// Returns { regs, campaigns (fp -> {count,left,until,height}), openSubs (Set) }. The registry computes it once per rebuild.
export function analyze(txs, { registry, prices }) {
  const reg = compact(registry);
  const campaigns = new Map();               // iz -> { count, left, until, height }
  const owners = new Map();                  // name -> owner (first registration)
  const openSubs = new Set();                // parent names with open sub-names
  const giftUsed = new Set();                // "fp|address": one gift per address per campaign
  const out = [];
  const add = (t, name, owner, extra) => {
    if (owners.has(name)) return false;
    owners.set(name, owner);
    out.push({ name, owner, height: t.blockHeight ?? 0, hash: t.transactionHash, time: t.timestamp ?? 0, paid: t.value, ...extra });
    return true;
  };
  for (const t of [...txs].filter(counts).sort(order)) {
    if (!t.sender) continue;                 // Nimiq Pay vault owner not resolved yet: waiting
    // registry branch: only transactions from the registry's OWN plain account (an HTLC cannot pose as the registry)
    if (compact(t.sender) === reg && compact(t.recipient) !== reg) {
      if (t.senderType === 'htlc' || (t.payer && compact(t.payer) !== reg)) continue;
      const g = parseGift(t.data?.raw);
      if (g) { campaigns.set(g.hash, { count: g.count, left: g.count, until: g.until, height: t.blockHeight ?? 0 }); continue; }
      const given = parseNote(t.data?.raw);  // personal gift from the registry: the recipient owns the name
      if (given && !RESERVED.has(given) && isAddress(t.recipient)) add(t, given, compact(t.recipient), { gift: true, personal: true });
      continue;
    }
    if (compact(t.recipient) !== reg) continue;
    const me = compact(t.sender);
    const name = parseNote(t.data?.raw);
    if (name) {
      if (RESERVED.has(name) || t.value < priceOf(name, prices)) continue;
      add(t, name, me); continue;
    }
    const toggle = parseSubToggle(t.data?.raw);
    if (toggle) {
      if (owners.get(toggle.parent) === me) toggle.open ? openSubs.add(toggle.parent) : openSubs.delete(toggle.parent);
      continue;
    }
    const sub = parseSub(t.data?.raw);
    if (sub) {
      if (RESERVED.has(sub.sub)) continue;
      if (sub.to && !isAddress(sub.to)) continue;
      const owner = owners.get(sub.parent);
      // given to someone else: "given", so it never becomes the recipient's own name (they did not agree to it)
      if (owner === me) add(t, sub.name, sub.to || me, { parent: sub.parent, ...(sub.to && sub.to !== me ? { given: true } : {}) });
      else if (owner && openSubs.has(sub.parent) && (!sub.to || sub.to === me)) add(t, sub.name, me, { parent: sub.parent, claimed: true });
      continue;
    }
    const r = parseRedeem(t.data?.raw);
    if (!r || RESERVED.has(r.name)) continue;
    const h = giftHash(r.code), c = campaigns.get(h);
    const giftOk = c && c.left > 0 && (t.blockHeight ?? 0) > c.height && (t.timestamp ?? 0) <= c.until && r.name.length >= GIFT_MIN_LEN && !owners.has(r.name) && !giftUsed.has(h + '|' + me);
    if (giftOk) { c.left--; giftUsed.add(h + '|' + me); add(t, r.name, me, { gift: true, campaign: h }); continue; }
    // if the code fails, the normal rule applies: it still registers when the payment covers the price
    if (t.value >= priceOf(r.name, prices)) add(t, r.name, me);
  }
  return { regs: out, campaigns, openSubs };
}
export const registrationsFrom = (txs, opts) => analyze(txs, opts).regs;

// Reverse name (an address's own name): only from names it took itself or got as a registry gift; sub-names given by others do not count
export function tableFrom({ regs }) {
  const names = new Map();
  const primary = new Map();
  for (const r of regs) {
    if (names.has(r.name)) continue;
    names.set(r.name, r);
    if (!r.given && !primary.has(r.owner)) primary.set(r.owner, r.name);
  }
  return { names, primary };
}
export const buildTable = (txs, opts) => tableFrom(analyze(txs, opts));

// Is any campaign open (slots left, not expired)? If not, the app hides the gift box
export const giftOpenFrom = ({ campaigns }, now = Date.now()) => [...campaigns.values()].some((c) => c.until >= now && c.left > 0);
export const giftOpen = (txs, opts, now) => giftOpenFrom(analyze(txs, opts), now);
// A campaign's current state (slots left, last day), looked up by fingerprint without the code
export function giftStatusFrom({ campaigns }, code) {
  const c = campaigns.get(giftHash(code));
  return c ? { left: Math.max(0, c.left), until: c.until, minLength: GIFT_MIN_LEN } : null;
}
export const giftStatus = (txs, opts, code) => giftStatusFrom(analyze(txs, opts), code);
// Are this parent's sub-names open right now (latest altac/altkapa)
export const subsOpen = (txs, opts, parent) => analyze(txs, opts).openSubs.has(parent);

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
