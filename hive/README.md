# Hive

Hive gives every `.nim` name from the [Pigeon](../README.md) registry a cell in a shared honeycomb. A cell is the name's home on the web:

- **Site.** Upload a built site as a `.zip`, or link a site that runs on your own server. A linked site proves ownership with one signed line on its page (the bee counter script with `data-imza`), or with `/.well-known/hive.json`.
- **Domain.** Point your own domain at the cell. Ownership is checked with a DNS TXT record (`_hive.<domain>`), then a certificate is issued.
- **HiveDB.** A small Firestore-like database per name: collections, documents, nested fields, queries (`where`, `orderBy`, `limit`). Rules are per collection and are enforced on the server: who may read, who may write (owner, or a player writing only their own document), and field rules (type, min/max, integer, only increasing, required, fixed, max length, write interval).
- **Signed settings.** Key-value settings signed by the owner's wallet. Anyone can read and verify them; a change only passes with the owner's signature and a higher version number.
- **Shop and orders.** The owner lists products in the signed settings. A buyer opens an order and pays from their own wallet straight to the owner. Hive never holds money; it watches the chain through Pigeon and marks the order paid only when the id, recipient and amount match.
- **Tips.** Visitors can tip the name owner from their own wallet.
- **QR till.** The owner types an amount and shows a one-time QR. Each open sale gets a unique amount (a few luna added), so the payment is recognised on chain even when the wallet drops the note.
- **Bees.** Bees are the cell's visitors and users. Users who sign in with their wallet (or hold a sub-name under the cell) are lasting bees; today's visitors are shown faded. A bee can show its own `.nim` name or its sub-name under the cell.

Sign-in is always a wallet signature (Nimiq Pay, or any wallet that provides `window.nimiq`). The server keeps no private keys of users.

## Live instance

- App: <https://hive.heylogram.com> (best opened in Nimiq Pay)
- API: <https://signal.heylogram.tv/kovanapi>
- Developer guide (full API, rules, recipes): <https://signal.heylogram.tv/kovanapi/llms-full.txt>, short version at `/llms.txt`
- Browser modules: `https://signal.heylogram.tv/kovanapi/hive-db.js` (HiveDB) and `https://signal.heylogram.tv/kovanapi/nim.js` (Nimiq Names SDK)

## Files

| File | What it is |
|---|---|
| `server.mjs` | HTTP server and API (cells, sites, uploads, domains, database, settings, orders, till, bees) |
| `db.mjs` | HiveDB storage, queries and rule checks |
| `kimlik.mjs` | Wallet signature checks, sign-in codes and sessions, signed settings, site proof line |
| `zip.mjs` | Small read-only ZIP reader for site uploads (path and size limits) |
| `index.html`, `uygulama.js` | The Hive page (panel, room, shop window, till, database console) |
| `motor.js` | The honeycomb renderer (PixiJS / WebGL) |
| `vendor/pixi.mjs` | PixiJS v8.19.0, unchanged third-party build, MIT licence (see its header) |
| `nim.js` | Nimiq Names SDK for other sites and mini apps |
| `hive-db.js` | HiveDB browser client |
| `derle.mjs` | Packs the page into one HTML file (`dist/index.html`) |
| `llms.txt`, `llms-full.txt` | Developer guide served by the API |
| `public/` | Icons and web manifest |
| `sunucu/` | Server container: `Dockerfile`, `package.json`, `package-lock.json` |
| `test-*.mjs` | Tests against a local server |

## Run locally

Requires Node.js 22.

```sh
cd hive
cp sunucu/package.json sunucu/package-lock.json .
npm ci
NIMIQ_CORE=@nimiq/core \
IDENTICONS=./node_modules/@nimiq/identicons/dist/identicons.bundle.min.js \
DATA_DIR=./data \
node server.mjs
```

Then open <http://127.0.0.1:5197>. Without `CANLI=1` the server runs in demo mode: sample names are added next to the real ones and a demo wallet signs for the sample names, so you can try everything without Nimiq Pay.

Environment variables read by the code:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `5197` | Port to listen on |
| `HOST` | `127.0.0.1` | Address to listen on |
| `DATA_DIR` | the source folder | Where data is written (`veri.json`, `db/`, `siteler/`, `medya/`, `alan/`) |
| `CANLI` | unset | `1` = live mode: no sample names, no demo wallet, no GitHub builds |
| `PIGEON_API` | `https://signal.heylogram.tv/pigeonapi` | Pigeon registry API |
| `DEFTER_UYGULAMA` | `pigeon` | The `.nim` name of the registry app |
| `NIMIQ_CORE` | a local path | Module to import for `@nimiq/core` (use `@nimiq/core`) |
| `IDENTICONS` | a local path | Path to the `@nimiq/identicons` browser bundle |
| `SITE_KOK` | empty | Public URL prefix for uploaded sites (`<SITE_KOK>/s/<name>/`) |
| `API_KOK` | `http://127.0.0.1:<PORT>` | Public API base written into the bee counter script (`ari.js`) |

The defaults for `NIMIQ_CORE` and `IDENTICONS`, and the module paths at the top of `derle.mjs` (esbuild, qrcode-generator, identicons), point to the original development machine. Set the variables, or edit those paths in `derle.mjs`, before building.

The live container is built from `sunucu/Dockerfile` with the server files copied next to it; see the `ENV` line there for the live settings.

## Tests

Start the server in demo mode (see above), then in another terminal:

```sh
node test-db.mjs      # HiveDB: structure, queries, rules, player sign-in, limits, speed
node test-giris.mjs   # sign-in text tampering is rejected (owner and player)
node test-kimlik.mjs  # unauthorised writes, demo sign-in, signed settings, site proof, bee counter
node test-nim.mjs     # nim.js SDK with a fake wallet (reads names from the live Pigeon API, sends no money)
node test-sina.mjs    # zip publish, own-server site link, storage load, quota
```

Notes:

- The sign-in endpoints are rate limited per IP per minute; running all tests back to back can hit the limit. Wait a minute between runs.
- `test-kimlik.mjs` uses `garura` as a sample name. `garura` is now a real name on the live registry, so the demo wallet refuses to sign for it and the owner steps of that test fail.
- `test-sina.mjs` step 1 needs a built site at `derle/knock-site.zip`, which is not in this repo. Step 2 links a site on `127.0.0.1`, which the server now rejects (only public https addresses can be linked).

## Names in the code

Identifiers, API paths and some messages are in Turkish. A short glossary:

| Turkish | English |
|---|---|
| isim | name |
| petek | cell |
| kovan | hive |
| arı (`ari`) | bee (visitor / user) |
| kasa | till / vault |
| sahip | owner |
| oyuncu | player (app user) |
| defter | registry |
| ayar | settings |
| imza | signature |
| giriş (`giris`) | sign-in |
| oturum | session |
| depo | storage |
| ürün (`urun`) | product |
| sipariş (`siparis`) | order |
| ödendi (`odendi`) | paid |
| bahşiş (`bahsis`) | tip |
| alan (adı) | domain |
| kural | rule |
| vitrin | shop window |
| ziyaret | visit |
| site yükle (`yukle`) | upload site |
| derle | build |
| sunucu | server |
| kimlik | identity |
| motor | engine (renderer) |
| uygulama | app |
| canlı (`CANLI`) | live |
| örnek (`ornek`) | sample |

## Licence

MIT, see [LICENSE](../LICENSE). `vendor/pixi.mjs` is PixiJS, also under the MIT licence.
