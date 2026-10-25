// Nimiq Names SDK: use .nim names in any website or Nimiq Pay mini app.
//
//   <script type="module">
//     import { NimNames } from 'https://signal.heylogram.tv/kovanapi/nim.js';
//     const nim = NimNames({ app: 'mygame' });  // app = your own .nim name (needed only for login)
//
//     await nim.resolve('mando');         // { name: 'mando', address: 'NQ44 …' } or null
//     await nim.nameOf('NQ44 …');         // 'mando' or null (also finds the owner of a Nimiq Pay vault)
//     await nim.price('newname');         // { free: true, price: 50 } in NIM, or { free: false }
//     await nim.login();                  // { address, name, key }: the user signs once; counted as a user of your app
//     await nim.pay('mando', 10, 'hi');   // sends 10 NIM to mando.nim from the user's wallet, with an optional note
//     nim.badge(element, 'NQ44 …');       // shows "mando.nim" (or "mert" + small ".sunset.nim" for a sub-name)
//
//   Sub-names under your app (mert.mygame.nim):
//     await nim.subsOpen();               // true when you let players take their own sub-name
//     await nim.claimSub('mert');         // the PLAYER takes mert.mygame for his own wallet (only while open)
//   Always confirm payments on chain before handing out goods: a wallet answer alone is not proof.
//     await nim.giveSub('mert', 'NQ…');   // YOU (the owner) give mert.mygame to an address or a name.nim
//     nim.badge(el, addr, { format: (l) => l.own, className: 'my-badge' });   // fit the badge to your own UI
//   </script>
//
// Names come from the Pigeon registry on the Nimiq chain. Signing and paying always happen in the user's own
// wallet (Nimiq Pay, or a wallet that provides window.nimiq); this script never sees a key.

const PIGEON = 'https://signal.heylogram.tv/pigeonapi';
const HIVE = 'https://signal.heylogram.tv/kovanapi';
const LUNA = 1e5;
// Same name rule as the server: starts and ends with a letter or digit, single hyphens allowed, no double hyphens
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const isLabel = (x) => LABEL.test(x) && !x.includes('--');
const NAME = { test: (n) => { const p = String(n).split('.'); return (p.length === 1 || p.length === 2) && p.every(isLabel); } };   // a name or a sub-name (mert.sunset)
const APP = { test: (n) => isLabel(String(n)) };
// The Pigeon registry (vault) address is fixed in code, so no server response can redirect a payment elsewhere
const REGISTRY = 'NQ38 H97B FAXR KR9J M2ES UPT0 LDA4 RLUE 0YNK';

const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();
const pretty = (a) => compact(a).replace(/(.{4})/g, '$1 ').trim();
// Nimiq address: its own alphabet (no I, O, W, Z) + IBAN mod-97 checksum, so no payment or name goes to a mistyped address
const isAddress = (a) => {
  const c = compact(a);
  if (!/^NQ[0-9]{2}[0-9A-HJ-NP-VXY]{32}$/.test(c)) return false;
  let r = 0;
  for (const ch of c.slice(4) + c.slice(0, 4)) { const v = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55); for (const d of v) r = (r * 10 + +d) % 97; }
  return r === 1;
};
const clean = (n) => String(n || '').trim().toLowerCase().replace(/\.nim$/, '');

// Wallet: Nimiq Pay injects window.nimiq. Inside a heylogram.com code site the page runs in a frame and
// reaches the wallet through the parent page ('hl-nimiq' bridge).
// The bridge only trusts answers from a heylogram.com code-site frame (no other page can pretend to be the wallet)
const TRUSTED_PARENT = /^https:\/\/([a-z0-9-]+\.)*heylogram\.com$/;
function frameBridge() {
  let seq = 0;
  const waiting = new Map();
  addEventListener('message', (e) => {
    const v = e.data;
    if (e.source !== window.parent || !TRUSTED_PARENT.test(e.origin) || v?.tur !== 'hl-nimiq' || v.islem !== 'sonuc') return;
    const w = waiting.get(v.id); if (!w) return; waiting.delete(v.id);
    v.ok ? w.ok(v.sonuc) : w.no(Object.assign(new Error(v.hata?.mesaj || 'wallet error'), { code: v.hata?.kod }));
  });
  const call = (method, args) => new Promise((ok, no) => {
    const id = ++seq; waiting.set(id, { ok, no });
    setTimeout(() => { if (waiting.delete(id)) no(Object.assign(new Error('wallet timeout'), { code: 'timeout' })); }, 180000);
    window.parent.postMessage({ tur: 'hl-nimiq', islem: 'cagir', id, yontem: method, args }, '*');
  });
  const provider = {
    listAccounts: () => call('listAccounts', []),
    sign: (m) => call('sign', [m]),
    sendBasicTransaction: (tx) => call('sendBasicTransaction', [tx]),
    sendBasicTransactionWithData: (tx) => call('sendBasicTransactionWithData', [tx]),
  };
  return (wait) => new Promise((resolve) => {
    const ask = () => window.parent.postMessage({ tur: 'hl-nimiq', islem: 'sor' }, '*');
    const on = (e) => {
      const v = e.data;
      if (e.source !== window.parent || !TRUSTED_PARENT.test(e.origin) || v?.tur !== 'hl-nimiq' || v.islem !== 'durum') return;
      removeEventListener('message', on); clearInterval(again); clearTimeout(stop);
      resolve(v.var ? provider : null);
    };
    addEventListener('message', on);
    const again = setInterval(ask, 500);
    const stop = setTimeout(() => { removeEventListener('message', on); clearInterval(again); resolve(null); }, wait);
    ask();
  });
}

export function NimNames({ app = null, pigeon = PIGEON, hive = HIVE, cacheMs = 60000, registry = REGISTRY } = {}) {
  if (app != null && !APP.test(clean(app))) throw new Error('app must be your .nim name, e.g. "mygame"');
  app = app == null ? null : clean(app);
  const cache = new Map();
  const cached = async (key, load) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < cacheMs) return hit.v;
    const v = await load(); cache.set(key, { t: Date.now(), v }); return v;
  };
  const get = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
    return r.json();
  };

  const inFrame = typeof window !== 'undefined' && window.parent !== window;
  let bridge = null, found = null;
  async function wallet(wait = 2500) {
    if (typeof window === 'undefined') return null;
    if (window.nimiq) return window.nimiq;
    if (inFrame) return (found ||= (bridge ||= frameBridge())(12000).then((p) => p || (found = null)));
    const until = Date.now() + wait;
    while (Date.now() < until) { await new Promise((ok) => setTimeout(ok, 50)); if (window.nimiq) return window.nimiq; }
    return null;
  }
  const needWallet = async () => {
    const p = await wallet();
    if (!p) throw Object.assign(new Error('Open this page in Nimiq Pay or a Nimiq wallet'), { code: 'no_wallet' });
    return p;
  };

  const registryAddress = async () => { if (!isAddress(registry)) throw new Error('registry address is not valid'); return pretty(registry); };

  const nim = {
    async resolve(name) {
      const n = clean(name); if (!NAME.test(n)) return null;
      return cached('n:' + n, async () => {
        const r = await get(`${pigeon}/api/name/${encodeURIComponent(n)}`);
        return r?.address ? { name: r.name, address: pretty(r.address) } : null;
      });
    },
    async nameOf(address) {
      if (!isAddress(address)) return null;
      const a = compact(address);
      return cached('a:' + a, async () => (await get(`${pigeon}/api/address/${a}`))?.name || null);
    },
    async price(name) {
      const n = clean(name); if (!NAME.test(n)) return { free: false };
      const r = await get(`${pigeon}/api/name/${encodeURIComponent(n)}`);
      return r?.free ? { free: true, price: Number(r.price) / LUNA } : { free: false };
    },
    async login() {
      if (!app) throw new Error('login needs { app: "<your .nim name>" }');
      const p = await needWallet();
      const { mesaj } = await get(`${hive}/api/oyuncu/giris/${app}`);
      const s = await p.sign(mesaj);
      if (s?.error) throw new Error(s.error.message || 'signature rejected');
      const r = await fetch(`${hive}/api/oyuncu/giris`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mesaj, publicKey: s.publicKey, signature: s.signature }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.hata || 'login failed');
      const address = pretty(j.adres);
      return { address, name: await nim.nameOf(address).catch(() => null), key: j.anahtar };
    },
    async pay(to, amountNim, note = '') {
      const value = Math.round(Number(amountNim) * LUNA);
      if (!Number.isFinite(value) || value <= 0) throw new Error('amount must be a positive number of NIM');
      const recipient = isAddress(to) ? pretty(to) : (await nim.resolve(to))?.address;
      if (!recipient) throw Object.assign(new Error('unknown name: ' + to), { code: 'unknown_name' });
      const p = await needWallet();
      const tx = { recipient, value, fee: 0 };
      // the chain keeps at most 64 bytes of note; cut on a character boundary
      let data = String(note || ''); while (new TextEncoder().encode(data).length > 64) data = data.slice(0, -1);
      const r = await (data ? p.sendBasicTransactionWithData({ ...tx, data }) : p.sendBasicTransaction(tx));
      if (r?.error) throw new Error(r.error.message || 'payment rejected');   // some wallets return { error } instead of throwing
      return r;
    },
    // Display rule: the user's own name large, the parent name small (mert · .sunset.nim); the full name goes in title
    label(name) {
      const n = clean(name); if (!NAME.test(n)) return null;
      const [own, parent] = n.split('.');
      return { own, parent: parent ? parent + '.nim' : null, full: n + '.nim' };
    },
    // options.format(label) → your own text (e.g. l => l.own); options.className → your own style; options.small === false → hide the parent name
    async badge(el, address, options = {}) {
      if (!el) return null;
      const name = await nim.nameOf(address).catch(() => null);
      const l = name && nim.label(name);
      if (l) {
        if (typeof options.format === 'function') el.textContent = String(options.format(l) ?? '');
        else {
          el.textContent = l.parent ? l.own : l.full;
          if (l.parent && options.small !== false && el.ownerDocument) { const small = el.ownerDocument.createElement('small'); small.textContent = '.' + l.parent; small.style.opacity = '.6'; small.style.fontSize = '.8em'; el.appendChild(small); }
        }
        if (options.className && el.classList) el.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
        el.title = l.full + ' · ' + pretty(address); el.dataset.nim = name;
      }
      return name;
    },
    // Both names a player may have in your app: own = their own .nim (Pigeon's primary name), sub = their name under app.
    // Which one to show is the player's choice; HiveDB keeps it per app (db.myName / db.useName).
    async names(address) {
      if (!isAddress(address)) return { own: null, sub: null };
      const a = compact(address);
      const subs = app ? await get(`${pigeon}/api/subs/${encodeURIComponent(app)}`).catch(() => []) : [];
      const sub = (Array.isArray(subs) ? subs : []).find((s) => compact(s.address) === a)?.name || null;
      return { own: await nim.nameOf(a).catch(() => null), sub };
    },
    async subsOpen() {
      if (!app) throw new Error('subsOpen needs { app: "<your .nim name>" }');
      return !!(await get(`${pigeon}/api/name/${encodeURIComponent(app)}`))?.subsOpen;
    },
    // The player claims <sub>.<app> to their own wallet: 1 luna to the vault + "alt:<sub>.<app>" (Pigeon rule: only valid if the owner opened sub-names)
    async claimSub(sub) {
      if (!app) throw new Error('claimSub needs { app: "<your .nim name>" }');
      const s2 = clean(sub);
      if (!APP.test(s2)) throw Object.assign(new Error('sub-name: letters, digits and dashes'), { code: 'bad_name' });
      if (s2.length + app.length > 22) throw Object.assign(new Error('sub-name too long for this app'), { code: 'too_long' });
      const r = await get(`${pigeon}/api/name/${encodeURIComponent(s2 + '.' + app)}`);
      if (r?.address) throw Object.assign(new Error('already taken'), { code: 'taken' });
      if (!r?.open) throw Object.assign(new Error('this app has not opened sub-names'), { code: 'subs_closed' });
      const reg = await registryAddress();
      const p = await needWallet();
      return p.sendBasicTransactionWithData({ recipient: reg, value: 1, fee: 0, data: `alt:${s2}.${app}` });
    },
    // The OWNER gives <sub>.<app> to an address or to a name.nim
    async giveSub(sub, to) {
      if (!app) throw new Error('giveSub needs { app: "<your .nim name>" }');
      const s2 = clean(sub);
      if (!APP.test(s2)) throw Object.assign(new Error('sub-name: letters, digits and dashes'), { code: 'bad_name' });
      if (s2.length + app.length > 22) throw Object.assign(new Error('sub-name too long for this app'), { code: 'too_long' });
      const addr = isAddress(to) ? compact(to) : compact((await nim.resolve(to))?.address);
      if (!isAddress(addr)) throw Object.assign(new Error('unknown address or name: ' + to), { code: 'unknown_name' });
      const r = await get(`${pigeon}/api/name/${encodeURIComponent(s2 + '.' + app)}`);
      if (r?.address) throw Object.assign(new Error('already taken'), { code: 'taken' });
      const reg = await registryAddress();
      const p = await needWallet();
      return p.sendBasicTransactionWithData({ recipient: reg, value: 1, fee: 0, data: `alt:${s2}.${app}:${addr}` });
    },
    wallet,
  };
  return nim;
}
