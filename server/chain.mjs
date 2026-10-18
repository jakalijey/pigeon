import * as Nimiq from '@nimiq/core';

export async function createChain({ network = 'MainAlbatross', log = console.log } = {}) {
  const config = new Nimiq.ClientConfiguration();
  config.network(network);
  config.logLevel('error');
  const client = await Nimiq.Client.create(config.build());
  await client.waitForConsensusEstablished();
  log(`chain: consensus on ${network}, head ${await client.getHeadHeight()}`);

  async function history(address, since = 0) {
    const all = [];
    let startAt = null;
    for (let page = 0; page < 200; page++) {
      const batch = await client.getTransactionsByAddress(address, since, [], startAt, 500);
      all.push(...batch);
      if (batch.length < 500) break;
      startAt = batch[batch.length - 1].transactionHash;
    }
    const seen = new Set();
    return all.filter((t) => !seen.has(t.transactionHash) && seen.add(t.transactionHash))
      .sort((a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0));
  }

  const listen = (addresses, fn) => client.addTransactionListener(fn, addresses);
  const unlisten = (id) => client.removeListener(id);
  const head = () => client.getHeadHeight();
  const balance = async (address) => Number((await client.getAccount(address)).balance ?? 0);
  const account = async (address) => client.getAccount(address);
  const creators = new Map();
  async function creatorOf(address) {
    const key = String(address).replace(/\s/g, '').toUpperCase();
    if (creators.has(key)) return creators.get(key);
    const txs = await history(address, 0);
    const made = txs.find((t) => t.recipientType === 'htlc' && String(t.recipient).replace(/\s/g, '').toUpperCase() === key);
    const who = made ? String(made.sender).replace(/\s/g, '').toUpperCase() : null;
    if (who) creators.set(key, who);
    return who;
  }

  return { history, listen, unlisten, head, balance, account, creatorOf, client };
}
