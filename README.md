# Pigeon

Pay anyone on Nimiq by name. A Nimiq Pay mini app with `.nim` names, payment requests and bill splitting.

Live: <https://pigeon.heylogram.com> (open it in Nimiq Pay). Hosted on the Heylogram site platform; the server runs at `signal.heylogram.tv/pigeonapi`.

Money is a letter. You write `mert.nim`, seal it, and the pigeon flies to the right address. Every person shows up with their Nimiq Identicon, so you can see that the pigeon really belongs to them.

## What it does

- **Send by name.** Type `mert.nim` or an `NQ…` address. The app shows the address and its Identicon and says whether the name matches.
- **Request.** Tie a note to the pigeon's leg (amount and reason) and share the link. When the other person pays, the request turns into "paid" by itself.
- **Split.** Tear a bill into stamps, one per person. Each stamp gets a postmark when that person pays.
- **Get a ring.** Register your own `.nim` name, on chain, with one payment.
- **Fake link warning.** If a request claims to come from `mert.nim` but the money would go to another address, the app blocks the payment and shows both pigeons side by side.

Everything happens with real NIM on Nimiq mainnet, through the Nimiq Pay wallet. The app never holds keys or funds.

## How `.nim` names work

Nimiq has no smart contracts, so the name registry is a set of public rules applied to ordinary transactions. Anyone can rebuild the exact same table from the chain.

A registration is a transaction that:

1. goes to the registry address,
2. carries the note `nim:<name>` (lowercase letters, digits and single dashes, up to 32 characters),
3. pays at least the price of that name,
4. is included in a block and executed successfully.

If the payment comes from a wallet vault (an HTLC contract, which is how Nimiq Pay holds spendable funds), the name goes to the address that created that vault, which is the wallet's own top-up address. A vault cannot receive later payments, so this keeps every name payable. Anyone can check it: the vault's creation transaction is public.

The earliest valid registration of a name wins: lower block height first, and inside the same block the lower transaction hash. Later payments for a name that is already taken do not change its owner. The first name an address registers is its primary name, used to show who you are.

Prices depend on length: shorter names cost more. A few names such as `nimiq`, `admin` and `wallet` are reserved. The exact list and prices are in `server/config.json` and `server/rules.mjs`.

## How payments are matched

A request has a short id. The payer's wallet sends the payment with the note `ode:<id> <reason>`. The server reads the recipient's transactions on chain and counts every included payment whose note starts with that tag. Nobody has to report a payment, and the server cannot invent one.

## Security

- **No custody.** The app only asks Nimiq Pay to send a transaction. The user confirms every payment in the wallet.
- **Chain is the source of truth.** Names and paid requests are read from the Nimiq chain with the official `@nimiq/core` light client. The server is only an index; anyone can verify it.
- **Identicons.** Each address has a unique picture. The app shows it everywhere, so a lookalike name or a swapped address is easy to notice.
- **Fake request check.** A request can say which name it comes from. If that name belongs to a different address, the app refuses to pay.
- **Notes are public.** Notes are written on chain, and the app says so before you send.
- **Server limits.** The server validates every input, caps body size and rate limits requests.

## Run it

```bash
cd server
npm install
cp config.example.json config.json
npm test
npm start
```

The web app is plain HTML, CSS and JavaScript in `web/`. `web/build.mjs` bundles everything (including the Identicons and the QR code library) into one `web/dist/index.html` next to the icons and the manifest. Build it before starting the server, which serves `web/dist`:

```bash
cd web
npm install
npm run build
```

Set `registry` in `config.json` to the address that receives name registrations. Without it, the app still sends, requests and splits, and the ring screen says the registry opens soon. The server connects to Nimiq mainnet as a light client. The first sync takes a few seconds, and the API answers `503 syncing` until then.

Then open `http://127.0.0.1:5290` in a browser to look around. Sending needs Nimiq Pay.

## API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/registry` | registry address, prices, number of names, chain head |
| GET | `/api/name/:name` | owner address, or `free` with price, `reserved`, `invalid` |
| GET | `/api/address/:address` | primary name of an address |
| GET | `/api/balance/:address` | balance in luna |
| GET | `/api/incoming/:address?since=<height>` | incoming payments with notes and sender names |
| POST | `/api/request` | create a request `{ to, value, note, as }` |
| GET | `/api/request/:id` | request with on-chain payments and status |
| POST | `/api/split` | create a split `{ to, value, people, includeMe, note }` |
| GET | `/api/split/:id` | split with every part's status |

Amounts are in luna (1 NIM = 100,000 luna).

## Roadmap

The app keeps growing after the first release, the way ENS grew around Ethereum names. Planned updates, in order:

1. **Profiles.** A name can carry a display name, a short bio and links, set with signed notes from the owner.
2. **Transfer and sale.** The owner hands a name to another address with one signed transaction, and can list it for a price.
3. **Subnames.** `shop.mert.nim` and `team.mert.nim`, created by the owner of `mert.nim`.
4. **Fair registration.** Commit and reveal, so nobody can copy a pending registration from the mempool, plus automatic refunds for losing payments.
5. **Merchant QR.** A printed code for a shop. The customer scans it, sees the shop's name and Identicon, and pays the amount on screen.
6. **Community jar.** A shared pot with a name, where a group collects money for something and everyone sees who paid.
7. **Name search for other apps.** A small public library so any Nimiq app can turn `mert.nim` into an address with the same rules.

## Built with

[@nimiq/core](https://github.com/nimiq/core-rs-albatross) (Apache-2.0), [@nimiq/identicons](https://github.com/nimiq/identicons) (ISC) and the Nimiq Pay mini app provider. No framework: plain HTML, CSS and JavaScript, bundled with esbuild for hosting. QR codes by [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).

## License

MIT
