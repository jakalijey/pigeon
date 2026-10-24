import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createChain } from './chain.mjs';
import { createRegistry } from './registry.mjs';
import { paymentsFor, isValidName } from './rules.mjs';

const ROOT = new URL('.', import.meta.url);
const cfgFile = new URL('config.json', ROOT);
const cfg = { port: 5290, host: '127.0.0.1', network: 'MainAlbatross', registry: '', prices: [[2, 1000e5], [3, 500e5], [4, 200e5], [5, 50e5]], data: 'data', web: '../web/dist', ...(existsSync(cfgFile) ? JSON.parse(readFileSync(cfgFile, 'utf8')) : {}) };
if (process.env.NIM_REGISTRY) cfg.registry = process.env.NIM_REGISTRY;
if (process.env.PORT) cfg.port = Number(process.env.PORT);
if (process.env.HOST) cfg.host = process.env.HOST;
if (process.env.DATA_DIR) cfg.data = process.env.DATA_DIR;

const dataDir = cfg.data.startsWith('/') ? pathToFileURL(cfg.data.replace(/\/?$/, '/')) : new URL(cfg.data.replace(/\/?$/, '/'), ROOT);
const webDir = new URL(cfg.web.replace(/\/?$/, '/'), ROOT);
mkdirSync(dataDir, { recursive: true });

const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();
const pretty = (a) => compact(a).replace(/(.{4})/g, '$1 ').trim();
const isAddress = (a) => /^NQ[0-9]{2}[0-9A-Z]{32}$/.test(a);
const note = (t) => { try { return t.data?.raw ? Buffer.from(t.data.raw, 'hex').toString('utf8') : ''; } catch { return ''; } };
const done = (t) => (t.state === 'included' || t.state === 'confirmed') && t.executionResult !== false;
const newId = () => randomBytes(4).toString('hex');

const storeFile = fileURLToPath(new URL('requests.json', dataDir));
const store = existsSync(storeFile) ? JSON.parse(readFileSync(storeFile, 'utf8')) : { requests: {}, splits: {} };
let saveTimer = null;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { writeFileSync(storeFile + '.tmp', JSON.stringify(store)); renameSync(storeFile + '.tmp', storeFile); }, 300); };

let chain = null, registry = null;
const log = (...a) => console.log(new Date().toISOString(), ...a);
(async () => {
  try {
    chain = await createChain({ network: cfg.network, log });
    registry = await createRegistry({ chain, registry: cfg.registry, prices: cfg.prices, cacheFile: fileURLToPath(new URL('registry-cache.json', dataDir)), log });
    log('ready');
  } catch (e) { log('chain failed', e); process.exit(1); }
})();

const cache = new Map();
async function historyOf(address, since, ttl = 5000) {
  const key = address + ':' + since;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.txs;
  const txs = await chain.history(address, since);
  cache.set(key, { at: Date.now(), txs });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return txs;
}

const nameOf = (address) => registry?.reverse(address) || null;

// Nimiq Pay keeps spendable NIM in an HTLC vault the user created (refund address = the user); the plain balance does not show it.
// Scanning history is slow (minutes), so results are kept for 15 min and registered owners are precomputed every 10 min.
const vaultCache = new Map();
// vault results survive restarts: written to disk, read at start (a stale entry answers at once and refreshes in the background)
const vaultFile = fileURLToPath(new URL('vault-cache.json', dataDir));
try { for (const [a, x] of JSON.parse(readFileSync(vaultFile, 'utf8'))) vaultCache.set(a, x); } catch {}
let vaultSaveTimer = null;
const vaultSave = () => { clearTimeout(vaultSaveTimer); vaultSaveTimer = setTimeout(() => { try { writeFileSync(vaultFile + '.tmp', JSON.stringify([...vaultCache])); renameSync(vaultFile + '.tmp', vaultFile); } catch {} }, 2000); };
const vaultBusy = new Map();
async function vaultsOf(a, maxAge = 15 * 60000) {
  const hit = vaultCache.get(a);
  if (hit && Date.now() - hit.at < maxAge) return hit.v;
  // serve a stale entry right away and recompute in the background (the first computation can take minutes)
  if (hit && maxAge > 10 * 60000) { if (!vaultBusy.has(a)) vaultBusy.set(a, vaultsOf(a, 0).catch(() => {}).finally(() => vaultBusy.delete(a))); return hit.v; }
  // with no entry the request does not wait (nginx cuts at 30 s): plain balance now, vaults in the background; the client asks again shortly
  if (!hit && maxAge > 10 * 60000) {
    if (!vaultBusy.has(a)) vaultBusy.set(a, vaultsOf(a, 0).catch(() => {}).finally(() => vaultBusy.delete(a)));
    const value = await chain.balance(pretty(a)).catch(() => 0);
    return { value, vaults: [], total: value, pending: true };
  }
  const txs = await historyOf(pretty(a), 0, 300000);
  const candidates = [...new Set(txs.filter((t) => t.recipientType === 'htlc' && compact(t.sender) === a && t.executionResult !== false && t.state !== 'invalidated' && t.state !== 'expired').map((t) => compact(t.recipient)))].slice(-50);
  const vaults = [];
  for (const v of candidates) {
    const acc = await chain.account(pretty(v)).catch(() => null);
    if (acc?.type === 'htlc' && compact(acc.sender) === a && acc.balance > 0) vaults.push({ address: pretty(v), value: acc.balance, timeout: acc.timeout ?? null });
  }
  const value = await chain.balance(pretty(a));
  const v = { value, vaults, total: value + vaults.reduce((t, x) => t + x.value, 0), at: Date.now() };
  vaultCache.set(a, { at: Date.now(), v });
  vaultSave();
  if (vaultCache.size > 5000) vaultCache.delete(vaultCache.keys().next().value);
  return v;
}
async function warmVaults() {
  if (!chain || !registry) return;
  for (const r of registry.list()) await vaultsOf(compact(r.address), 10 * 60000).catch(() => {});
}
setInterval(() => warmVaults().catch(() => {}), 10 * 60000).unref?.();
setTimeout(() => warmVaults().catch(() => {}), 30000).unref?.();

async function refreshRequest(r) {
  const found = paymentsFor(r, await historyOf(pretty(r.to), Math.max(0, r.height - 5)));
  if (found.length) { r.payments.push(...found); save(); }
}

function view(r) {
  const paid = r.payments.reduce((a, p) => a + p.value, 0);
  const claimed = r.as ? registry.lookup(r.as) : null;
  return { id: r.id, to: pretty(r.to), toName: nameOf(r.to), as: r.as || null, asAddress: claimed?.address ? pretty(claimed.address) : null, value: r.value, note: r.note, created: r.created, split: r.split || null, person: r.person || null, paid, status: paid >= r.value ? 'paid' : paid > 0 ? 'partial' : 'open', payments: r.payments.map((p) => ({ ...p, from: pretty(p.from), fromName: nameOf(p.from) })), memo: ('ode:' + r.id + ' ' + r.note).trim().slice(0, 64) };
}

const hits = new Map();
function limited(ip, max = 30) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 60000);
  h.push(now); hits.set(ip, h);
  if (hits.size > 10000) hits.clear();
  return h.length > max;
}

const HEADERS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST', 'x-content-type-options': 'nosniff' };
const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...HEADERS }); res.end(JSON.stringify(body)); };
const body = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 8192) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });
const text = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
const luna = (v) => { const n = Math.round(Number(v)); return Number.isSafeInteger(n) && n > 0 ? n : 0; };

const STATIC = { '/': 'index.html', '/index.html': 'index.html' };
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', json: 'application/json', webmanifest: 'application/manifest+json' };

http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, HEADERS); return res.end(); }
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
    let m;

    if (p === '/healthz') return send(res, 200, { ok: true, ready: !!(chain && registry) });
    if (p.startsWith('/api/')) {
      if (!chain || !registry) return send(res, 503, { error: 'syncing' });
      if (req.method === 'POST' && limited(ip)) return send(res, 429, { error: 'slow_down' });
      if (req.method === 'GET' && limited(ip + ':g', 600)) return send(res, 429, { error: 'slow_down' });

      if (p === '/api/registry') return send(res, 200, { ...registry.info(), registry: registry.open ? pretty(cfg.registry) : null, head: await chain.head() });
      if (p === '/api/names') return send(res, 200, registry.list().map((r) => ({ ...r, address: pretty(r.address), subs: r.subs.map(pretty) })));

      if (p === '/api/gift') return send(res, 200, { open: !!registry.giftActive?.() });
      if ((m = p.match(/^\/api\/subs\/([a-z0-9-]{1,32})$/))) return send(res, 200, (registry.subsOf?.(m[1]) || []).map((r) => ({ ...r, address: pretty(r.address) })));
      // gift code status: campaign open, slots left, last day (the code itself is never stored)
      if ((m = p.match(/^\/api\/gift\/([A-Za-z0-9-]{4,24})$/))) {
        const g = registry.gift?.(m[1]);
        return send(res, 200, g ? { valid: g.left > 0 && g.until >= Date.now(), left: g.left, until: g.until, minLength: g.minLength } : { valid: false });
      }
      if ((m = p.match(/^\/api\/name\/([^/]{1,64})$/))) {
        const r = registry.lookup(decodeURIComponent(m[1]).toLowerCase().replace(/\.nim$/, ''));
        if (!r) return send(res, 200, { closed: true });
        return send(res, 200, r.address ? { ...r, address: pretty(r.address) } : r);
      }
      if ((m = p.match(/^\/api\/address\/([0-9A-Za-z %]{36,80})$/)) && isAddress(compact(decodeURIComponent(m[1])))) {
        const a = compact(decodeURIComponent(m[1]));
        const acc = await chain.account(pretty(a)).catch(() => null);
        const type = acc?.type || 'basic';
        const creator = type === 'htlc' ? await chain.creatorOf(pretty(a)).catch(() => null) : null;
        return send(res, 200, { name: nameOf(a) || (creator ? nameOf(creator) : null), type, creator: creator ? pretty(creator) : null });
      }
      if ((m = p.match(/^\/api\/balance\/([0-9A-Za-z %]{36,80})$/)) && isAddress(compact(decodeURIComponent(m[1])))) {
        return send(res, 200, { value: await chain.balance(pretty(decodeURIComponent(m[1]))) });
      }
      // a name owner's total NIM: plain balance + the Nimiq Pay vaults they created. Read-only; registered owners are kept warm in the background.
      if ((m = p.match(/^\/api\/vaults\/([0-9A-Za-z %]{36,80})$/)) && isAddress(compact(decodeURIComponent(m[1])))) {
        return send(res, 200, await vaultsOf(compact(decodeURIComponent(m[1]))));
      }
      if ((m = p.match(/^\/api\/incoming\/([0-9A-Za-z %]{36,80})$/)) && isAddress(compact(decodeURIComponent(m[1])))) {
        const a = compact(decodeURIComponent(m[1]));
        const since = Math.max(0, Number(u.searchParams.get('since')) || (await chain.head()) - 60 * 60 * 24 * 7);
        const txs = await historyOf(pretty(a), since, 8000);
        const ok = txs.filter((t) => compact(t.recipient) === a && t.state !== 'invalidated' && t.state !== 'expired' && t.executionResult !== false);
        const rows = await Promise.all(ok.map(async (t) => {
          const owner = t.senderType === 'htlc' ? (await chain.creatorOf(t.sender).catch(() => null)) || compact(t.sender) : compact(t.sender);
          return { from: pretty(owner), fromName: nameOf(owner), value: t.value, note: text(note(t), 64), hash: t.transactionHash, height: t.blockHeight, time: t.timestamp, state: t.state };
        }));
        return send(res, 200, rows);
      }

      if (p === '/api/request' && req.method === 'POST') {
        const b = await body(req);
        const to = compact(b.to), value = luna(b.value);
        if (!isAddress(to) || !value) return send(res, 400, { error: 'invalid' });
        const as = typeof b.as === 'string' && isValidName(b.as) ? b.as : null;
        const r = { id: newId(), to, value, note: text(b.note, 50), as, created: Date.now(), height: await chain.head(), payments: [] };
        store.requests[r.id] = r; save();
        return send(res, 200, view(r));
      }
      if ((m = p.match(/^\/api\/request\/([0-9a-f]{8})$/))) {
        const r = store.requests[m[1]];
        if (!r) return send(res, 404, { error: 'not_found' });
        await refreshRequest(r);
        return send(res, 200, view(r));
      }

      if (p === '/api/split' && req.method === 'POST') {
        const b = await body(req);
        const to = compact(b.to), total = luna(b.value);
        const people = (Array.isArray(b.people) ? b.people : []).map((x) => text(x, 40).trim()).filter(Boolean).slice(0, 20);
        if (!isAddress(to) || !total || !people.length) return send(res, 400, { error: 'invalid' });
        const share = Math.floor(total / (people.length + (b.includeMe ? 1 : 0)));
        if (!share) return send(res, 400, { error: 'invalid' });
        const height = await chain.head();
        const s = { id: newId(), to, total, share, note: text(b.note, 40), created: Date.now(), parts: [] };
        for (const person of people) {
          const r = { id: newId(), to, value: share, note: s.note, created: s.created, height, split: s.id, person, payments: [] };
          store.requests[r.id] = r; s.parts.push(r.id);
        }
        store.splits[s.id] = s; save();
        return send(res, 200, { ...s, to: pretty(to), parts: s.parts.map((id) => view(store.requests[id])) });
      }
      if ((m = p.match(/^\/api\/split\/([0-9a-f]{8})$/))) {
        const s = store.splits[m[1]];
        if (!s) return send(res, 404, { error: 'not_found' });
        for (const id of s.parts) await refreshRequest(store.requests[id]);
        return send(res, 200, { ...s, to: pretty(s.to), parts: s.parts.map((id) => view(store.requests[id])) });
      }
      return send(res, 404, { error: 'not_found' });
    }

    if (p === '/identicons.js') {
      res.writeHead(200, { 'content-type': TYPES.js, 'cache-control': 'public, max-age=86400', ...HEADERS });
      return res.end(readFileSync(new URL('node_modules/@nimiq/identicons/dist/identicons.bundle.min.js', ROOT)));
    }
    const file = STATIC[p] || (/^\/[a-z0-9-]+\.(js|css|svg|png|json|webmanifest)$/.test(p) ? p.slice(1) : (/^\/(r|s|n)\/[0-9a-z-]{1,40}$/.test(p) ? 'index.html' : null));
    let f = file && new URL(file, webDir);
    if (f && !existsSync(f)) f = new URL(file, new URL('public/', webDir));
    if (f && existsSync(f)) {
      res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()] || 'application/octet-stream', 'cache-control': 'no-cache' });
      return res.end(readFileSync(f));
    }
    send(res, 404, { error: 'not_found' });
  } catch (e) {
    log('error', req.url, e.message);
    if (!res.headersSent) send(res, 500, { error: 'server' });
  }
}).listen(cfg.port, cfg.host, () => log(`listening on http://${cfg.host}:${cfg.port}/`));
