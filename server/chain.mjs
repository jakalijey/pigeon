import * as Nimiq from '@nimiq/core';
import { vaultOwner } from './vaults.mjs';

export async function createChain({ network = 'MainAlbatross', log = console.log } = {}) {
  const config = new Nimiq.ClientConfiguration();
  config.network(network);
  config.logLevel('error');
  const client = await Nimiq.Client.create(config.build());
  await client.waitForConsensusEstablished();
  log(`chain: consensus on ${network}, head ${await client.getHeadHeight()}`);

  // max: the API reads any address someone asks for, so it stops after max transactions (the newest pages come first).
  // The registry reads without max: a partial history could let "first registration wins" pick the wrong owner, so it fails loudly instead.
  async function history(address, since = 0, max = Infinity) {
    const all = [];
    let startAt = null;
    let full = false;
    for (let page = 0; page < 20000; page++) {
      const batch = await client.getTransactionsByAddress(address, since, [], startAt, 500);
      all.push(...batch);
      if (batch.length < 500 || all.length >= max) { full = true; break; }
      startAt = batch[batch.length - 1].transactionHash;
    }
    if (!full) throw new Error(`history of ${address} exceeds the scan limit; refusing to continue with a partial history`);
    const seen = new Set();
    return all.filter((t) => !seen.has(t.transactionHash) && seen.add(t.transactionHash))
      .sort((a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0));
  }

  const listen = (addresses, fn) => client.addTransactionListener(fn, addresses);
  const unlisten = (id) => client.removeListener(id);
  const head = () => client.getHeadHeight();
  const balance = async (address) => Number((await client.getAccount(address)).balance ?? 0);
  const account = async (address) => client.getAccount(address);
  const compact = (a) => String(a || '').replace(/\s/g, '').toUpperCase();
  const pretty = (a) => compact(a).replace(/(.{4})/g, '$1 ').trim();
  // vault -> owner, final answers only (null: the refund address did not make that vault)
  const vaultOwners = new Map();
  const vaultOwnerOf = (address) => {
    if (vaultOwners.size > 20000) vaultOwners.clear();
    return vaultOwner(address, { historyOf: (x) => history(pretty(x), 0), compact, cache: vaultOwners });
  };
  const creatorOf = async (address) => (await vaultOwnerOf(address))?.owner ?? null;

  return { history, listen, unlisten, head, balance, account, creatorOf, vaultOwnerOf, client };
}
