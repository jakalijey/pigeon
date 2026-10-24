# Changelog

What changed in Pigeon, newest first. The app at <https://pigeon.heylogram.com> always runs the latest version.

## 24 October 2026: Every name gets a home

Video: <https://youtu.be/vo6qgR4q9zA>

- **Hive.** Every `.nim` name now has a cell in [Hive](https://hive.heylogram.com). Pigeon's home screen shows "yourname.nim has a cell in Hive" and opens it.
- **Site and domain.** Upload a built site as a `.zip` or link your own server, then connect a domain you bought. The certificate comes by itself.
- **QR till for the counter.** Type an amount, show a one-time `nimiq:` QR, and the screen turns green when the payment is seen on chain. Each open sale gets a unique amount (12 NIM becomes 12.00387) because Nimiq Pay drops the note of a scanned code. Tested with a real payment on mainnet.
- **Shop, tips and prizes.** Products in signed settings, paid wallet to wallet. An order is marked paid only when the payment is on chain. Visitors can tip 1, 5 or 10 NIM.
- **Database with server-side rules.** Every name has a document database. Players sign in by signature and write only their own document. Field rules (type, min, max, length, only goes up, locked, time limit) are checked on the server.
- **Pictures on your page.** A cover picture and a products card with photos.
- **On a computer.** Sign in with the Heylogram Wallet extension, or open `garura.nim` in the Webboos browser.
- **SDK and a guide for coding agents.** [`sdk/`](sdk/README.md) (`nim.js`, `hive-db.js`) and [AGENTS.md](AGENTS.md).
- **Sub-names and gifts.** `lale.garura.nim` given by the owner or claimed by players when the owner opens them; gift codes for free names.
- **Roadmap.** The November item "pay at the shop" arrived early.

## 18 October 2026: Rings and accounts

- The leg ring: engraved name, the owner's Identicon seal and registration number. Tap it to replay the engraving.
- Names paid from a Nimiq Pay vault belong to the vault's creator, so every name stays payable.
- The named or funded account shows as the main address.
- The action button stays above the keyboard.
- Roadmap with dated updates.

## 17 October 2026: First release

Video: <https://youtu.be/gAgeB7Ck_w8>

- Send NIM by name, payment request links, bill splitting with stamps, and getting a `.nim` ring, inside Nimiq Pay.
- Fake link warning: a request that claims a name but pays another address is blocked.
- Follows the Nimiq Pay language; uses every wallet account for balance and incoming letters.
