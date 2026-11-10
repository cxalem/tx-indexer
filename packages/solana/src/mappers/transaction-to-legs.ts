import type {
  RawTransaction,
  TxLeg,
  TxLegRole,
} from "@tx-indexer/core/tx/tx.types";
import type { ProtocolInfo } from "@tx-indexer/core/actors/counterparty.types";
import { buildAccountId } from "@tx-indexer/core/tx/account-id";
import {
  extractSolBalanceChanges,
  extractTokenBalanceChanges,
  type SolBalanceChange,
  type TokenBalanceChange,
} from "./balance-parser";
import {
  KNOWN_TOKENS,
  TOKEN_INFO,
} from "@tx-indexer/core/money/token-registry";
import { DEX_PROTOCOL_IDS } from "../constants/protocol-constants";

function isDexProtocol(protocol: ProtocolInfo | null | undefined): boolean {
  return (
    protocol !== null &&
    protocol !== undefined &&
    DEX_PROTOCOL_IDS.has(protocol.id)
  );
}

/**
 * Converts a raw Solana transaction into a double-entry accounting ledger.
 *
 * Creates TxLeg entries for all SOL and token balance changes over the full
 * resolved account list, plus a network fee leg taken from the fee the runtime
 * charged (`tx.fee`, i.e. `meta.fee`). Legs only balance when the lamport
 * reconciliation balances; see `reconcileLamports`. Each leg represents a debit or credit
 * for a specific account and token, enabling transaction classification and validation.
 *
 * For DEX protocols, accounts are tagged based on their role:
 * - Fee payer and wallet address are tagged as "external:" (user-controlled)
 * - Other accounts are tagged as "protocol:" (DEX pool/program accounts)
 *
 * @param tx - Raw transaction data with balance changes
 * @param walletAddress - Optional wallet address for perspective-aware tagging
 * @returns Array of transaction legs representing all balance movements
 */
export function transactionToLegs(
  tx: RawTransaction,
  walletAddress?: string,
): TxLeg[] {
  const legs: TxLeg[] = [];
  const feePayer = tx.accountKeys?.[0];
  // Wallet address is kept as-is since Solana addresses are case-sensitive (base58)

  const solChanges = extractSolBalanceChanges(tx);

  for (const change of solChanges) {
    if (change.change === 0n) continue;

    const accountId = buildAccountId({
      type: "external",
      address: change.address,
    });

    const solInfo = TOKEN_INFO[KNOWN_TOKENS.SOL];
    if (!solInfo) {
      throw new Error("SOL token info not found in registry");
    }

    legs.push({
      accountId,
      side: change.change > 0n ? "credit" : "debit",
      amount: {
        token: solInfo,
        amountRaw: change.change.toString().replace("-", ""),
        amountUi: Math.abs(change.changeUi),
      },
      role: determineSolRole(change, tx, feePayer),
    });
  }

  // The network fee leg is the fee the runtime charged (meta.fee). It is NOT
  // derived from the residual of debits minus credits: an unexplained residual
  // is reported by reconcileLamports(), never renamed "fee".
  const networkFee = feeLamportsOf(tx);
  if (networkFee !== null && networkFee > 0n) {
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

    let accountId: string;
    if (isDexProtocol(tx.protocol)) {
      const isFeePayer = feePayer && change.owner === feePayer;
      const isWallet = walletAddress && change.owner === walletAddress;

      // Tag as external if the owner is the fee payer OR the target wallet
      if (isFeePayer || isWallet) {
        accountId = buildAccountId({
          type: "external",
          address: change.owner || feePayer || walletAddress || "",
        });
      } else {
        accountId = buildAccountId({
          type: "protocol",
          address: change.owner || change.tokenInfo.mint,
          protocol: tx.protocol!.id,
          token: change.tokenInfo.symbol,
        });
      }
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
      role: determineTokenRole(change, tx, feePayer, walletAddress),
    });
  }

  return legs;
}

function feeLamportsOf(tx: RawTransaction): bigint | null {
  if (tx.fee === undefined || tx.fee === null) return null;
  if (!Number.isSafeInteger(tx.fee)) return null;
  return BigInt(tx.fee);
}

/**
 * Determines the role of a SOL balance change in the transaction context.
 *
 * Network fees are handled separately via the fee:network leg (taken from
 * the fee the runtime charged, meta.fee). This function only categorizes
 * external account balance changes as sent/received.
 *
 * @param change - SOL balance change for an account
 * @param tx - Raw transaction for additional context
 * @param _feePayer - Fee payer address (unused, kept for API compatibility)
 * @returns The role of this SOL balance change
 */
function determineSolRole(
  change: SolBalanceChange,
  tx: RawTransaction,
  _feePayer?: string,
): TxLegRole {
  const isPositive = change.change > 0n;

  if (isPositive) {
    if (tx.protocol?.id === "stake") {
      return "reward";
    }
    return "received";
  }

  return "sent";
}

/**
 * Determines the role of a token balance change in the transaction context.
 *
 * @param change - Token balance change for an account
 * @param tx - Raw transaction for protocol context
 * @param feePayer - Fee payer address
 * @param walletAddress - Optional target wallet address for perspective
 * @returns The role of this token balance change
 */
function determineTokenRole(
  change: TokenBalanceChange,
  tx: RawTransaction,
  feePayer?: string,
  walletAddress?: string,
): TxLegRole {
  const isFeePayer = feePayer ? change.owner === feePayer : false;
  const isWallet = walletAddress ? change.owner === walletAddress : false;
  const isPositive = change.change.ui > 0;

  // If the owner is the fee payer or target wallet, use sent/received roles
  if (isFeePayer || isWallet) {
    return isPositive ? "received" : "sent";
  }

  if (isDexProtocol(tx.protocol)) {
    return isPositive ? "protocol_withdraw" : "protocol_deposit";
  }

  return isPositive ? "received" : "sent";
}
