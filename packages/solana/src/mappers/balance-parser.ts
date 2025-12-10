import type { RawTransaction, TokenBalance } from "@tx-indexer/core/tx/tx.types";
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
  owner?: string;
  preBalance: {
    raw: string;
    ui: number;
  };
  postBalance: {
    raw: string;
    ui: number;
  };
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
 * Extracts all SPL token balance changes from a transaction.
 * 
 * Compares pre and post token balances to calculate the change for each token account.
 * Unknown tokens are automatically included with a generated symbol from their mint address.
 * 
 * @param tx - Raw transaction with token balance data
 * @param filterMints - Optional array of mint addresses to filter to specific tokens
 * @returns Array of token balance changes with mint, owner, and amount information
 */
export function extractTokenBalanceChanges(
  tx: RawTransaction,
  filterMints?: string[]
): TokenBalanceChange[] {
  const { preTokenBalances = [], postTokenBalances = [] } = tx;

  const changes: TokenBalanceChange[] = [];

  const preBalanceMap = new Map<number, TokenBalance>();
  for (const bal of preTokenBalances) {
    preBalanceMap.set(bal.accountIndex, bal);
  }

  for (const postBal of postTokenBalances) {
    const { accountIndex, mint } = postBal;

    if (filterMints && !filterMints.includes(mint)) {
      continue;
    }

    let tokenInfo = getTokenInfo(mint);
    if (!tokenInfo) {
      tokenInfo = {
        mint,
        symbol: mint.slice(0, 8),
        decimals: postBal.uiTokenAmount.decimals,
        name: `Unknown Token (${mint.slice(0, 8)}...)`,
      };
    }

    const preBal = preBalanceMap.get(accountIndex);

    const preAmount = preBal?.uiTokenAmount.amount ?? "0";
    const postAmount = postBal.uiTokenAmount.amount;
    const preUi = preBal?.uiTokenAmount.uiAmountString
      ? parseFloat(preBal.uiTokenAmount.uiAmountString)
      : 0;
    const postUi = postBal.uiTokenAmount.uiAmountString
      ? parseFloat(postBal.uiTokenAmount.uiAmountString)
      : 0;

    const changeRaw = (BigInt(postAmount) - BigInt(preAmount)).toString();
    const changeUi = postUi - preUi;

    if (changeRaw !== "0") {
      changes.push({
        mint,
        tokenInfo,
        accountIndex,
        owner: postBal.owner,
        preBalance: {
          raw: preAmount,
          ui: preUi,
        },
        postBalance: {
          raw: postAmount,
          ui: postUi,
        },
        change: {
          raw: changeRaw,
          ui: changeUi,
        },
      });
    }
  }

  return changes;
}

/**
 * Extracts SOL balance changes for all accounts in a transaction.
 * 
 * Compares pre and post lamport balances for each account key to calculate
 * the SOL change. Only includes accounts with non-zero changes.
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

  for (let i = 0; i < accountKeys.length; i++) {
    const address = accountKeys[i];
    if (!address) continue;

    const preBal = BigInt(preBalances[i] ?? 0);
    const postBal = BigInt(postBalances[i] ?? 0);
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
  walletAddress: string,
  filterMints?: string[]
): TokenBalanceChange[] {
  const allChanges = extractTokenBalanceChanges(tx, filterMints);

  return allChanges.filter(
    (change) =>
      change.owner?.toLowerCase() === walletAddress.toLowerCase()
  );
}

export function getWalletSolChange(
  tx: RawTransaction,
  walletAddress: string
): SolBalanceChange | null {
  if (!tx.accountKeys || tx.accountKeys.length === 0) {
    return null;
  }

  const allChanges = extractSolBalanceChanges(tx);

  return (
    allChanges.find(
      (change) => change.address.toLowerCase() === walletAddress.toLowerCase()
    ) ?? null
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

