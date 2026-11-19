# Contributing

Thanks for looking. Pigeon is small and run by one person, so short, focused changes are the easiest to take.

## Before you start

- **A bug or an idea:** open an [issue](https://github.com/jakalijey/pigeon/issues) and say what you saw and what you expected.
- **A security problem:** do not open an issue. Follow [SECURITY.md](SECURITY.md).
- **A change to the name rules** (`server/rules.mjs`, `server/vaults.mjs`): open an issue first. Names already registered on chain must keep their owners, so a rule change has to work for every past transaction too.

## Set up

You need Node.js 20 or newer.

```bash
cd server && npm install && cd ..
cd web && npm install && npm run build && cd ..
```

The web build reads the Identicons from `server/node_modules`, so install the server first. See [Run it](README.md#run-it) to start the server.

## Tests

Run them before you send a change; GitHub runs the same ones on every push and pull request.

```bash
(cd server && npm test)    # name registry rules and vault owners
(cd sdk && npm test)       # nim.js and hive-db.js, with a fake wallet and a fake server
(cd web && npm run build)  # the app bundles without errors
```

Hive has its own tests against a local server in demo mode; see [hive/README.md](hive/README.md#tests). GitHub runs `test-db.mjs` and `test-giris.mjs`.

Add a test when you change a rule or the SDK. No test needs a real wallet or real money.

## What to keep in mind

- **No framework.** The web app is plain HTML, CSS and JavaScript; the SDK has no dependencies. Please keep it that way.
- **The SDK has two copies.** `sdk/nim.js` and `sdk/hive-db.js` are the same files Hive serves from `hive/`. Change both; the SDK test fails when they differ.
- **Note words stay as they are.** `nim:`, `alt:`, `altac:`, `altkapa:`, `ana:`, `hediye:` and `ode:` are already on chain; new behaviour gets a new word, never a new meaning for an old one.
- **Money and names.** Never send a payment or a registry note to an address that came from a server answer without checking it. The registry address is fixed in `nim.js` for this reason.
- **Plain English** in the README, docs and messages the user sees.

## Pull requests

- One topic per pull request, with a short note on what changed and how you tested it.
- Update [CHANGELOG.md](CHANGELOG.md) when users or developers will notice the change.
- By sending a pull request you agree that your code is released under the [MIT License](LICENSE).
