# AGENTS.md

This repository holds Pigeon (server/, web/) and the SDK for apps on .nim names (sdk/nim.js, sdk/hive-db.js). The same guide is served at https://signal.heylogram.tv/kovanapi/llms-full.txt.

## Hive: guide for coding agents

You are writing an app that lives in a Hive cell (a .nim name on the Nimiq chain). This file is the source of truth for the public API. Follow the rules marked MUST; they are where apps lose money or trust.

### What a cell gives you

- A static site: upload a .zip (index.html at the root or in one folder). It is served at https://signal.heylogram.tv/kovanapi/s/<name>/ and can get its own domain. No server code runs on Hive.
- HiveDB: a document database per name (collections → documents → fields), with read/write rules and server-checked field rules.
- Signed settings: key/value pairs the owner signs with their wallet. Anyone can read and verify them.
- Sales: the owner lists products; buyers pay the owner's wallet directly; Hive marks orders paid when it sees the payment on chain.
- Tips, a QR shop till ("Get paid") and sub-names (player.<name>.nim) from Pigeon.

### Hard limits of the sandbox

- The site runs in a sandboxed frame without same-origin. localStorage, sessionStorage, IndexedDB and cookies throw or vanish. MUST keep state in HiveDB, and wrap any storage access in try/catch.
- Allowed upload file types: .html .js .css .svg .png .jpg .webp .ico .json .webmanifest .woff2 .mp3 .wasm. Anything else (exe, apk, zip, map files…) makes the whole upload fail.
- Max upload 20 MB. A new upload replaces the whole site; the database, settings, orders and bees stay.
- Use relative paths inside the site (./app.js, not /app.js); the site is served under /s/<name>/.
- Wallet access works inside Nimiq Pay, in the Webboos browser, and in browsers with the Heylogram Wallet extension. nim.wallet() returns null elsewhere; show a hint instead of failing.

### Setup

```js
import { HiveDB } from 'https://signal.heylogram.tv/kovanapi/hive-db.js';
import { NimNames } from 'https://signal.heylogram.tv/kovanapi/nim.js';
const db = HiveDB('mygame');                 // your cell's .nim name, without .nim
const nim = NimNames({ app: 'mygame' });
const wallet = await nim.wallet();           // window.nimiq or the frame bridge; null when there is no wallet
```

### Sign-in

```js
const address = await db.signIn(wallet);     // the user signs a one-time message; no money moves
```

The address is compact (NQ… without spaces). A player session lasts 7 days. Every signed-in address becomes a permanent "bee" of the cell.

### Bees and visits (the counter in the hive)

Every cell shows its bees, and that is how a project is seen in the hive window. Nothing needs to be called for visits:

- Permanent bees: every address that signs in with `db.signIn(wallet)` and every address that holds a sub-name of the cell. Each address counts once and never expires.
- Today's bees: visitors of the site today. They reset every day (UTC).
- Total visits: all daily visitors added up since the start.

Where the visits come from:

- A site uploaded to Hive (`.zip`) is counted when its `index.html` is served, once per visitor per day.
- A site on your own server is counted by the one line Hive gives you when you link it (Site → My own server → "1 · Sign, get the line"). Paste it right before `</body>`:

```html
<script src="https://signal.heylogram.tv/kovanapi/ari.js" data-isim="yourname" data-imza="…" defer></script>
```

The same line proves the site is yours and counts one visit per browser per day. Put it on every page that should count; a page without it is not counted. Add `db.signIn` (above) if you also want permanent bees.

Visits are counted by the Hive server, not on chain; permanent bees rest on wallet signatures.

### HiveDB

```js
await db.col('scores').doc(address).set({ score: 120 });          // replace
await db.col('scores').doc(address).update({ score: 130 });       // merge
const row = await db.col('scores').doc(address).get();            // null when missing
const top = await db.col('scores').orderBy('score', 'desc').limit(10).get();   // [{ id, ...fields }]
const lvl2 = await db.col('scores').where('level', '==', 2).get(); // ops: == != < <= > >= array-contains
await db.col('scores').doc(address).delete();
```

Errors throw `Error(code)` with `.status` (400 bad data, 401 not signed in, 403 not allowed, 404, 429 too often or daily limit).

Read/write rules per collection (set by the owner in the Data tab):

- read: everyone | owner
- write: owner | player's own doc. With "player's own doc" a signed-in player may write ONLY the document whose id is their own address. Players cannot add() auto-id documents.

Field rules (checked on the server for every write; the browser cannot skip them):

- per field: type (number, text, on/off, list, object), min, max, max length, required, whole number, only goes up, locked
- per collection: only these fields can be written; same document at most once every N seconds
- the owner is exempt from "only goes up", "locked" and the time limit
- refused writes return codes like `alan_turu:score` (wrong type), `alan_buyuk:score` (above max), `alan_kucuk`, `alan_uzun`, `eksik_alan`, `izinsiz_alan:x`, `alan_azalamaz`, `alan_sabit`, `cok_sik_yazma` (429)

MUST for leaderboards and anything with prizes:

- Ask the owner to set field rules (number, min/max, whole number, only these fields, a time limit).
- Scores written by a browser can still be faked within the rules. For money or prizes keep the deciding step on a server the owner controls (write: owner), or let the owner review the top rows before paying.
- Show names that Hive resolves, never a name field the player typed: `(await db.myName(row.id)).shown`.
- Build rows with the server id: the SDK returns `{ ...fields, id }`, so a player cannot spoof `id`.

Limits per name: 50,000 reads and 20,000 writes per day, 50 MB total, 1 MB per document, 100 collections, at most 500 results per query.

### Names

```js
await nim.resolve('mando');          // { name, address } or null
await nim.nameOf(address);           // 'mando' or null
const me = await db.myName(address); // { own: 'mert', sub: 'lale.mygame', choice, shown: 'mert.nim' }
await db.useName('sub');             // the player picks which name shows in this app: 'own' | 'sub'
await nim.subsOpen();                // true when the owner lets players claim sub-names
await nim.claimSub('lale');          // the player claims lale.mygame.nim for their own wallet (tiny tx)
```

- Do not offer a sub-name to the cell owner (db.owner() equals the signed-in address).
- A player who has their own name keeps it; a sub-name is an extra name for your app. Let them choose.
- Display: own name large, parent small (lale · .mygame.nim). nim.badge(el, address) does this.

### Signed settings

```js
const s = await db.settings();       // { key: 'value', ... } signed by the owner
```

Use them for content the owner controls: announcements, prize amounts, feature switches. Values are strings; parse them yourself.

### Sales

The owner adds a signed setting `urunler` with a JSON list: `[{"id":"gem","ad":"Gem","fiyat":3,"stok":10}]` (fiyat = price in NIM, stok optional).

```js
const items = await db.products();        // [{ id, name, price, stock, left }]
const order = await db.buy('gem');        // signed-in player; { id, to, price, memo, status }
await nim.pay(order.to, order.price, order.memo);
const mine = await db.orders();           // status: pending | paid | partially_paid | expired
```

- MUST unlock an item only when the order status is `paid`. A wallet saying "sent" is not proof.
- Pass order.memo unchanged; Hive matches the payment by it.
- An open order holds stock for 24 hours, then expires. A player can have 3 open orders, a cell 50.
- Hive is not a party to the sale: no fee, no refunds; the owner is the seller.
- Paid items should be cosmetic or content when there are prizes; never sell an advantage in a prize competition and never sell chances to win.

### Tips and owner payouts

```js
const owner = await db.owner();                       // the owner's wallet address
await nim.pay(owner, 1, 'tip mygame.nim');            // tip
await nim.pay(winnerAddress, 2, 'prize 1');           // owner pays a prize from their own wallet
```

nim.pay throws when the wallet refuses or returns an error. Log prizes in a collection only the owner can write (for example the owner's own document with write "player's own doc"), and check that log before paying again.

### Shop till (QR) for counters

The owner opens the "Get paid" tab in the Hive panel, types an amount and shows a QR. It is a standard `nimiq:` payment link. The amount gets a few extra luna (12 NIM → 12.00387) so each open sale is unique: Nimiq Pay drops the note of a scanned QR, so Hive recognizes the payment by its exact amount, made after the sale was opened. A QR lasts 15 minutes. This is a panel feature for the owner; apps do not call it.

### Updating an app

Make the zip again and upload it in the Site tab. Nothing else changes.

### Pages every app needs

- privacy.html and a short guide inside the site, in plain words.
- robots.txt, sitemap.xml and llms.txt with the app's own address.
- A contact address of the app itself.

### Reference app

HAHA (https://signal.heylogram.tv/kovanapi/s/garura/) uses all of the above: sign-in, a leaderboard with field rules (score: whole number 1..1000000, only listed fields, once every 5 s), sub-names with name choice, signed settings (announcement, prize amounts), a shop (golden basket 5 NIM, spaceship 3 NIM), an owner prize panel and tips.
