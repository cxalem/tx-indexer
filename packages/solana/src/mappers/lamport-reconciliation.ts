import type {
  LamportReconciliation,
  RawTransaction,
} from "@tx-indexer/core/tx/tx.types";

type LamportValue = number | bigint;

function toExactBigInt(value: LamportValue | undefined): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  return null;
}

function unavailable(
  reason: string,
  accountCount: number,
  feeLamports: string | null,
): LamportReconciliation {
  return {
    status: "unavailable",
    feeLamports,
    netLamportsOut: null,
    residualLamports: null,
    accountCount,
    reason,
  };
}

/** A transaction-level reward entry from `meta.rewards` (e.g. rent collection). */
export interface TransactionRewardInput {
  lamports: number | bigint;
  rewardType?: string | null;
}

/**
 * Independently reconciles a transaction's lamport balances against the
 * network fee it was charged.
 *
 * Over the full resolved account list, `sum(pre) - sum(post)` must equal
 * `meta.fee`: lamports only leave the system through the fee. Any difference
 * is reported as `residualLamports` with status `unbalanced`; it is never
 * renamed "fee".
 *
 * Returns `unavailable` (without fabricating balances) when the fee is
 * missing, the balance arrays are missing or do not match the resolved key
 * count, or any value is a JavaScript number that is not an exact integer
 * (precision already lost upstream).
 *
 * Transaction-level rewards (`meta.rewards`, historically rent collected
 * from accounts) also move lamports outside the fee. When any nonzero reward
 * is present the check is reported `unavailable` with an explicit reason
 * rather than `unbalanced`.
 */
export function reconcileLamports(
  tx: RawTransaction,
  options: { rewards?: readonly TransactionRewardInput[] | null } = {},
): LamportReconciliation {
  const accountKeys = tx.accountKeys;
  const accountCount = accountKeys?.length ?? 0;

  const fee =
    tx.fee === undefined || tx.fee === null ? null : toExactBigInt(tx.fee);
  const feeLamports = fee === null ? null : fee.toString();

  if (tx.fee === undefined || tx.fee === null) {
    return unavailable("fee missing (no transaction metadata)", accountCount, null);
  }
  if (fee === null) {
    return unavailable("fee is not an exact integer", accountCount, null);
  }
  if (!accountKeys || accountKeys.length === 0) {
    return unavailable("account keys missing", accountCount, feeLamports);
  }

  const nonzeroRewards = (options.rewards ?? []).filter(
    (reward) => reward.lamports !== 0 && reward.lamports !== 0n,
  );
  if (nonzeroRewards.length > 0) {
    const types = [
      ...new Set(nonzeroRewards.map((r) => String(r.rewardType ?? "unknown"))),
    ].join(", ");
    return unavailable(
      `transaction-level rewards present (${nonzeroRewards.length} entr${
        nonzeroRewards.length === 1 ? "y" : "ies"
      }, type: ${types}); lamport check not attempted`,
      accountCount,
      feeLamports,
    );
  }

  const { preBalances, postBalances } = tx;
  if (!preBalances || !postBalances) {
    return unavailable("lamport balances missing", accountCount, feeLamports);
  }
  if (
    preBalances.length !== accountKeys.length ||
    postBalances.length !== accountKeys.length
  ) {
    return unavailable(
      `balance array length mismatch: ${accountKeys.length} resolved keys, ` +
        `${preBalances.length} preBalances, ${postBalances.length} postBalances`,
      accountCount,
      feeLamports,
    );
  }

  let sumPre = 0n;
  let sumPost = 0n;
  for (let i = 0; i < accountKeys.length; i++) {
    const pre = toExactBigInt(preBalances[i]);
    const post = toExactBigInt(postBalances[i]);
    if (pre === null || post === null) {
      return unavailable(
        `lamport balance at index ${i} is not an exact integer (exceeds Number.MAX_SAFE_INTEGER or is malformed)`,
        accountCount,
        feeLamports,
      );
    }
    sumPre += pre;
    sumPost += post;
  }

  const netOut = sumPre - sumPost;
  const residual = netOut - fee;

  if (residual === 0n) {
    return {
      status: "balanced",
      feeLamports,
      netLamportsOut: netOut.toString(),
      residualLamports: "0",
      accountCount,
    };
  }

  return {
    status: "unbalanced",
    feeLamports,
    netLamportsOut: netOut.toString(),
    residualLamports: residual.toString(),
    accountCount,
    reason:
      "sum(preBalances) - sum(postBalances) does not equal the fee; " +
      "some lamport movement is unaccounted for",
  };
}
