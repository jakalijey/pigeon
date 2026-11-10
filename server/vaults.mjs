// Nimiq Pay vaults (HTLC). Pay writes the user's own wallet as the refund address ("sender") of every vault,
// also when it extends a vault: the new vault is then created FROM the old vault, so the creating transaction's
// sender is an HTLC, not the user. Whoever creates a vault can write any refund address into it, so the refund
// address counts only when that wallet made the vault: itself, or by extending a vault that is its own.

const valid = (t) => t.executionResult !== false && t.state !== 'invalidated' && t.state !== 'expired';

/** Refund address written in the vault created by transaction t, or null. */
export function vaultOwnerFromCreation(t, compact) {
  return t?.recipientType === 'htlc' && t.data?.type === 'htlc' && t.data.sender ? compact(t.data.sender) : null;
}

/**
 * Who a vault belongs to. { owner } is a final answer (owner null: the refund address did not make this vault);
 * null means the creation is not visible yet, ask again later. Never returns an HTLC address.
 * historyOf(vault) reads a vault's transactions; cache keeps final answers between calls.
 */
export async function vaultOwner(vault, { historyOf, compact, cache = new Map(), depth = 0, maxDepth = 100 }) {
  const v = compact(vault);
  if (cache.has(v)) return { owner: cache.get(v) };
  if (depth > maxDepth) return { owner: null };   // an endless chain of vaults is refused
  const made = (await historyOf(v)).find((t) => t.recipientType === 'htlc' && compact(t.recipient) === v && valid(t));
  if (!made) return null;
  const refund = vaultOwnerFromCreation(made, compact);
  let owner = null;
  if (refund && made.senderType !== 'htlc') owner = compact(made.sender) === refund ? refund : null;
  else if (refund) {
    const up = await vaultOwner(made.sender, { historyOf, compact, cache, depth: depth + 1, maxDepth });
    if (!up) return null;
    owner = up.owner === refund ? refund : null;
  }
  cache.set(v, owner);
  return { owner };
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
