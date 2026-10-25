import { perched, flying, logo, postmark } from './pigeon.js?v=2';
import { playSplash } from './splash.js?v=2';
import { playEvent } from './events.js?v=3';
import qrcode from 'qrcode-generator';
import { ring } from './ring.js?v=1';

const host = window.nimiqPay?.language || navigator.language || 'en';
const pickLang = (l) => (String(l || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
let lang = pickLang(host);
document.documentElement.lang = lang;

const TEXTS = {
  en: {
    app: 'Pigeon', tagline: 'Nimiq’s new form', send: 'Send', request: 'Request', split: 'Split', ring: 'Get ring',
    noRing: 'No ring yet', letters: 'Letters for you', noLetters: 'No letters this week.',
    openInPay: 'Open this app in Nimiq Pay to send and receive.', retry: 'Try again', flyHome: 'Pigeon flies inside the Nimiq Pay wallet.', scanQr: 'Scan with your phone and Pigeon opens in Nimiq Pay.', openPay: 'Open in Nimiq Pay', noPay: 'No Nimiq Pay yet?', connecting: 'Reaching the Nimiq network…', walletWait: 'Connecting to Nimiq Pay…',
    write: 'Write a letter', to: 'TO', toHint: 'name.nim or NQ address', ringOk: 'Ring matches', plain: 'Plain address, no ring', noName: 'Nobody wears this ring', moved: 'Wallet vault address: sending to its owner’s wallet',
    stampHint: 'The picture on the stamp belongs to this address. Check it matches the one on your friend’s screen.',
    recent: 'Recent', alike: (n) => `Looks like ${n}.nim — check the picture`,
    notePh: 'Add a note', noteHint: 'The note is written on chain. Anyone can read it.', seal: 'Seal and fly', sending: 'Waiting for your wallet…',
    delivered: 'DELIVERED · NIMIQ POST · ', note: 'Note', fee: 'Fee', tx: 'Transaction', share: 'Share', done: 'Done',
    tie: 'Tie a note to its leg', amount: 'AMOUNT', what: 'WHAT FOR', create: 'Tie the note',
    reqHint: 'Whoever gets the link sees your pigeon at their window. When they pay, it flies back to you.',
    copy: 'Copy', copied: 'Copied', waiting: 'Waiting', paid: 'Paid', partial: 'Part paid', atWindow: 'Pigeon at the window', back: 'Back to you',
    splitT: 'Split the letter', people: 'WHO PAYS', addPerson: 'name.nim or a name', add: 'Add', includeMe: 'I pay a share too', splitIt: 'Tear into stamps',
    stampsOf: (n, s, k) => `${n} stamps · ${s} NIM each · ${k}/${n} stamped`, nudge: 'Remind', splitHint: 'Every person who pays gets a postmark on their stamp. When all are stamped, the letter is complete.',
    paidMark: 'PAID · PAID · ', sentYou: 'sent you a letter', ringIs: (n) => `Ring matches ${n}`, noRingWarn: 'No ring. Check the address with them.',
    notNow: 'Not now', pay: 'Pay', alreadyPaid: 'This letter is already paid.',
    fakeT: (n) => `This pigeon is not ${n}.nim`, fakeP: (n) => `The letter claims to come from <b>${n}</b>, but its ring belongs to another address.`,
    should: 'Should be', arrived: 'Arrived', noMatch: 'ring does not match', blocked: 'Payment blocked', fakeHint: 'Ask them another way. The pigeon was sent back.', goBack: 'Go back',
    ringT: 'Get your pigeon a ring', free: 'This ring is free', taken: (a) => `Taken by ${a}`, reserved: 'Reserved', invalid: 'Letters, digits and single dashes only',
    price: 'Engraving', forever: 'Duration', foreverV: 'Forever', how: 'How', howV: 'Note', rule: 'Rule', ruleV: 'First on chain wins',
    ringHint: 'With a ring your friends find you by name, and your pigeon always lands at the right window.',
    hiveT: (n) => `${n}.nim has a cell in Hive`, hiveS: 'Your site and domain, a shop, a QR till for your counter, tips.',
    subOpenOn: 'Players can take their own sub-ring: ON', subOpenOff: 'Players can take their own sub-ring: OFF', subOpenHint: 'When on, your app can let each player take name.yours.nim for their own wallet. First come, first served. You can turn it off any time.', subOpenSent: 'Sent; it changes in a few seconds',
    subQ: (p) => `Give sub-rings under ${p}.nim`, subPh: 'name', subTo: 'Address or name.nim (empty = you)', subGive: (n) => `Give ${n}`, subLong: 'Too long: name + your name must be 22 letters or less', subTaken: 'Already taken', subBadTo: 'Address or name not found', subDone: (n) => `${n} is on its way`, subList: 'Given sub-rings', subNone: 'None yet',
    giftQ: 'Have a gift code?', giftPh: 'GIFT CODE', giftOk: (n) => `Gift code works: free (${n} left)`, giftBad: 'This code is not valid or has run out', giftShort: 'Gift codes work for names with 5 or more letters', giftFree: 'free',
    engrave: 'Engrave the ring', engraving: 'Engraving on chain…', yours: 'The ring is yours', closed: 'Ring registry opens soon', mine: 'Your rings',
    evSent: 'Sent', evSentSub: (n) => `on its way to ${n}`, evGot: 'Received', evGotSub: (n) => `from ${n}`, evPaid: 'Paid', evPaidSub: (n) => `${n} paid your request`,
    evSplit: (k, n) => `${k} of ${n} paid`, evSplitWait: (n) => `${n}’s stamp is waiting`, evSplitAll: 'Every stamp is in', evRingSub: (n) => `you are ${n} now`, paidWord: 'PAID',
    rejected: 'Cancelled in the wallet', failed: 'Something went wrong', notFound: 'Not found', tooLong: 'Note too long',
  },
  tr: {
    app: 'Güvercin', tagline: 'Nimiq’in yeni formu', send: 'Gönder', request: 'İste', split: 'Böl', ring: 'Halka al',
    noRing: 'Henüz halka yok', letters: 'Sana gelen mektuplar', noLetters: 'Bu hafta mektup yok.',
    openInPay: 'Gönderip almak için bu uygulamayı Nimiq Pay içinde aç.', retry: 'Tekrar dene', flyHome: 'Güvercin, Nimiq Pay cüzdanının içinde uçar.', scanQr: 'Telefonunla okut, Güvercin Nimiq Pay’de açılsın.', openPay: 'Nimiq Pay’de aç', noPay: 'Nimiq Pay yok mu?', connecting: 'Nimiq ağına bağlanılıyor…', walletWait: 'Nimiq Pay’e bağlanılıyor…',
    write: 'Mektup yaz', to: 'KİME', toHint: 'isim.nim ya da NQ adresi', ringOk: 'Halkası tutuyor', plain: 'Düz adres, halkası yok', noName: 'Bu halkayı takan yok', moved: 'Cüzdan kasası adresi: sahibinin cüzdanına gidecek',
    stampHint: 'Puldaki resim bu adrese özel. Arkadaşının ekranındakiyle aynı mı, bir bak.',
    recent: 'Son kişiler', alike: (n) => `${n}.nim ile çok benziyor — resme bir bak`,
    notePh: 'Bir not ekle', noteHint: 'Not zincire yazılır, herkes görebilir.', seal: 'Mühürle ve uçur', sending: 'Cüzdanın onayı bekleniyor…',
    delivered: 'ULAŞTI · NIMIQ POSTASI · ', note: 'Not', fee: 'Ücret', tx: 'İşlem', share: 'Paylaş', done: 'Tamam',
    tie: 'Ayağına not bağla', amount: 'TUTAR', what: 'NE İÇİN', create: 'Notu bağla',
    reqHint: 'Linki kime yollarsan güvercin onun penceresine konar. Ödeyince sana döner.',
    copy: 'Kopyala', copied: 'Kopyalandı', waiting: 'Bekliyor', paid: 'Ödendi', partial: 'Kısmen', atWindow: 'Güvercin pencerede', back: 'Sana döndü',
    splitT: 'Mektubu böl', people: 'KİMLER ÖDER', addPerson: 'isim.nim ya da bir ad', add: 'Ekle', includeMe: 'Ben de pay ödüyorum', splitIt: 'Pullara ayır',
    stampsOf: (n, s, k) => `${n} pul · kişi başı ${s} NIM · ${k}/${n} damgalandı`, nudge: 'Hatırlat', splitHint: 'Ödeyen her kişinin pulu damgalanır. Hepsi damgalanınca mektup tamamlanır.',
    paidMark: 'ÖDENDİ · ÖDENDİ · ', sentYou: 'sana mektup yolladı', ringIs: (n) => `Halkası ${n} ile eşleşiyor`, noRingWarn: 'Halkası yok. Adresi kişiyle kontrol et.',
    notNow: 'Şimdi değil', pay: 'öde', alreadyPaid: 'Bu mektup zaten ödendi.',
    fakeT: (n) => `Bu güvercinin halkası ${n}.nim değil`, fakeP: (n) => `Mektup <b>${n}</b> adına geliyor ama güvercinin halkası başka bir adrese ait.`,
    should: 'Olması gereken', arrived: 'Gelen güvercin', noMatch: 'halka tutmuyor', blocked: 'Ödeme kapatıldı', fakeHint: 'Kişiye başka bir yoldan sor. Güvercin geri gönderildi.', goBack: 'Geri dön',
    ringT: 'Güvercinine halka taktır', free: 'Bu halka boşta', taken: (a) => `${a} takıyor`, reserved: 'Ayrılmış', invalid: 'Yalnız harf, rakam ve tek tire',
    price: 'Kazıma ücreti', forever: 'Süre', foreverV: 'Süresiz', how: 'Nasıl', howV: 'Nota', rule: 'Kural', ruleV: 'Zincirde ilk yazan alır',
    ringHint: 'Halka takılınca arkadaşların seni isminle bulur; güvercinin hep doğru pencereye konar.',
    hiveT: (n) => `${n}.nim için Hive'da peteğin var`, hiveS: 'Siten ve alan adın, dükkânın, tezgâh için QR kasa, bahşiş.',
    subOpenOn: 'Oyuncular kendi alt halkasını alabilir: AÇIK', subOpenOff: 'Oyuncular kendi alt halkasını alabilir: KAPALI', subOpenHint: 'Açıkken uygulaman her oyuncuya isim.senin.nim halkasını kendi cüzdanına aldırabilir. İlk alan kazanır. İstediğin zaman kapatırsın.', subOpenSent: 'Gönderildi; birkaç saniyede değişir',
    subQ: (p) => `${p}.nim altında halka ver`, subPh: 'isim', subTo: 'Adres ya da isim.nim (boş = sen)', subGive: (n) => `${n} ver`, subLong: 'Çok uzun: isim + senin ismin en çok 22 harf olmalı', subTaken: 'Bu alt halka alınmış', subBadTo: 'Adres ya da isim bulunamadı', subDone: (n) => `${n} yolda`, subList: 'Verdiğin alt halkalar', subNone: 'Henüz yok',
    giftQ: 'Hediye kodun var mı?', giftPh: 'HEDİYE KODU', giftOk: (n) => `Hediye kodu geçerli: bedava (${n} hak kaldı)`, giftBad: 'Bu kod geçerli değil ya da hakkı bitti', giftShort: 'Hediye kodu 5 ve daha uzun isimlerde geçer', giftFree: 'bedava',
    engrave: 'Halkayı taktır', engraving: 'Zincire kazınıyor…', yours: 'Halka artık senin', closed: 'Halka defteri yakında açılıyor', mine: 'Halkaların',
    evSent: 'Uçtu', evSentSub: (n) => `${n} yolda`, evGot: 'Geldi', evGotSub: (n) => `Gönderen: ${n}`, evPaid: 'Ödendi', evPaidSub: (n) => `${n} isteğini ödedi`,
    evSplit: (k, n) => `${k}/${n} ödedi`, evSplitWait: (n) => `Bekleyen pul: ${n}`, evSplitAll: 'Bütün pullar damgalandı', evRingSub: (n) => `Yeni adın: ${n}`, paidWord: 'ÖDENDİ',
    rejected: 'Cüzdanda vazgeçildi', failed: 'Bir şey ters gitti', notFound: 'Bulunamadı', tooLong: 'Not çok uzun',
  },
};
let T = TEXTS[lang];
function setLang(l) { if (!l || pickLang(l) === lang) return; lang = pickLang(l); T = TEXTS[lang]; document.documentElement.lang = lang; }
const markPay = () => document.documentElement.classList.add('inpay');
let fullHeight = 0;
const keyboardCheck = () => {
  const h = Math.round(window.visualViewport?.height || innerHeight);
  if (h > fullHeight) fullHeight = h;
  document.documentElement.classList.toggle('typing', h < fullHeight - 120);
  keepVisible();
};
function keepVisible() {
  const el = document.activeElement;
  if (!el || !el.matches?.('input, textarea')) return;
  setTimeout(() => {
    const bar = document.getElementById('bar');
    const limit = bar && bar.children.length ? bar.getBoundingClientRect().top - 12 : (window.visualViewport?.height || innerHeight) - 12;
    const r = el.getBoundingClientRect();
    if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit, behavior: 'smooth' });
    else if (r.top < 12) window.scrollBy({ top: r.top - 12, behavior: 'smooth' });
  }, 250);
}
document.addEventListener('focusin', keepVisible);
addEventListener('resize', keyboardCheck);
window.visualViewport?.addEventListener('resize', keyboardCheck);
addEventListener('orientationchange', () => { fullHeight = 0; setTimeout(keyboardCheck, 300); });
keyboardCheck();
if (window.nimiq || window.nimiqPay || window.ReactNativeWebView) markPay();

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = LOCAL ? '' : 'https://signal.heylogram.tv/pigeonapi';
const SITE = 'https://pigeon.heylogram.com';
const HIVE_SITE = 'https://hive.heylogram.com';   // every name gets a cell there: site, shop, QR till
const IN_FRAME = (() => { try { return window.parent !== window; } catch { return true; } })();
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();
const pretty = (a) => compact(a).replace(/(.{4})/g, '$1 ').trim();
const short = (a) => { const c = pretty(a); return c ? c.slice(0, 9) + ' … ' + c.slice(-4) : ''; };
// Nimiq address: its own alphabet (no I, O, W, Z) + IBAN mod-97 checksum, so no payment or sub-ring goes to a mistyped address
const isAddr = (a) => {
  const c = compact(a);
  if (!/^NQ[0-9]{2}[0-9A-HJ-NP-VXY]{32}$/.test(c)) return false;
  let r = 0;
  for (const ch of c.slice(4) + c.slice(0, 4)) { const v = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55); for (const d of v) r = (r * 10 + +d) % 97; }
  return r === 1;
};
const nim = (luna, digits = 5) => (Number(luna || 0) / 1e5).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: digits });
const toLuna = (v) => { const n = Number(String(v || '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 1e5) : 0; };
const bytes = (s) => new TextEncoder().encode(s).length;
const clip = (s, max = 64) => { let out = ''; for (const ch of s) { if (bytes(out + ch) > max) break; out += ch; } return out; };
const ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const CHECK = ICON('<path d="M5 12.5l4.5 4.5L19 7.5"/>');
const dateParts = (t = Date.now()) => { const d = new Date(t); return [d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' }).toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US'), d.toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' })]; };
const green = () => getComputedStyle(document.documentElement).getPropertyValue('--green').trim() || '#14907E';

let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200); }

async function api(path, body) {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(API + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (r.status === 503) { if (i === 1) toast(T.connecting); await new Promise((ok) => setTimeout(ok, 2000)); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'http'), { status: r.status });
    return j;
  }
  throw new Error('syncing');
}

let identicons;
let idSeq = 0;
const idCache = new Map();
async function identicon(addr) {
  const key = compact(addr);
  if (!idCache.has(key)) {
    identicons ||= globalThis.__identicons ? Promise.resolve(globalThis.__identicons) : import(new URL('identicons.js', document.baseURI).href).then((m) => m.default);
    idCache.set(key, identicons.then((I) => I.svg(pretty(key))));
  }
  return (await idCache.get(key)).replace(/hexagon-clip-\d+/g, () => 'hc' + idSeq++);
}
const idn = (addr, size) => `<i class="idn" data-a="${esc(compact(addr))}" style="width:${size}px;height:${size}px"></i>`;
function paintIdenticons(root = document) {
  for (const el of root.querySelectorAll('.idn[data-a]')) {
    const a = el.dataset.a; el.removeAttribute('data-a');
    if (isAddr(a)) identicon(a).then((svg) => { el.innerHTML = svg; }).catch(() => {});
  }
}

const bridge = (() => {
  let seq = 0, found = null;
  const waiting = new Map();
  addEventListener('message', (e) => {
    const v = e.data;
    if (e.source !== window.parent || !v || v.tur !== 'hl-nimiq' || v.islem !== 'sonuc') return;
    const w = waiting.get(v.id); if (!w) return; waiting.delete(v.id);
    v.ok ? w.ok(v.sonuc) : w.no(Object.assign(new Error(v.hata?.mesaj || 'wallet'), { code: v.hata?.kod }));
  });
  const call = (method, args) => new Promise((ok, no) => {
    const id = ++seq; waiting.set(id, { ok, no });
    setTimeout(() => { if (waiting.delete(id)) no(Object.assign(new Error('timeout'), { code: 'timeout' })); }, 180000);
    window.parent.postMessage({ tur: 'hl-nimiq', islem: 'cagir', id, yontem: method, args }, '*');
  });
  const provider = { listAccounts: () => call('listAccounts', []), sendBasicTransaction: (tx) => call('sendBasicTransaction', [tx]), sendBasicTransactionWithData: (tx) => call('sendBasicTransactionWithData', [tx]) };
  return (wait) => (found ||= new Promise((resolve) => {
    const ask = () => window.parent.postMessage({ tur: 'hl-nimiq', islem: 'sor' }, '*');
    const on = (e) => {
      const v = e.data;
      if (e.source !== window.parent || v?.tur !== 'hl-nimiq' || v.islem !== 'durum') return;
      removeEventListener('message', on); clearInterval(again); clearTimeout(stop);
      if (v.var) { markPay(); setLang(v.dil); }
      resolve(v.var ? provider : null);
    };
    addEventListener('message', on);
    const again = setInterval(ask, 500);
    const stop = setTimeout(() => { removeEventListener('message', on); clearInterval(again); found = null; resolve(null); }, wait);
    ask();
  }));
})();

const wallet = {
  async provider(wait = 2500) {
    if (IN_FRAME) return bridge(Math.max(wait, 12000));
    if (window.nimiq) return window.nimiq;
    const until = Date.now() + wait;
    while (Date.now() < until) { await new Promise((ok) => setTimeout(ok, 50)); if (window.nimiq) return window.nimiq; }
    return null;
  },
  async addresses() {
    const p = await this.provider(); if (!p) return [];
    const list = await p.listAccounts();
    return (Array.isArray(list) ? list : []).map((a) => compact(typeof a === 'string' ? a : a?.address)).filter(isAddr);
  },
  async send(to, value, data) {
    const p = await this.provider(500);
    if (!p) throw Object.assign(new Error('no_wallet'), { code: 'no_wallet' });
    const tx = { recipient: pretty(to), value, fee: 0 };
    return data ? p.sendBasicTransactionWithData({ ...tx, data: clip(data) }) : p.sendBasicTransaction(tx);
  },
};
const walletError = (e) => toast(/reject|denied|cancel|closed/i.test(String(e?.message || e?.code || e)) ? T.rejected : e?.code === 'no_wallet' ? T.openInPay : T.failed);

// Inside the Nimiq Pay frame browser storage throws; the page around the frame keeps our keys ('hl-depo' bridge, hlsite: keys)
const depo = new Map();
const depoReady = !IN_FRAME ? Promise.resolve() : new Promise((done) => {
  const ask = () => window.parent.postMessage({ tur: 'hl-depo', islem: 'hepsi' }, '*');
  const on = (e) => {
    const v = e.data;
    if (e.source !== window.parent || v?.tur !== 'hl-depo' || v.islem !== 'hepsi') return;
    removeEventListener('message', on); clearInterval(again); clearTimeout(stop);
    for (const [k, s] of Object.entries(v.veri || {})) if (k.startsWith('pg_') && !depo.has(k)) depo.set(k, String(s));
    done();
  };
  addEventListener('message', on);
  const again = setInterval(ask, 500);
  const stop = setTimeout(() => { removeEventListener('message', on); clearInterval(again); done(); }, 3000);
  ask();
});
const store = {
  get(k, d) { try { return JSON.parse(depo.get('pg_' + k) ?? localStorage.getItem('pg_' + k)) ?? d; } catch { return d; } },
  set(k, v) {
    const s = JSON.stringify(v); depo.set('pg_' + k, s);
    try { localStorage.setItem('pg_' + k, s); } catch {}
    if (IN_FRAME) window.parent.postMessage({ tur: 'hl-depo', islem: 'yaz', anahtar: 'pg_' + k, deger: s }, '*');
  },
};
function remember(address, name) {
  if (!isAddr(address) || isMine(address)) return;
  const list = store.get('contacts', []).filter((c) => c.address !== compact(address));
  list.unshift({ address: compact(address), name: name || null });
  store.set('contacts', list.slice(0, 12));
  addRecent([{ address, name, t: Date.now() }]);
}
// Recent people: whom you paid and who paid you, newest first. Only address, name and time are kept.
function addRecent(items) {
  const list = recentPeople(20);
  let changed = false;
  for (const { address, name, t } of items) {
    if (!isAddr(address) || isMine(address)) continue;
    const a = compact(address), old = list.find((c) => c.address === a);
    if (!old) { list.push({ address: a, name: name || null, t: t || 0 }); changed = true; }
    else if ((t || 0) > old.t || (name && name !== old.name)) { old.t = Math.max(old.t, t || 0); old.name = name || old.name; changed = true; }
  }
  if (changed) store.set('recent', list.sort((x, y) => y.t - x.t).slice(0, 20));
}
const recentPeople = (max = 6) => store.get('recent', []).filter((c) => c && isAddr(c.address) && !isMine(c.address)).sort((x, y) => (Number(y.t) || 0) - (Number(x.t) || 0)).map((c) => ({ address: compact(c.address), name: typeof c.name === 'string' && /^[a-z0-9.-]{1,64}$/.test(c.name) ? c.name : null, t: Number(c.t) || 0 })).slice(0, max);

const me = { address: null, all: [], name: null, balance: null };
const isMine = (a) => me.all.includes(compact(a));
async function myBalance() {
  const vals = await Promise.all(me.all.map((a) => api('/api/balance/' + a).then((b) => b.value ?? 0).catch(() => null)));
  return vals.some((v) => v != null) ? vals.reduce((x, v) => x + (v || 0), 0) : null;
}
async function myIncoming() {
  const lists = await Promise.all(me.all.map((a) => api('/api/incoming/' + a).catch(() => null)));
  if (lists.every((l) => !l)) return null;
  const seen = new Set();
  return lists.flat().filter((t) => t && !isMine(t.from) && !seen.has(t.hash) && seen.add(t.hash)).sort((a, b) => (a.time || 0) - (b.time || 0));
}
const label = (address, name) => (name ? name + '.nim' : short(address));
const sentEvent = (to, name, value, note) => playEvent('sent', { amount: nim(value), note, title: T.evSent, sub: T.evSentSub(label(to, name)) });
let seenIncoming = null;
async function loadMe() {
  me.all = await wallet.addresses().catch(() => []);
  me.address = me.all[0] || null;
  if (!me.address) return;
  const [names, bals] = await Promise.all([
    Promise.all(me.all.map((a) => api('/api/address/' + a).catch(() => ({})))),
    Promise.all(me.all.map((a) => api('/api/balance/' + a).then((b) => b.value ?? null).catch(() => null))),
  ]);
  const plain = (i) => names[i]?.type !== 'htlc';
  let main = me.all.findIndex((_, i) => plain(i) && names[i]?.name);
  if (main < 0) main = me.all.findIndex((_, i) => plain(i));
  if (main < 0) main = 0;
  me.address = me.all[main];
  me.name = names[main]?.name || names.find((n) => n?.name)?.name || null;
  me.balance = bals.some((v) => v != null) ? bals.reduce((x, v) => x + (v || 0), 0) : null;
}

let timer = null;
function every(ms, fn) { clearInterval(timer); timer = setInterval(fn, ms); }
const app = () => $('#app');
const bar = (html) => { $('#bar').innerHTML = html || ''; };
function screen(html, barHtml) { clearInterval(timer); app().innerHTML = html; bar(barHtml); paintIdenticons(app()); paintIdenticons($('#bar')); window.scrollTo(0, 0); }
const backBtn = (title) => `<button class="back" data-back><b>‹</b>${esc(title)}</button>`;

const ROUTES = {};
function go(view, data = {}) { try { history.pushState({ view, data }, ''); } catch {} render(view, data); }
function render(view, data) { (ROUTES[view] || ROUTES.home)(data || {}); }
addEventListener('popstate', (e) => render(e.state?.view || 'home', e.state?.data));
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-back]')) { if (history.state && history.length > 1) history.back(); else go('home'); }
});

async function share(text, url) {
  try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch { return; }
  copy(url || text);
}
async function copy(s) {
  try { await navigator.clipboard.writeText(s); } catch { const t = document.createElement('textarea'); t.value = s; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast(T.copied);
}

const OPEN_URL = 'https://nimpay.app/miniapps/open/pigeon.heylogram.com';
const STORES = [['Google Play', 'https://play.google.com/store/apps/details?id=com.nimiq.pay'], ['App Store', 'https://apps.apple.com/app/nimiq-pay/id6471844738']];
function connectCard() {
  const desk = matchMedia('(pointer: fine)').matches;
  let qr = '';
  if (desk) { const q = qrcode(0, 'M'); q.addData(OPEN_URL); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  return `<div class="coop connect"><div class="hand" style="font-size:21px">${esc(T.flyHome)}</div>
${desk ? `<div class="qrbox"><div class="qr">${qr}</div><p class="hint">${esc(T.scanQr)}</p></div>` : `<a class="btn main" href="${OPEN_URL}" target="_blank" rel="noopener">${esc(T.openPay)}</a>`}
<div class="stores"><span class="hint">${esc(T.noPay)}</span>${STORES.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>
<button class="link" id="retry">${esc(T.retry)}</button></div>`;
}

ROUTES.home = async () => {
  const contacts = store.get('contacts', []).slice(0, 3);
  const spots = [[6, 66], [36, 80], [66, 70]];
  const perches = contacts.map((c, i) => `<button class="perch" data-c="${i}" style="left:calc(${spots[i][0]}% - 10px);top:${spots[i][1] - 40}px"><div class="g">${perched()}</div><span class="ring">${idn(c.address, 16)}${esc(c.name || short(c.address).slice(0, 9))}</span></button>`).join('');
  const nameHtml = me.name ? `${esc(me.name)}<em>.nim</em>` : esc(T.noRing);
  const body = me.address ? `<div class="coop"><div class="me">${idn(me.address, 46)}<div style="min-width:0"><b class="name">${nameHtml}</b><small>${esc(short(me.address))}</small></div></div>
<div class="balance"><b>${me.balance == null ? '…' : nim(me.balance, 2)}</b><span>NIM</span></div>
<div class="stamps"><button class="stamp hot" data-go="send">${ICON('<path d="M5 12h12M12 6l6 6-6 6"/>')}${esc(T.send)}</button><button class="stamp" data-go="request">${ICON('<path d="M19 12H7M12 6l-6 6 6 6"/>')}${esc(T.request)}</button><button class="stamp" data-go="split">${ICON('<circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 12l6 5"/>')}${esc(T.split)}</button><button class="stamp" data-go="name">${ICON('<ellipse cx="12" cy="12" rx="8" ry="4.5"/><ellipse cx="12" cy="12" rx="4" ry="2"/>')}${esc(T.ring)}</button></div>
${me.name && !me.name.includes('.') ? `<a class="hivecard" href="${HIVE_SITE}/#n=${encodeURIComponent(me.name)}" target="_blank" rel="noopener"><span class="hx"></span><span><b>${esc(T.hiveT(me.name))}</b><small>${esc(T.hiveS)}</small></span><span class="ar">${ICON('<path d="M9 6l6 6-6 6"/>')}</span></a>` : ''}
<div class="letters" id="letters"><p class="hint">${esc(T.letters)}…</p></div></div>`
    : connectCard();
  screen(`<div class="brand">${logo()}${esc(T.app)}</div><div class="wire"><svg class="w" viewBox="0 0 410 60" preserveAspectRatio="none"><path d="M0 18 Q205 52 410 18" fill="none" stroke="var(--wire)" stroke-width="2"/></svg>${perches}</div>${body}`);
  app().querySelectorAll('[data-go]').forEach((b) => b.onclick = () => go(b.dataset.go));
  app().querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { const c = contacts[b.dataset.c]; go('send', { to: c.name ? c.name + '.nim' : pretty(c.address) }); });
  const retry = $('#retry'); if (retry) retry.onclick = async () => { retry.disabled = true; await loadMe(); render('home'); };
  if (!me.address) return;
  const refresh = async () => {
    const [b, inc] = await Promise.all([myBalance(), myIncoming()]);
    if (b != null) { me.balance = b; const el = $('.balance b'); if (el) el.textContent = nim(b, 2); }
    if (inc) addRecent(inc.map((t) => ({ address: t.from, name: t.fromName, t: t.time })));
    const box = $('#letters'); if (!box || !inc) return;
    const list = inc.slice(-6).reverse();
    const fresh = seenIncoming ? inc.filter((t) => !seenIncoming.has(t.hash)) : [];
    seenIncoming = new Set(inc.map((t) => t.hash));
    const last = fresh.at(-1);
    if (last) playEvent('received', { value: last.value, format: (v) => nim(Math.round(v), 2), note: last.note.replace(/^ode:[0-9a-f]{8}\s*/, ''), title: T.evGot, sub: T.evGotSub(label(last.from, last.fromName)) });
    box.innerHTML = list.length ? list.map((t) => `<div class="lt">${idn(t.from, 28)}<span><b>${esc(t.fromName ? t.fromName + '.nim' : short(t.from))}</b>${t.note ? ' · ' + esc(t.note.replace(/^ode:[0-9a-f]{8}\s*/, '')) : ''}</span><b class="in">+${nim(t.value)}</b></div>`).join('') : `<p class="hint">${esc(T.noLetters)}</p>`;
    paintIdenticons(box);
  };
  refresh(); every(15000, refresh);
};

async function resolveWho(raw) {
  const v = raw.trim();
  if (!v) return null;
  if (isAddr(v)) {
    const r = await api('/api/address/' + compact(v)).catch(() => ({}));
    const address = r.type === 'htlc' && r.creator ? compact(r.creator) : compact(v);
    return { address, name: r.name || null, plain: !r.name, moved: address !== compact(v) };
  }
  const name = v.toLowerCase().replace(/\.nim$/, '');
  const r = await api('/api/name/' + encodeURIComponent(name)).catch(() => ({}));
  return r.address ? { address: compact(r.address), name } : { missing: true, name };
}

// Look-alike rings: letters that read the same on a small screen are folded first (rn→m, vv→w, 0→o, 1 and i→l),
// then any other registered name one letter away is shown next to it. A warning only; payment stays open.
let allNames = null;
const namesOnce = () => (allNames ||= api('/api/names').then((xs) => (Array.isArray(xs) ? xs : []).filter((x) => x?.name && isAddr(x.address))).catch(() => { allNames = null; return []; }));
const fold = (s) => s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/[1i]/g, 'l');
const oneOff = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};
async function lookAlike(name, address) {
  if (!name || name.includes('.') || fold(name).length < 3) return null;
  const f = fold(name);
  const others = (await namesOnce()).filter((x) => x.name !== name && compact(x.address) !== compact(address));
  return others.find((x) => fold(x.name) === f) || others.find((x) => oneOff(fold(x.name), f)) || null;
}

ROUTES.send = (d) => {
  let who = null, amount = toLuna(d.amount) || 0;
  const recent = recentPeople();
  screen(`${backBtn(T.write)}
<div class="envelope"><div class="pst" id="pst"></div><div class="to">${esc(T.to)}</div><input class="who" id="who" placeholder="${esc(T.toHint)}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(d.to || '')}"><div class="addr" id="addr"></div><span id="check"></span></div>
<div class="alike" id="alike" hidden></div>
${recent.length ? `<div class="recent"><small>${esc(T.recent)}</small><div>${recent.map((c, i) => `<button data-r="${i}">${idn(c.address, 22)}<span>${esc(c.name ? c.name + '.nim' : short(c.address))}</span></button>`).join('')}</div></div>` : ''}
<p class="hint">${esc(T.stampHint)}</p>
<div class="sheet"><div class="amount"><input id="amt" inputmode="decimal" placeholder="0" value="${amount ? esc(nim(amount)) : ''}"><span>NIM</span></div>
<div class="quick">${[5, 10, 25, 50].map((v) => `<button data-q="${v}">${v}</button>`).join('')}</div>
<input class="note" id="note" maxlength="64" placeholder="${esc(T.notePh)}" value="${esc(d.note || '')}"><small>${esc(T.noteHint)}</small></div>`,
  `<button class="btn main" id="go" disabled>${esc(T.seal)}</button>`);
  const upd = () => {
    amount = toLuna($('#amt').value);
    app().querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('on', toLuna(b.dataset.q) === amount));
    const b = $('#go'); b.disabled = !(who?.address && amount);
    b.textContent = amount ? `${T.seal} · ${nim(amount)} NIM` : T.seal;
  };
  let seq = 0, deb;
  const look = () => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      const my = ++seq; const v = $('#who').value;
      $('#who').classList.toggle('long', /^NQ/i.test(v.trim()));
      who = null; upd(); $('#alike').hidden = true;
      const r = await resolveWho(v);
      if (my !== seq) return;
      who = r;
      $('#pst').innerHTML = r?.address ? idn(r.address, 52) : '';
      $('#addr').textContent = r?.address ? short(r.address) : '';
      $('#check').innerHTML = (r?.moved ? `<span class="ok warn">${esc(T.moved)}</span> ` : '') + (!r ? '' : r.missing ? `<span class="ok warn">${esc(T.noName)}</span>` : r.plain ? `<span class="ok warn">${esc(T.plain)}</span>` : `<span class="ok">${CHECK}${esc(T.ringOk)}</span>`);
      paintIdenticons(app()); upd();
      const al = $('#alike'); al.innerHTML = '';
      const other = r?.address && r.name && !isAddr(v) ? await lookAlike(r.name, r.address) : null;
      if (my !== seq || !other) return;
      al.innerHTML = `<div class="two2"><span>${idn(r.address, 30)}<b>${esc(r.name)}.nim</b></span><span>${idn(other.address, 30)}<b>${esc(other.name)}.nim</b></span></div><small>${esc(T.alike(other.name))}</small>`;
      al.hidden = false; paintIdenticons(al);
    }, 300);
  };
  $('#who').oninput = look; $('#amt').oninput = upd;
  app().querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { const c = recent[b.dataset.r]; $('#who').value = c.name ? c.name + '.nim' : pretty(c.address); look(); });
  app().querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { $('#amt').value = b.dataset.q; upd(); });
  $('#note').oninput = (e) => { if (bytes(e.target.value) > 64) { e.target.value = clip(e.target.value); toast(T.tooLong); } };
  if (d.to) look();
  upd();
  $('#go').onclick = async () => {
    const b = $('#go'); b.disabled = true; b.textContent = T.sending;
    const note = $('#note').value.trim();
    try {
      const hash = await wallet.send(who.address, amount, note);
      remember(who.address, who.name);
      await sentEvent(who.address, who.name, amount, note);
      go('receipt', { to: who.address, name: who.name, value: amount, note, hash: String(hash || ''), t: Date.now() });
    } catch (e) { walletError(e); upd(); }
  };
};

ROUTES.receipt = (d) => {
  screen(`<div class="flight"><svg class="trail" viewBox="0 0 354 300" preserveAspectRatio="none"><path d="M40 270 C 120 230, 110 120, 260 70" fill="none" stroke="var(--muted)" stroke-width="2.4" stroke-dasharray="2 9" stroke-linecap="round"/></svg>
${me.address ? `<div class="me">${idn(me.address, 50)}</div>` : ''}<div class="bird">${flying()}</div><div class="pm">${postmark(T.delivered, dateParts(d.t), green())}</div></div>
<div class="slip"><div class="top">${idn(d.to, 34)}<b>${esc(d.name ? d.name + '.nim' : short(d.to))}</b><strong>${nim(d.value)} NIM</strong></div>
<dl>${d.note ? `<dt>${esc(T.note)}</dt><dd class="hand">${esc(d.note.replace(/^ode:[0-9a-f]{8}\s*/, ''))}</dd>` : ''}<dt>${esc(T.fee)}</dt><dd>0 NIM</dd>${d.hash ? `<dt>${esc(T.tx)}</dt><dd class="mono" style="font-size:12px">${esc(d.hash.slice(0, 4) + ' ' + d.hash.slice(4, 8) + ' … ' + d.hash.slice(-4))}</dd>` : ''}</dl></div>`,
  `<button class="btn" id="sh">${esc(T.share)}</button><button class="btn main" id="ok">${esc(T.done)}</button>`);
  $('#sh').onclick = () => share(`${nim(d.value)} NIM → ${d.name ? d.name + '.nim' : pretty(d.to)}${d.hash ? '\n' + d.hash : ''}`);
  $('#ok').onclick = () => { loadMe(); go('home'); };
};

ROUTES.request = () => {
  if (!me.address) return go('home');
  screen(`${backBtn(T.tie)}<div class="tied"><div class="g">${perched()}</div><div class="tag"><b id="tb">0 <span>NIM</span></b><div class="hand" id="tn">&nbsp;</div></div></div>
<div class="form"><label>${esc(T.amount)}</label><input class="big" id="amt" inputmode="decimal" placeholder="0"><label>${esc(T.what)}</label><input id="note" maxlength="50" placeholder="${esc(T.notePh)}"></div>
<p class="hint">${esc(T.reqHint)}</p>`, `<button class="btn main" id="go" disabled>${esc(T.create)}</button>`);
  const upd = () => { const v = toLuna($('#amt').value); $('#tb').innerHTML = `${nim(v)} <span>NIM</span>`; $('#tn').textContent = $('#note').value || ' '; $('#go').disabled = !v; };
  $('#amt').oninput = upd; $('#note').oninput = upd;
  $('#go').onclick = async () => {
    $('#go').disabled = true;
    try { const r = await api('/api/request', { to: me.address, value: toLuna($('#amt').value), note: $('#note').value.trim(), as: me.name }); go('req', { id: r.id }); }
    catch { toast(T.failed); upd(); }
  };
};

const reqLink = (id) => `${SITE}/#r=${id}`;
const statusPill = (s) => `<span class="pill ${s === 'paid' ? 'done' : ''}">${esc(s === 'paid' ? T.paid : s === 'partial' ? T.partial : T.waiting)}</span>`;

ROUTES.req = async (d) => {
  let r;
  try { r = await api('/api/request/' + d.id); } catch { return screen(`${backBtn(T.notFound)}`); }
  if (r.as && compact(r.asAddress) !== compact(r.to)) return ROUTES.fake(r);
  if (me.address && isMine(r.to)) return ownRequest(r);
  return incoming(r);
};

function ownRequest(r) {
  const link = reqLink(r.id);
  const lastPayer = r.payments.at(-1);
  screen(`${backBtn(T.tie)}<div class="tied"><div class="g">${r.status === 'paid' ? '' : perched()}</div><div class="tag"><b>${nim(r.value)} <span>NIM</span></b><div class="hand">${esc(r.note || ' ')}</div><code>${esc(link.replace(/^https?:\/\//, ''))}</code></div></div>
<p class="hint">${esc(T.reqHint)}</p>
<div class="window" id="win"><div class="frame"><div class="g">${r.status === 'paid' ? flying() : perched()}</div></div><div style="min-width:0"><b>${lastPayer ? esc(lastPayer.fromName ? lastPayer.fromName + '.nim' : short(lastPayer.from)) : ' '}</b><small>${esc(r.status === 'paid' ? T.back : T.atWindow)} · ${nim(r.paid)}/${nim(r.value)} NIM</small></div>${statusPill(r.status)}</div>`,
  `<button class="btn" id="cp">${esc(T.copy)}</button><button class="btn main" id="sh">${esc(T.share)}</button>`);
  $('#cp').onclick = () => copy(link);
  $('#sh').onclick = () => share(`${r.note ? r.note + ' · ' : ''}${nim(r.value)} NIM`, link);
  if (r.status !== 'paid') every(5000, async () => { const n = await api('/api/request/' + r.id).catch(() => null); if (n && n.paid !== r.paid) { clearInterval(timer); const p = n.payments.at(-1); await playEvent('paid', { amount: nim(n.value), note: n.note, word: T.paidWord, title: T.evPaid, sub: T.evPaidSub(label(p.from, p.fromName)) }); ownRequest(n); } });
}

function incoming(r) {
  const from = r.toName ? r.toName + '.nim' : short(r.to);
  const left = Math.max(0, r.value - r.paid);
  const ring = r.toName ? `<span class="ok">${CHECK}${esc(T.ringIs(r.toName + '.nim'))}</span>` : `<span class="ok warn">${esc(T.noRingWarn)}</span>`;
  screen(`<div class="sill"><div class="frame"></div><div class="board"></div><div class="g">${flying()}</div></div>
<div class="open"><div class="from">${idn(r.to, 26)}<b>${esc(from)}</b> ${esc(T.sentYou)}</div>${r.note ? `<div class="hand">${esc(r.note)}</div>` : ''}<b class="t">${nim(left || r.value)} NIM</b>${ring}
${r.status === 'paid' ? `<span class="ok">${CHECK}${esc(T.alreadyPaid)}</span>` : ''}<small class="hint mono">${esc(short(r.to))}</small></div>`,
  r.status === 'paid' ? `<button class="btn main" id="no">${esc(T.done)}</button>` : `<button class="btn" id="no">${esc(T.notNow)}</button><button class="btn main" id="pay">${nim(left)} NIM ${esc(T.pay)}</button>`);
  $('#no').onclick = () => go('home');
  const pay = $('#pay');
  if (pay) pay.onclick = async () => {
    pay.disabled = true; pay.textContent = T.sending;
    try {
      const hash = await wallet.send(r.to, left, r.memo);
      remember(r.to, r.toName);
      await sentEvent(r.to, r.toName, left, r.note);
      go('receipt', { to: r.to, name: r.toName, value: left, note: r.note, hash: String(hash || ''), t: Date.now() });
    } catch (e) { walletError(e); pay.disabled = false; pay.textContent = `${nim(left)} NIM ${T.pay}`; }
  };
}

ROUTES.fake = (r) => {
  const claimed = r.as + '.nim';
  screen(`<div class="fake"><h2>${esc(T.fakeT(r.as))}</h2><p>${T.fakeP(esc(claimed))}</p>
<div class="two"><div><div class="g">${perched()}</div><small>${esc(T.should)}</small><b>${esc(claimed)}</b><br>${r.asAddress ? `<span class="ring">${idn(r.asAddress, 16)}${esc(short(r.asAddress))}</span>` : ''}</div>
<div><div class="g">${perched()}</div><small>${esc(T.arrived)}</small><b>${esc(T.noMatch)}</b><br><span class="ring bad">${idn(r.to, 16)}${esc(short(r.to))}</span></div></div>
<span class="cross">${esc(T.blocked)}</span></div><p class="hint" style="text-align:center">${esc(T.fakeHint)}</p>`,
  `<button class="btn" id="bk">${esc(T.goBack)}</button>`);
  $('#bk').onclick = () => go('home');
};

ROUTES.split = () => {
  if (!me.address) return go('home');
  const people = [];
  screen(`${backBtn(T.splitT)}<div class="form"><label>${esc(T.amount)}</label><input class="big" id="amt" inputmode="decimal" placeholder="0"><label>${esc(T.what)}</label><input id="note" maxlength="40" placeholder="${esc(T.notePh)}">
<label>${esc(T.people)}</label><div class="people" id="pp"></div><div style="display:flex;gap:8px"><input id="who" placeholder="${esc(T.addPerson)}" autocapitalize="off" spellcheck="false"><button class="btn" style="flex:none;min-height:40px" id="add">${esc(T.add)}</button></div>
<label class="chk"><input type="checkbox" id="mein" checked style="width:auto">${esc(T.includeMe)}</label></div>
<p class="hint" id="calc">&nbsp;</p>`, `<button class="btn main" id="go" disabled>${esc(T.splitIt)}</button>`);
  const upd = () => {
    $('#pp').innerHTML = people.map((p, i) => `<span>${esc(p)}<button data-x="${i}">×</button></span>`).join('');
    $('#pp').querySelectorAll('[data-x]').forEach((b) => b.onclick = () => { people.splice(b.dataset.x, 1); upd(); });
    const v = toLuna($('#amt').value), n = people.length + ($('#mein').checked ? 1 : 0);
    const each = n ? Math.floor(v / n) : 0;
    $('#calc').textContent = people.length && v ? T.stampsOf(people.length, nim(each), 0) : ' ';
    $('#go').disabled = !(v && people.length && each);
  };
  const add = () => { const v = $('#who').value.trim().slice(0, 40); if (v && people.length < 20) { people.push(v); $('#who').value = ''; upd(); } };
  $('#add').onclick = add; $('#who').onkeydown = (e) => { if (e.key === 'Enter') add(); };
  $('#amt').oninput = upd; $('#mein').onchange = upd;
  $('#go').onclick = async () => {
    $('#go').disabled = true;
    try { const s = await api('/api/split', { to: me.address, value: toLuna($('#amt').value), people, includeMe: $('#mein').checked, note: $('#note').value.trim() }); go('splitv', { id: s.id }); }
    catch { toast(T.failed); upd(); }
  };
};

const personAddr = new Map();
async function personAddress(p) {
  const name = p.toLowerCase().replace(/\.nim$/, '');
  if (!/^[a-z0-9-]{1,32}$/.test(name)) return null;
  if (!personAddr.has(name)) personAddr.set(name, api('/api/name/' + name).then((r) => r.address || null).catch(() => null));
  return personAddr.get(name);
}

ROUTES.splitv = async (d) => {
  let s;
  try { s = await api('/api/split/' + d.id); } catch { return screen(`${backBtn(T.notFound)}`); }
  const mine = me.address && isMine(s.to);
  const draw = async (s) => {
    const stamped = s.parts.filter((p) => p.status === 'paid').length;
    const addrs = await Promise.all(s.parts.map((p) => personAddress(p.person)));
    screen(`${backBtn(T.splitT)}<div class="splitL"><div class="hand">${esc(s.note || ' ')}</div><div class="total"><b>${nim(s.total)}</b><span>NIM</span></div><p class="hint">${esc(T.stampsOf(s.parts.length, nim(s.share), stamped))}</p><div class="torn"></div></div>
<div class="parts">${s.parts.map((p, i) => `<button class="part" data-i="${i}">${addrs[i] ? idn(addrs[i], 48) : `<span class="blank">${esc(p.person.slice(0, 1).toUpperCase())}</span>`}<b>${esc(p.person)}</b><small>${nim(p.value)} NIM</small>${p.status === 'paid' ? `<div class="pmk">${postmark(T.paidMark, [T.paid.toUpperCase()], green())}</div>` : mine ? `<span class="nudge">${esc(T.nudge)}</span>` : ''}</button>`).join('')}</div>
<p class="hint">${esc(T.splitHint)}</p>`, mine ? `<button class="btn main" id="sh">${esc(T.share)}</button>` : '');
    app().querySelectorAll('[data-i]').forEach((b) => b.onclick = () => {
      const p = s.parts[b.dataset.i];
      if (mine) share(`${s.note ? s.note + ' · ' : ''}${nim(p.value)} NIM`, reqLink(p.id));
      else if (p.status !== 'paid') go('req', { id: p.id });
    });
    const sh = $('#sh'); if (sh) sh.onclick = () => share(s.note || T.splitT, `${SITE}/#s=${s.id}`);
    if (stamped < s.parts.length) every(6000, async () => { const n = await api('/api/split/' + s.id).catch(() => null); const k = n ? n.parts.filter((p) => p.status === 'paid').length : stamped;
      if (k === stamped) return;
      clearInterval(timer);
      const ad = await Promise.all(n.parts.map((p) => personAddress(p.person)));
      const waiting = n.parts.find((p) => p.status !== 'paid');
      await playEvent('split', { amount: nim(n.total), note: n.note, word: T.paidWord, paint: paintIdenticons, title: T.evSplit(k, n.parts.length), sub: waiting ? T.evSplitWait(waiting.person) : T.evSplitAll,
        parts: n.parts.map((p, i) => ({ label: p.person, amount: nim(p.value), paid: p.status === 'paid', icon: ad[i] ? idn(ad[i], 50) : '' })) });
      draw(n); });
  };
  draw(s);
};

ROUTES.name = async () => {
  if (!me.address) return go('home');
  const reg = await api('/api/registry').catch(() => ({ open: false }));
  let state = null;
  screen(`${backBtn(T.ringT)}<div class="ringstage" id="br"></div>
<div class="namebox"><input id="nm" autocapitalize="off" autocomplete="off" spellcheck="false" maxlength="32" placeholder="${esc(lang === 'tr' ? 'isim' : 'name')}"><em>.nim</em></div><span id="st"></span>
<div class="recipe" id="rc"></div><p class="hint">${esc(reg.open ? T.ringHint : T.closed)}</p>
<details class="gift" hidden><summary>${esc(T.giftQ)}</summary><div class="namebox"><input id="hk" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="24" placeholder="${esc(T.giftPh)}"></div><span id="hkSt"></span></details>
${me.name && !me.name.includes('.') ? `<details class="gift sub"><summary>${esc(T.subQ(me.name))}</summary><div class="namebox"><input id="sb" autocapitalize="off" autocomplete="off" spellcheck="false" maxlength="22" placeholder="${esc(T.subPh)}"><em>.${esc(me.name)}.nim</em></div><div class="namebox"><input id="sbTo" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="${esc(T.subTo)}"></div><span id="sbSt"></span><button class="btn" id="sbGo" disabled>${esc(T.subGive('…'))}</button><p class="hint" id="sbList"></p><button class="btn" id="sbOpen" disabled>…</button><p class="hint">${esc(T.subOpenHint)}</p></details>` : ''}`,
  `<button class="btn main" id="go" disabled>${esc(reg.open ? T.engrave : T.closed)}</button>`);
  const recipe = (name, price, code) => { $('#rc').innerHTML = `<div><span>${esc(T.price)}</span><b>${code ? esc(T.giftFree) : price ? nim(price) + ' NIM' : '—'}</b></div><div><span>${esc(T.forever)}</span><b>${esc(T.foreverV)}</b></div><div><span>${esc(T.how)}</span><b>${esc(T.howV)} <code>nim:${esc(name || '…')}${code ? ':' + esc(code) : ''}</code></b></div><div><span>${esc(T.rule)}</span><b>${esc(T.ruleV)}</b></div>`; };
  recipe('', 0);
  const face = await identicon(me.address).catch(() => '');
  const showRing = (name, info, animate) => {
    const r = ring({ name: name || (lang === 'tr' ? 'isim' : 'name'), identicon: face, serial: info?.index || null, year: info?.since ? new Date(info.since).getFullYear() : new Date().getFullYear() });
    const box = $('#br'); if (!box) return Promise.resolve();
    box.innerHTML = r.svg; box.classList.toggle('empty', !name);
    return animate ? r.play(box) : (r.still(box), Promise.resolve());
  };
  const mine = me.name ? await api('/api/name/' + me.name).catch(() => null) : null;
  showRing(me.name, mine, false);
  $('#br').onclick = () => { if (me.name && !$('#nm').value) showRing(me.name, mine, true); };
  let seq = 0, deb;
  $('#nm').oninput = () => {
    const v = $('#nm').value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (v !== $('#nm').value) $('#nm').value = v;
    showRing(v || me.name, null, false);
    state = null; $('#go').disabled = true; recipe(v, 0); $('#st').innerHTML = '';
    clearTimeout(deb);
    if (!v) return;
    deb = setTimeout(async () => {
      const my = ++seq;
      const r = await api('/api/name/' + v).catch(() => null);
      if (my !== seq || !r) return;
      state = r;
      $('#st').innerHTML = r.invalid ? `<span class="ok warn">${esc(T.invalid)}</span>` : r.reserved ? `<span class="ok warn">${esc(T.reserved)}</span>` : r.address ? `<span class="ok warn">${esc(T.taken(isMine(r.address) ? T.mine : short(r.address)))}</span>` : `<span class="ok">${CHECK}${esc(T.free)}</span>`;
      recipe(v, r.price || 0);
      $('#go').disabled = !(reg.open && r.free);
      if (r.free) goLabel();
    }, 300);
  };
  // sub-ring: a name owner gives a name under their own → 1 luna to the registry + "alt:<sub>.<name>:<address>" (only the owner's transaction counts)
  if ($('#sb')) {
    const parent = me.name;
    const listSubs = () => api('/api/subs/' + parent).then((xs) => { $('#sbList').innerHTML = `${esc(T.subList)}: ${xs.length ? xs.map((x) => `<b>${esc(x.name.split('.')[0])}</b><small>.${esc(parent)}</small>`).join(', ') : esc(T.subNone)}`; }).catch(() => {});
    listSubs();
    let sbState = null, sbSeq = 0, sbDeb;
    const sbCheck = () => {
      const v = $('#sb').value.toLowerCase().replace(/[^a-z0-9-]/g, ''); if (v !== $('#sb').value) $('#sb').value = v;
      const to = $('#sbTo').value.trim();
      sbState = null; $('#sbGo').disabled = true; $('#sbSt').innerHTML = ''; $('#sbGo').textContent = T.subGive(v ? `${v}.${parent}.nim` : '…');
      clearTimeout(sbDeb); if (!v) return;
      if (v.length + parent.length > 22) { $('#sbSt').innerHTML = `<span class="ok warn">${esc(T.subLong)}</span>`; return; }
      sbDeb = setTimeout(async () => {
        const my = ++sbSeq;
        const [r, addr] = await Promise.all([
          api('/api/name/' + v + '.' + parent).catch(() => null),
          !to ? Promise.resolve(me.address) : isAddr(to) ? Promise.resolve(compact(to)) : api('/api/name/' + to.toLowerCase().replace(/\.nim$/, '')).then((x) => x?.address || null).catch(() => null),
        ]);
        if (my !== sbSeq) return;
        if (r?.address) { $('#sbSt').innerHTML = `<span class="ok warn">${esc(T.subTaken)}</span>`; return; }
        if (!addr) { $('#sbSt').innerHTML = `<span class="ok warn">${esc(T.subBadTo)}</span>`; return; }
        sbState = { name: v + '.' + parent, to: compact(addr) };
        $('#sbSt').innerHTML = `<span class="ok">${CHECK}${esc(v)}<small>.${esc(parent)}.nim</small> → ${esc(short(addr))}</span>`;
        $('#sbGo').disabled = false;
      }, 300);
    };
    $('#sb').oninput = sbCheck; $('#sbTo').oninput = sbCheck;
    // open sub-rings: 1 luna to the registry + "altac:<name>" / "altkapa:<name>" (only the owner's transaction counts)
    let acik = null;
    const openShow = () => api('/api/name/' + parent).then((x) => { acik = !!x?.subsOpen; $('#sbOpen').textContent = acik ? T.subOpenOn : T.subOpenOff; $('#sbOpen').disabled = false; }).catch(() => {});
    openShow();
    $('#sbOpen').onclick = async () => {
      if (acik === null) return;
      $('#sbOpen').disabled = true;
      try { await wallet.send(reg.registry, 1, (acik ? 'altkapa:' : 'altac:') + parent); toast(T.subOpenSent); setTimeout(openShow, 8000); }
      catch (e) { walletError(e); $('#sbOpen').disabled = false; }
    };
    $('#sbGo').onclick = async () => {
      if (!sbState) return;
      const note = `alt:${sbState.name}:${sbState.to}`;
      if (new TextEncoder().encode(note).length > 64) { toast(T.subLong); return; }
      $('#sbGo').disabled = true;
      try { await wallet.send(reg.registry, 1, note); toast(T.subDone(sbState.name + '.nim')); setTimeout(listSubs, 8000); }
      catch (e) { walletError(e); $('#sbGo').disabled = false; }
    };
  }
  // the gift box shows only while a campaign is open (no code is asked otherwise)
  api('/api/gift').then((g) => { const d = $('details.gift'); if (d && g?.open) d.hidden = false; }).catch(() => {});
  // gift code: free registration while a campaign is open, has slots and the name has 5+ letters (1 luna + note "nim:name:CODE")
  let gift = null, gseq = 0, gdeb;
  const giftOn = () => !!(gift?.valid && state?.free && state.name.length >= (gift.minLength || 5));
  const goLabel = () => { if (state?.free) $('#go').textContent = giftOn() ? `${T.engrave} · ${T.giftFree}` : `${T.engrave} · ${nim(state.price)} NIM`; };
  const giftShow = () => {
    const code = $('#hk').value.trim();
    $('#hkSt').innerHTML = !code || !gift ? '' : !gift.valid ? `<span class="ok warn">${esc(T.giftBad)}</span>` : state?.name && state.name.length < (gift.minLength || 5) ? `<span class="ok warn">${esc(T.giftShort)}</span>` : `<span class="ok">${CHECK}${esc(T.giftOk(gift.left))}</span>`;
    goLabel();
    if (state?.free) recipe(state.name, state.price, giftOn() ? $('#hk').value.trim() : null);
  };
  $('#hk').oninput = () => {
    const v = $('#hk').value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (v !== $('#hk').value) $('#hk').value = v;
    gift = null; giftShow(); clearTimeout(gdeb);
    if (v.length < 4) return;
    gdeb = setTimeout(async () => { const my = ++gseq; const g = await api('/api/gift/' + v).catch(() => null); if (my === gseq) { gift = g; giftShow(); } }, 300);
  };
  const nmInput = $('#nm').oninput;
  $('#nm').oninput = () => { nmInput(); setTimeout(giftShow, 350); };
  $('#go').onclick = async () => {
    const name = state?.name; if (!name || !state.free) return;
    const b = $('#go'); b.disabled = true; b.textContent = T.sending;
    const code = giftOn() ? $('#hk').value.trim() : null;
    try { await wallet.send(reg.registry, code ? 1 : state.price, code ? `nim:${name}:${code}` : 'nim:' + name); }
    catch (e) { walletError(e); b.disabled = false; goLabel(); return; }
    b.textContent = T.engraving;
    const until = Date.now() + 120000;
    every(3000, async () => {
      const r = await api('/api/name/' + name).catch(() => null);
      if (r?.address && isMine(r.address)) {
        clearInterval(timer);
        if (!me.name) me.name = name;
        $('#st').innerHTML = '';
        showRing(name, r, true).then(() => { $('#st').innerHTML = `<span class="ok">${CHECK}${esc(T.yours)}</span>`; });
        b.textContent = T.done; b.disabled = false; b.onclick = () => go('home');
      } else if (r?.address || Date.now() > until) { clearInterval(timer); toast(r?.address ? T.taken(short(r.address)) : T.failed); b.textContent = T.done; b.disabled = false; b.onclick = () => go('home'); }
    });
  };
};

async function start() {
  const sky = document.createElement('div'); sky.className = 'sky';
  sky.innerHTML = `<i class="cloud" style="left:-20px;top:70px"></i><i class="cloud" style="right:-10px;top:120px;transform:scale(.7)"></i><i class="moon"></i>` + [[10, 70], [30, 40], [80, 170], [55, 90], [88, 60], [24, 150]].map(([x, y]) => `<i class="star" style="left:${x}%;top:${y}px"></i>`).join('');
  document.body.prepend(sky);
  app().innerHTML = `<div class="brand">${logo()}${esc(T.app)}</div>`;
  const loading = loadMe();
  let seen = false;
  try { seen = sessionStorage.getItem('pg_splash') === '1'; sessionStorage.setItem('pg_splash', '1'); } catch {}
  if (!seen) await playSplash({ title: T.app, tagline: T.tagline, ready: Promise.race([loading, new Promise((ok) => setTimeout(ok, 600))]) });
  let loaded = false; loading.then(() => { loaded = true; });
  await new Promise((ok) => setTimeout(ok, 0));
  if (!loaded) app().innerHTML = `<div class="brand">${logo()}${esc(T.app)}</div><div class="wire"><div class="perch" style="left:calc(50% - 46px);top:40px"><div class="g">${perched()}</div></div></div><p class="hint" style="text-align:center">${esc(T.walletWait)}</p>`;
  await Promise.all([loading, depoReady]);
  const m =(location.hash.match(/^#(r|s|n)=([0-9a-z-]{1,40})$/) || location.pathname.match(/^\/(r|s|n)\/([0-9a-z-]{1,40})$/));
  const first = !m ? ['home', {}] : m[1] === 'r' ? ['req', { id: m[2] }] : m[1] === 's' ? ['splitv', { id: m[2] }] : ['send', { to: m[2] + '.nim' }];
  try { history.replaceState({ view: 'home', data: {} }, '', LOCAL ? '/' : undefined); } catch {}
  if (first[0] !== 'home') try { history.pushState({ view: first[0], data: first[1] }, ''); } catch {}
  render(first[0], first[1]);
}
start();
