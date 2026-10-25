// Hive DB: a Firestore-like database client for Nimiq apps, one database per .nim name.
// Usage (browser, ES module):
//   import { HiveDB } from 'https://signal.heylogram.tv/kovanapi/hive-db.js';
//   const db = HiveDB('mando');                                   // the database of mando.nim
//   await db.signIn();                                             // signs with Nimiq Pay: the player is known by their own address
//   await db.col('players').doc(db.address).set({ nick: 'ali', gold: 5 });
//   const top10 = await db.col('scores').where('level', '==', 2).orderBy('points', 'desc').limit(10).get();
//   const settings = await db.settings();                          // the owner's signed settings (anyone can read)
//   const me = await db.myName();     // { own: 'mert', sub: 'lale.mando', choice, shown: 'mert.nim' }
//   await db.useName('sub');          // the player picks which name this app shows ('own' or 'sub')
//   const { bees } = await db.bees(); // this cell's bees with the names they chose
//   const o = await db.buy('gold-bee');                 // opens a bill; the money goes straight to the owner
//   await nim.pay(o.to, o.price, o.memo);               // the player pays from their own wallet
//   (await db.orders()).find((x) => x.id === o.id).status   // 'paid' once Hive sees it on chain
//   const owner = await db.owner();                     // the name owner's wallet address (send tips here)
// Older names still work: oyuncuGiris = signIn, ayar = settings, adres = address.
export function HiveDB(name, { api = 'https://signal.heylogram.tv/kovanapi' } = {}) {
  let playerKey = null; const db = { address: null, adres: null };
  const request = async (path, { method = 'GET', body } = {}) => {
    const r = await fetch(api + path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json', ...(playerKey ? { 'x-hive-oyuncu': playerKey } : {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.hata || 'HTTP ' + r.status), { status: r.status, durum: r.status });
    return j;
  };
  db.signIn = async (wallet = globalThis.nimiq) => {
    if (!wallet?.sign) throw new Error('No wallet: open this page in Nimiq Pay');
    const { mesaj } = await request('/api/oyuncu/giris/' + name);
    const s = await wallet.sign(mesaj); if (s?.error) throw new Error(s.error.message || 'Signature declined');
    const r = await request('/api/oyuncu/giris', { method: 'POST', body: { mesaj, publicKey: s.publicKey, signature: s.signature } });
    playerKey = r.anahtar; db.address = db.adres = r.adres; return r.adres;
  };
  db.settings = () => request('/api/ayar/' + name).then((j) => j.ayar || {});
  // Player names in this app: own .nim name and/or a sub-name under it. Shown: the player's choice, else own, else sub.
  const nameOut = (j) => ({ address: j.adres, own: j.kendi, sub: j.alt, choice: j.tercih === 'alt' ? 'sub' : j.tercih === 'kendi' ? 'own' : null, shown: j.gorunen });
  db.myName = (address = db.address) => { if (!address) throw new Error('signIn first'); return request(`/api/ad/${name}/${encodeURIComponent(address)}`).then(nameOut); };
  db.useName = (choice) => request('/api/ad/' + name, { method: 'PUT', body: { tercih: choice === 'sub' ? 'alt' : 'kendi' } }).then(nameOut);
  // Sales: the owner lists products in signed settings ("urunler"). Payment goes straight to the owner's wallet;
  // Hive only opens the bill and watches the chain. Pay with nim.pay(order.to, order.price, order.memo), then poll orders().
  db.products = () => request('/api/urunler/' + name).then((j) => j.urunler.map((u) => ({ id: u.id, name: u.ad, price: u.fiyat, stock: u.stok, left: u.kalan })));
  const orderOut = (s) => ({ id: s.id, product: s.urun, name: s.ad, price: s.fiyat, status: { bekliyor: 'pending', odendi: 'paid', odendi_stok_yok: 'paid_out_of_stock', kismi_odendi: 'partially_paid', suresi_doldu: 'expired' }[s.durum] || s.durum, to: s.to, memo: s.memo, created: s.zaman, payment: s.odeme });
  db.buy = (productId) => request('/api/siparis/' + name, { method: 'POST', body: { urun: productId } }).then(orderOut);
  db.orders = () => request('/api/siparis/' + name).then((j) => j.siparisler.map(orderOut));
  db.owner = () => request('/api/urunler/' + name).then((j) => j.satici || null);   // the wallet that owns this name: tips and prizes go from/to it
  db.bees = () => request('/api/arilar/' + name).then((j) => ({ total: j.toplam, bees: j.arilar.map(nameOut) }));
  db.oyuncuGiris = db.signIn; db.ayar = db.settings;
  db.col = (collection) => {
    const q = { where: [], orderBy: null, dir: 'asc', limit: 50 };
    const query = {
      where(field, op, value) { q.where.push([field, op === 'array-contains' ? 'icerir' : op, value]); return query; },
      orderBy(field, dir = 'asc') { q.orderBy = field; q.dir = dir; return query; },
      limit(n) { q.limit = n; return query; },
      async get() { const p = new URLSearchParams(); for (const [f, o, v] of q.where) p.append('where', `${f},${o},${JSON.stringify(v)}`); if (q.orderBy) { p.set('orderBy', q.orderBy); p.set('yon', q.dir); } p.set('limit', q.limit);
        return (await request(`/api/db/${name}/${collection}?${p}`)).map((d) => ({ ...d.veri, id: d.id })); },
      add: (data) => request(`/api/db/${name}/${collection}`, { method: 'POST', body: data }),
      doc: (id) => ({
        get: () => request(`/api/db/${name}/${collection}/${encodeURIComponent(id)}`).then((d) => d.veri).catch((e) => { if (e.status === 404) return null; throw e; }),
        set: (data) => request(`/api/db/${name}/${collection}/${encodeURIComponent(id)}`, { method: 'PUT', body: data }),
        update: (data) => request(`/api/db/${name}/${collection}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
        delete: () => request(`/api/db/${name}/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      }),
    };
    return query;
  };
  return db;
}
