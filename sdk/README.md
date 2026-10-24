# Pigeon SDK

Use `.nim` names in any website, game or Nimiq Pay mini app. One import, no keys, no build step.

Two small ES modules:

- **`nim.js`**: names. Resolve `mert.nim` to an address, show a name next to an address, log users in with their wallet, pay by name, and give or claim sub-names under your own name.
- **`hive-db.js`**: a Firestore-like database for apps that own a `.nim` name. Players sign in with their wallet; the owner's settings are signed and public.

Both are served live, so you can import them straight away:

```html
<script type="module">
  import { NimNames } from 'https://signal.heylogram.tv/kovanapi/nim.js';
  import { HiveDB } from 'https://signal.heylogram.tv/kovanapi/hive-db.js';
</script>
```

Or copy the two files from this folder into your own project. They have no dependencies.

Names come from the Pigeon registry on the Nimiq chain (see the main [README](../README.md) for the rules). Signing and paying always happen in the user's own wallet: Nimiq Pay, or any wallet that provides `window.nimiq`. The SDK never sees a key.

## Names: `nim.js`

```js
import { NimNames } from 'https://signal.heylogram.tv/kovanapi/nim.js';
const nim = NimNames({ app: 'mygame' });   // app = your own .nim name (needed for login and sub-names)

await nim.resolve('mando');                // { name: 'mando', address: 'NQ44 …' } or null
await nim.nameOf('NQ44 …');                // 'mando' or null (also finds the owner of a Nimiq Pay vault)
await nim.price('newname');                // { free: true, price: 50 } in NIM, or { free: false }
await nim.login();                         // { address, name, key }: the user signs once
await nim.pay('mando', 10, 'thanks');      // 10 NIM to mando.nim from the user's wallet, optional note
nim.badge(element, 'NQ44 …');              // writes "mando.nim" into the element
```

| Method | What it does |
|---|---|
| `resolve(name)` | Name or sub-name to address. Returns `null` when the name is not registered. |
| `nameOf(address)` | The primary name of an address, or `null`. |
| `price(name)` | Whether a name is free and its price in NIM. |
| `login()` | Asks the wallet to sign a one-time message for your app. Returns the address, its name and a session key. |
| `pay(to, amountNim, note?)` | Sends NIM to a name or an address. The note is cut to 64 bytes, the chain limit. |
| `label(name)` | `{ own, parent, full }`, for example `mert`, `sunset.nim`, `mert.sunset.nim`. |
| `badge(el, address, options?)` | Writes the name into `el`. Options: `format(label)` for your own text, `className`, `small: false` to hide the parent name. |
| `names(address)` | `{ own, sub }`: the player's own .nim name and their sub-name under `app`, if any. |
| `subsOpen()` | `true` when the owner of `app` lets players claim their own sub-name. |
| `claimSub(sub)` | The player takes `sub.app` for their own wallet (only while sub-names are open). |
| `giveSub(sub, to)` | The owner of `app` gives `sub.app` to an address or a `name.nim`. |
| `wallet()` | The wallet provider, or `null` if there is none. |

Options for `NimNames({ … })`: `app`, `pigeon` and `hive` (server URLs), `cacheMs` (default 60 s), `registry` (the registry address; it is fixed in code so no server answer can redirect a payment).

### Show names the same way everywhere

A sub-name belongs to someone inside an app. Inside that app, show the user's own part large and the parent small: **mert** <sub>.sunset.nim</sub>. The full name stays in the tooltip. `badge()` does this by default.

```js
nim.badge(el, address);                                        // mert  .sunset.nim
nim.badge(el, address, { format: (l) => l.own });             // mert
nim.badge(el, address, { className: 'my-badge', small: false });
```

### Sub-names for your players

If you own `mygame.nim`, your players can have `mert.mygame.nim`.

- **You give one:** `giveSub('mert', 'NQ…')` or `giveSub('mert', 'mert.nim')`. The owner's wallet sends 1 luna to the registry with the note `alt:mert.mygame:<address>`.
- **Players claim their own:** first open sub-names once from the Pigeon app (or send `altac:mygame` yourself). Then each player calls `claimSub('mert')` and gets `mert.mygame.nim` for their own wallet. `altkapa:mygame` closes it again.

A sub-name and its parent together can be at most 22 characters.

### Two names, the player chooses

A player may own `mert.nim` and also take `lale.mygame.nim`. Show their own name by default; if they have both, let them pick with `db.useName('own' | 'sub')`. Sub-names never become cells on the hive map; they are listed inside their parent's cell.

### Always check payments on chain

A wallet answer alone is not proof of payment. Before you hand out anything of value, look the payment up on chain, for example with Pigeon's `/api/incoming/:address` or your own Nimiq node.

## Database: `hive-db.js`

Every `.nim` name in the hive has a small database. Read access is public or owner-only per collection; write access is owner-only or "each player writes their own document".

```js
import { HiveDB } from 'https://signal.heylogram.tv/kovanapi/hive-db.js';
const db = HiveDB('mygame');                                   // the database of mygame.nim

await db.signIn();                                             // the player signs with Nimiq Pay; known by their address
await db.col('players').doc(db.address).set({ nick: 'ali', gold: 5 });
const top10 = await db.col('scores').where('level', '==', 2).orderBy('points', 'desc').limit(10).get();
const settings = await db.settings();                          // the owner's signed settings (anyone can read)
```

| Call | What it does |
|---|---|
| `signIn(wallet?)` | Player sign-in with a wallet signature. Sets `db.address`. |
| `myName(address?)` | `{ own, sub, choice, shown }`: the player's names in this app and the one shown (their choice, else own, else sub). |
| `useName('own' \| 'sub')` | The signed-in player picks which name this app shows. Kept per app. |
| `bees()` | This cell's bees (players who signed in and sub-name owners) with the names they chose. |
| `settings()` | The owner's signed key–value settings. |
| `col(name).get()` | Query with `where(field, op, value)`, `orderBy(field, 'asc' \| 'desc')`, `limit(n)`. `op` is `==`, `!=`, `<`, `<=`, `>`, `>=` or `array-contains`. |
| `col(name).add(data)` | New document with an automatic id. |
| `col(name).doc(id).get() / set() / update() / delete()` | One document. `update` merges fields. |

The owner manages collections, rules and settings in the cell's room on [hive.heylogram.com](https://hive.heylogram.com). Each name has a storage and request quota; the room shows today's usage.

## Try it

Open [`example.html`](example.html) in a browser. It resolves names, shows a badge and checks prices without a wallet; login and pay need Nimiq Pay.

## License

MIT, same as the rest of this repository.
