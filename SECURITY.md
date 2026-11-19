# Security

Pigeon moves real NIM and decides who owns a `.nim` name, so a security report is the most useful thing you can send.

## Report a problem

Email **pigeon@heylogram.com** with:

- what you found and where (file and line, or the API path),
- the steps to show it, on mainnet or with a local server,
- what an attacker gains: money, a name, a fake sender, or a way to stop the service.

Please do not open a public issue for a problem that can cost someone money or a name until it is fixed. You get an answer within 3 days. When a fix ships, it is listed in [CHANGELOG.md](CHANGELOG.md), and you are credited there if you want.

There is no bug bounty.

## What is in scope

- **The name registry rules** (`server/rules.mjs`, `server/vaults.mjs`, `server/chain.mjs`): anything that gives a name to the wrong address, lets someone act for a name they do not own (`alt:`, `altac:`, `altkapa:`, `ana:`), or makes the server's table differ from what the chain says.
- **Payment matching** (`ode:` notes, requests and splits): a request shown as paid when it was not, or a payment credited to the wrong request.
- **The web app** (`web/`): anything that makes a user pay a different address than the one shown, or hides the fake-link and look-alike warnings.
- **The SDK** (`sdk/nim.js`, `sdk/hive-db.js`, npm `pigeon-nim`): anything that sends a payment or a registry note somewhere the caller did not ask for. The registry address is fixed in the code on purpose.
- **Hive** (`hive/`): sign-in, database rules, signed settings, orders and the QR till.
- **The live servers** at `api.heylogram.com/pigeon` and `api.heylogram.com/hive`, for the code in this repository.

Please test against your own names and small amounts. Do not try to take down the live servers or read other people's data.

## How it is built to be safe

- **No custody.** The app and the SDK never hold keys or funds. Every payment is confirmed by the user in Nimiq Pay (or another wallet that provides `window.nimiq`).
- **The chain decides.** Names and paid requests are rebuilt from public Nimiq transactions with the official `@nimiq/core` light client. The server is an index; anyone can rebuild the same table.
- **Fixed registry address.** The SDK sends registry notes only to the address written in `nim.js`; no server answer can change it.
- **Checked addresses.** Every address is checked with the Nimiq alphabet and checksum before money or a name goes to it.
- **Vault owners.** A Nimiq Pay vault counts for its refund address only when that wallet created the vault.
- **Tests on every push** for the registry rules, vault owners and the SDK (`.github/workflows/test.yml`).

## Known limits

These are known and on the [roadmap](README.md#roadmap). Reports about them are still welcome if you find a new way they can hurt someone.

- **Registrations can be copied before they are mined.** A registration is a public transaction, so someone who sees it waiting can send the same name with a higher fee. Commit and reveal is planned for December 2026.
- **Losing payments are not refunded automatically.** A payment for a name that is already taken stays with the registry. Automatic refunds are planned with commit and reveal.
- **Notes are public.** Everything written in a payment note is on chain for anyone to read. The app says so before you send.
- **Hive visit counts are not on chain.** Visits are counted by the Hive server; permanent users (bees) rest on wallet signatures.
- **No outside audit.** The code has not been reviewed by an outside security firm.
