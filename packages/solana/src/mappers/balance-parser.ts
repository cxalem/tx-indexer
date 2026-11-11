import type { Address } from "@solana/kit";
import type {
  RawTransaction,
  TokenBalance,
  TokenBalanceStatus,
} from "@tx-indexer/core/tx/tx.types";
import type { MoneyAmount, TokenInfo } from "@tx-indexer/core/money/money.types";
import {
  getTokenInfo,
  KNOWN_TOKENS,
  TOKEN_INFO,
} from "@tx-indexer/core/money/token-registry";

export interface TokenBalanceChange {
  mint: string;
  tokenInfo: TokenInfo;
  accountIndex: number;
  /**
   * Who the movement is attributed to: the PRE owner for the debit of an
   * account that is closed in the transaction (or the pre side of an
   * authority change / reinitialisation), the POST owner otherwise. Undefined
   * when the balance metadata does not report an owner; callers then use the
   * token account address (`tokenAccount`), never the mint.
   */
  owner?: string;
  /** Owner in the pre token balance entry, if the account existed before */
  preOwner?: string;
  /** Owner in the post token balance entry, if the account exists after */
  postOwner?: string;
  /** The token account address (`accountKeys[accountIndex]`), if known */
  tokenAccount?: string;
  /** Token program that owns the account (SPL Token or Token-2022), if reported */
  programId?: string;
  preBalance: {
    raw: string;
    ui: number;
  };
  postBalance: {
    raw: string;
    ui: number;
  };
  /**
   * `raw` is the exact signed integer delta (post - pre) and decides debit vs
   * credit. `ui` is for display only.
   */
  change: {
    raw: string;
    ui: number;
  };
}

export interface SolBalanceChange {
  accountIndex: number;
  address: string;
  preBalance: bigint;
  postBalance: bigint;
  change: bigint;
  changeUi: number;
}

/**
 * Whether a transaction's token balance snapshots can be used. Both
 * `preTokenBalances` and `postTokenBalances` must be present: an empty array
 * is an available snapshot with no token accounts, while a missing one
 * (`undefined`/`null`, e.g. no transaction metadata) is unavailable, and no
 * token balance change is derived from it.
 */
export function tokenBalancesAvailable(tx: RawTransaction): boolean {
  return (
    tx.preTokenBalances !== undefined &&
    tx.preTokenBalances !== null &&
    tx.postTokenBalances !== undefined &&
    tx.postTokenBalances !== null
  );
}

/**
 * Explicit availability of the token balance snapshots, set by both fetch
 * paths on `RawTransaction.tokenBalanceStatus`.
 */
export function tokenBalanceStatusOf(tx: RawTransaction): TokenBalanceStatus {
  if (tokenBalancesAvailable(tx)) return { status: "available" };
  const missing = [
    tx.preTokenBalances == null ? "preTokenBalances" : null,
    tx.postTokenBalances == null ? "postTokenBalances" : null,
  ].filter(Boolean);
  return {
    status: "unavailable",
    reason: `${missing.join(" and ")} missing from the transaction metadata; no token balance changes derived`,
  };
}

const NATIVE_MINT = KNOWN_TOKENS.SOL;

function uiOf(bal: TokenBalance | undefined): number {
  return bal?.uiTokenAmount.uiAmountString
    ? parseFloat(bal.uiTokenAmount.uiAmountString)
    : 0;
}

function tokenInfoFor(mint: string, decimals: number): TokenInfo {
  return (
    getTokenInfo(mint) ?? {
      mint,
      symbol: mint.slice(0, 8),
      decimals,
      name: `Unknown Token (${mint.slice(0, 8)}...)`,
    }
  );
}

/**
 * Extracts all SPL token balance changes from a transaction.
 *
 * Changes are built from the UNION of the pre and post token balance entries,
 * keyed by `accountIndex`. Within an available snapshot a missing entry means
 * zero on that side, so:
 * - an account present before and after, with the same mint and owner, yields
 *   its net change (post - pre);
 * - an account created in the transaction (post only) yields a credit of its
 *   post amount, attributed to the post owner;
 * - an account closed in the transaction (pre only) yields a debit of its pre
 *   amount, attributed to the PRE owner;
 * - when the owner changed (authority change) or the index holds a different
 *   mint before and after (close and reinitialise), the two sides are NOT
 *   netted: the pre side is a debit for the pre owner / mint and the post side
 *   a credit for the post owner / mint.
 *
 * Debit vs credit is decided from the raw integer amounts (bigint); the UI
 * amounts are carried for display only.
 *
 * Native mint (wSOL) scope limit: pre-side entries in the native mint are not
 * emitted on their own (a closed wSOL account, or the pre side of a split),
 * and a wSOL account present on both sides keeps its single net change. wSOL
 * movements are represented by lamport deltas in `transactionToLegs`.
 *
 * If either snapshot is unavailable (see `tokenBalancesAvailable`) no change
 * is returned: missing data is never read as zero balances.
 *
 * Unknown tokens are included with a generated symbol from their mint address.
 *
 * @param tx - Raw transaction with token balance data
 * @param filterMints - Optional array of mint addresses to filter to specific tokens
 * @returns Array of token balance changes with mint, owner, and amount information
 */
export function extractTokenBalanceChanges(
  tx: RawTransaction,
  filterMints?: string[]
): TokenBalanceChange[] {
  if (!tokenBalancesAvailable(tx)) return [];
  const preTokenBalances = tx.preTokenBalances!;
  const postTokenBalances = tx.postTokenBalances!;

  const changes: TokenBalanceChange[] = [];
  const included = (mint: string) => !filterMints || filterMints.includes(mint);
  const tokenAccountOf = (index: number) => tx.accountKeys?.[index] || undefined;

  const preBalanceMap = new Map<number, TokenBalance>();
  for (const bal of preTokenBalances) {
    preBalanceMap.set(bal.accountIndex, bal);
  }
  const postIndices = new Set<number>();

  const push = (
    accountIndex: number,
    mint: string,
    decimals: number,
    owner: string | undefined,
    pre: TokenBalance | undefined,
    post: TokenBalance | undefined,
  ) => {
    if (!included(mint)) return;
    const preAmount = pre?.uiTokenAmount.amount ?? "0";
    const postAmount = post?.uiTokenAmount.amount ?? "0";
    const delta = BigInt(postAmount) - BigInt(preAmount);
    if (delta === 0n) return;
    const preUi = uiOf(pre);
    const postUi = uiOf(post);
    changes.push({
      mint,
      tokenInfo: tokenInfoFor(mint, decimals),
      accountIndex,
      owner,
      ...(pre?.owner !== undefined ? { preOwner: pre.owner } : {}),
      ...(post?.owner !== undefined ? { postOwner: post.owner } : {}),
      ...(tokenAccountOf(accountIndex) ? { tokenAccount: tokenAccountOf(accountIndex) } : {}),
      ...((post ?? pre)?.programId ? { programId: (post ?? pre)!.programId } : {}),
      preBalance: { raw: preAmount, ui: preUi },
      postBalance: { raw: postAmount, ui: postUi },
      change: { raw: delta.toString(), ui: postUi - preUi },
    });
  };

  // Post entries first, in their order (the order earlier versions used),
  // then accounts that only exist in the pre snapshot (closed accounts).
  for (const postBal of postTokenBalances) {
    const { accountIndex, mint } = postBal;
    postIndices.add(accountIndex);
    const preBal = preBalanceMap.get(accountIndex);
    const decimals = postBal.uiTokenAmount.decimals;

    if (!preBal) {
      push(accountIndex, mint, decimals, postBal.owner, undefined, postBal);
      continue;
    }

    const sameMint = preBal.mint === mint;
    // A missing owner on one side is unknown, not a different owner.
    const sameOwner =
      preBal.owner === undefined ||
      postBal.owner === undefined ||
      preBal.owner === postBal.owner;
    // wSOL keeps one net change per account (native-account policy unchanged).
    if (sameMint && (sameOwner || mint === NATIVE_MINT)) {
      push(accountIndex, mint, decimals, postBal.owner ?? preBal.owner, preBal, postBal);
      continue;
    }

    // Authority change or close-and-reinitialise: two separate movements.
    if (preBal.mint !== NATIVE_MINT) {
      push(accountIndex, preBal.mint, preBal.uiTokenAmount.decimals, preBal.owner, preBal, undefined);
    }
    push(accountIndex, mint, decimals, postBal.owner, undefined, postBal);
  }

  for (const preBal of preTokenBalances) {
    if (postIndices.has(preBal.accountIndex)) continue;
    // Closed in this transaction. Native-mint accounts keep their lamport-only
    // representation (scope limit, see above).
    if (preBal.mint === NATIVE_MINT) continue;
    push(
      preBal.accountIndex,
      preBal.mint,
      preBal.uiTokenAmount.decimals,
      preBal.owner,
      preBal,
      undefined,
    );
  }

  return changes;
}

/**
 * Extracts SOL balance changes for all accounts in a transaction.
 *
 * Compares pre and post lamport balances for each resolved account key
 * (static keys, then lookup-table writable, then lookup-table readonly) and
 * returns only accounts with non-zero changes. Deltas are exact bigints.
 *
 * Missing balances are never fabricated: an index is only considered when the
 * key, the pre balance and the post balance are all present. If the arrays do
 * not line up, `reconcileLamports` reports the transaction as `unavailable`.
 *
 * @param tx - Raw transaction with SOL balance data
 * @returns Array of SOL balance changes with account address and amounts
 */
export function extractSolBalanceChanges(
  tx: RawTransaction
): SolBalanceChange[] {
  const {
    preBalances = [],
    postBalances = [],
    accountKeys = [],
  } = tx;

  const changes: SolBalanceChange[] = [];
  const count = Math.min(
    accountKeys.length,
    preBalances.length,
    postBalances.length
  );

  for (let i = 0; i < count; i++) {
    const address = accountKeys[i];
    const rawPre = preBalances[i];
    const rawPost = postBalances[i];
    if (!address || rawPre === undefined || rawPost === undefined) continue;

    const preBal = BigInt(rawPre);
    const postBal = BigInt(rawPost);
    const change = postBal - preBal;

    if (change !== 0n) {
      changes.push({
        accountIndex: i,
        address,
        preBalance: preBal,
        postBalance: postBal,
        change,
        changeUi: Number(change) / 1e9,
      });
    }
  }

  return changes;
}

export function getWalletTokenChanges(
  tx: RawTransaction,
  walletAddress: Address,
  filterMints?: string[]
): TokenBalanceChange[] {
  const allChanges = extractTokenBalanceChanges(tx, filterMints);

  // Solana addresses are case-sensitive base58: compare exactly.
  return allChanges.filter((change) => change.owner === walletAddress);
}

export function getWalletSolChange(
  tx: RawTransaction,
  walletAddress: Address
): SolBalanceChange | null {
  if (!tx.accountKeys || tx.accountKeys.length === 0) {
    return null;
  }

  const allChanges = extractSolBalanceChanges(tx);

  return (
    // Solana addresses are case-sensitive base58: compare exactly.
    allChanges.find((change) => change.address === walletAddress) ?? null
  );
}

export function toMoneyAmount(change: TokenBalanceChange): MoneyAmount {
  return {
    token: change.tokenInfo,
    amountRaw: change.change.raw,
    amountUi: change.change.ui,
  };
}

export function solChangeToMoneyAmount(change: SolBalanceChange): MoneyAmount {
  const solInfo = TOKEN_INFO[KNOWN_TOKENS.SOL];
  if (!solInfo) {
    throw new Error("SOL token info not found in registry");
  }
  return {
    token: solInfo,
    amountRaw: change.change.toString(),
    amountUi: change.changeUi,
  };
}

