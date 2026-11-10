// Nimiq Pay vaults (HTLC). Pay writes the user's own wallet as the refund address ("sender") of every vault,
// also when it extends a vault: the new vault is then created FROM the old vault, so the creating transaction's
// sender is an HTLC, not the user. The owner is therefore read from the HTLC data, never from the transaction sender.

const valid = (t) => t.executionResult !== false && t.state !== 'invalidated' && t.state !== 'expired';

/** Owner (refund address) of the vault created by transaction t, or null. */
export function vaultOwnerFromCreation(t, compact) {
  return t?.recipientType === 'htlc' && t.data?.type === 'htlc' && t.data.sender ? compact(t.data.sender) : null;
}

/**
 * Who a vault belongs to, from that vault's own history. Never returns an HTLC address:
 * if the owner cannot be read (no HTLC data and the creator is itself an HTLC) the answer is null (caller waits).
 */
export function vaultOwner(txs, vault, compact) {
  const made = txs.find((t) => t.recipientType === 'htlc' && compact(t.recipient) === vault);
  if (!made) return null;
  const owner = vaultOwnerFromCreation(made, compact);
  if (owner) return owner;
  return made.senderType === 'htlc' ? null : compact(made.sender);
}

/**
 * Live vaults of address a: vaults a created, plus vaults Pay created from them when extending (followed newest first).
 * historyOf(prettyAddress) and account(prettyAddress) read the chain; maxReads bounds the work.
 */
export async function findVaults(a, { historyOf, account, compact, pretty, maxReads = 40 }) {
  const txs = await historyOf(pretty(a));
  const created = [...new Set(txs.filter((t) => t.recipientType === 'htlc' && compact(t.sender) === a && valid(t)).map((t) => compact(t.recipient)))].slice(-50);
  const seen = new Set(created);
  const queue = [...created].reverse();
  const vaults = [];
  let reads = 0;
  while (queue.length && reads < maxReads) {
    const v = queue.shift();
    reads++;
    const acc = await account(pretty(v)).catch(() => null);
    if (acc?.type === 'htlc') {
      if (compact(acc.sender) === a && acc.balance > 0) vaults.push({ address: pretty(v), value: acc.balance, timeout: acc.timeout ?? null });
      continue;
    }
    // emptied vault: if Pay extended it, it moved its funds into a new vault whose refund address is still a
    reads++;
    const out = await historyOf(pretty(v)).catch(() => []);
    for (const t of out) {
      if (compact(t.sender) !== v || !valid(t) || vaultOwnerFromCreation(t, compact) !== a) continue;
      const next = compact(t.recipient);
      if (!seen.has(next)) { seen.add(next); queue.unshift(next); }
    }
  }
  return vaults;
}
