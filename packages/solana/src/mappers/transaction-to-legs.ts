import type { RawTransaction, TxLeg, TxLegRole } from "@tx-indexer/core/tx/tx.types";
import { buildAccountId } from "@tx-indexer/core/tx/account-id";
import {
  extractSolBalanceChanges,
  extractTokenBalanceChanges,
  type SolBalanceChange,
  type TokenBalanceChange,
} from "./balance-parser";
import { KNOWN_TOKENS, TOKEN_INFO } from "@tx-indexer/core/money/token-registry";

/**
 * Converts a raw Solana transaction into a double-entry accounting ledger.
 * 
 * Creates TxLeg entries for all SOL and token balance changes, automatically
 * detecting and accounting for network fees. Each leg represents a debit or credit
 * for a specific account and token, enabling transaction classification and validation.
 * 
 * @param tx - Raw transaction data with balance changes
 * @param walletAddress - Address of the wallet to determine perspective (wallet vs external)
 * @returns Array of transaction legs representing all balance movements
 */
export function transactionToLegs(
  tx: RawTransaction,
  walletAddress: string
): TxLeg[] {
  const legs: TxLeg[] = [];

  const solChanges = extractSolBalanceChanges(tx);
  let totalSolDebits = 0n;
  let totalSolCredits = 0n;

  for (const change of solChanges) {
    if (change.change === 0n) continue;

    const isWallet =
      change.address.toLowerCase() === walletAddress.toLowerCase();
    const accountId = buildAccountId({
      type: isWallet ? "wallet" : "external",
      address: change.address,
    });

    const solInfo = TOKEN_INFO[KNOWN_TOKENS.SOL];
    if (!solInfo) {
      throw new Error("SOL token info not found in registry");
    }

    if (change.change > 0n) {
      totalSolCredits += change.change;
    } else {
      totalSolDebits += -change.change;
    }

    legs.push({
      accountId,
      side: change.change > 0n ? "credit" : "debit",
      amount: {
        token: solInfo,
        amountRaw: change.change.toString().replace("-", ""),
        amountUi: Math.abs(change.changeUi),
      },
      role: determineSolRole(change, walletAddress, tx),
    });
  }

  const networkFee = totalSolDebits - totalSolCredits;
  if (networkFee > 0n) {
    const solInfo = TOKEN_INFO[KNOWN_TOKENS.SOL];
    if (solInfo) {
      legs.push({
        accountId: buildAccountId({ type: "fee", address: "" }),
        side: "credit",
        amount: {
          token: solInfo,
          amountRaw: networkFee.toString(),
          amountUi: Number(networkFee) / 1e9,
        },
        role: "fee",
      });
    }
  }

  const tokenChanges = extractTokenBalanceChanges(tx);
  for (const change of tokenChanges) {
    if (change.change.raw === "0") continue;

    const isWallet =
      change.owner?.toLowerCase() === walletAddress.toLowerCase();

    let accountId: string;
    if (isWallet) {
      accountId = buildAccountId({
        type: "wallet",
        address: change.owner || walletAddress,
      });
    } else if (tx.protocol) {
      accountId = buildAccountId({
        type: "protocol",
        address: change.owner || change.tokenInfo.mint,
        protocol: tx.protocol.id,
        token: change.tokenInfo.symbol,
      });
    } else {
      accountId = buildAccountId({
        type: "external",
        address: change.owner || change.tokenInfo.mint,
      });
    }

    legs.push({
      accountId,
      side: change.change.ui > 0 ? "credit" : "debit",
      amount: {
        token: change.tokenInfo,
        amountRaw: change.change.raw.replace("-", ""),
        amountUi: Math.abs(change.change.ui),
      },
      role: determineTokenRole(change, walletAddress, tx),
    });
  }

  return legs;
}

/**
 * Determines the role of a SOL balance change in the transaction context.
 * 
 * Distinguishes between fees, rewards, sent, and received based on the wallet
 * perspective, transaction protocol, and amount.
 * 
 * @param change - SOL balance change for an account
 * @param walletAddress - Address of the wallet for perspective
 * @param tx - Raw transaction for additional context (protocol, etc.)
 * @returns The role of this SOL balance change
 */
function determineSolRole(
  change: SolBalanceChange,
  walletAddress: string,
  tx: RawTransaction
): TxLegRole {
  const isWallet =
    change.address.toLowerCase() === walletAddress.toLowerCase();
  const isPositive = change.change > 0n;
  const amountSol = Math.abs(change.changeUi);

  if (isWallet) {
    if (!isPositive && amountSol < 0.01) {
      return "fee";
    }

    if (isPositive) {
      if (tx.protocol?.id === "stake") {
        return "reward";
      }
      return "received";
    }

    return "sent";
  }

  if (!isPositive && amountSol < 0.01) {
    return "fee";
  }

  if (isPositive) {
    return "received";
  }

  return "sent";
}

/**
 * Determines the role of a token balance change in the transaction context.
 * 
 * Differentiates between wallet movements (sent/received) and protocol interactions
 * (deposits/withdrawals) based on the owner and protocol context.
 * 
 * @param change - Token balance change for an account
 * @param walletAddress - Address of the wallet for perspective
 * @param tx - Raw transaction for protocol context
 * @returns The role of this token balance change
 */
function determineTokenRole(
  change: TokenBalanceChange,
  walletAddress: string,
  tx: RawTransaction
): TxLegRole {
  const isWallet =
    change.owner?.toLowerCase() === walletAddress.toLowerCase();
  const isPositive = change.change.ui > 0;

  if (isWallet) {
    return isPositive ? "received" : "sent";
  }

  if (tx.protocol) {
    return isPositive ? "protocol_withdraw" : "protocol_deposit";
  }

  return isPositive ? "received" : "sent";
}

