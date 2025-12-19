import type { RawTransaction, TxLeg, TxLegRole } from "@tx-indexer/core/tx/tx.types";
import type { ProtocolInfo } from "@tx-indexer/core/actors/counterparty.types";
import { buildAccountId } from "@tx-indexer/core/tx/account-id";
import {
  extractSolBalanceChanges,
  extractTokenBalanceChanges,
  type SolBalanceChange,
  type TokenBalanceChange,
} from "./balance-parser";
import { KNOWN_TOKENS, TOKEN_INFO } from "@tx-indexer/core/money/token-registry";
import { DEX_PROTOCOL_IDS } from "../constants/protocol-constants";

function isDexProtocol(protocol: ProtocolInfo | null | undefined): boolean {
  return protocol !== null && protocol !== undefined && DEX_PROTOCOL_IDS.has(protocol.id);
}

/**
 * Converts a raw Solana transaction into a double-entry accounting ledger.
 *
 * Creates TxLeg entries for all SOL and token balance changes, automatically
 * detecting and accounting for network fees. Each leg represents a debit or credit
 * for a specific account and token, enabling transaction classification and validation.
 *
 * All accounts are tagged as "external:" - the classification layer determines
 * the transaction type and direction from the initiator's (fee payer's) perspective.
 *
 * @param tx - Raw transaction data with balance changes
 * @returns Array of transaction legs representing all balance movements
 */
export function transactionToLegs(tx: RawTransaction): TxLeg[] {
  const legs: TxLeg[] = [];
  const feePayer = tx.accountKeys?.[0]?.toLowerCase();

  const solChanges = extractSolBalanceChanges(tx);
  let totalSolDebits = 0n;
  let totalSolCredits = 0n;

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
      role: determineSolRole(change, tx, feePayer),
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

    let accountId: string;
    if (isDexProtocol(tx.protocol)) {
      const isFeePayer = feePayer && change.owner?.toLowerCase() === feePayer;
      if (isFeePayer) {
        accountId = buildAccountId({
          type: "external",
          address: change.owner || feePayer,
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
      role: determineTokenRole(change, tx, feePayer),
    });
  }

  return legs;
}

/**
 * Determines the role of a SOL balance change in the transaction context.
 *
 * @param change - SOL balance change for an account
 * @param tx - Raw transaction for additional context
 * @param feePayer - Fee payer address
 * @returns The role of this SOL balance change
 */
function determineSolRole(
  change: SolBalanceChange,
  tx: RawTransaction,
  feePayer?: string
): TxLegRole {
  const isFeePayer = feePayer
    ? change.address.toLowerCase() === feePayer
    : false;
  const isPositive = change.change > 0n;
  const amountSol = Math.abs(change.changeUi);

  if (isFeePayer && !isPositive && amountSol < 0.01) {
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

/**
 * Determines the role of a token balance change in the transaction context.
 *
 * @param change - Token balance change for an account
 * @param tx - Raw transaction for protocol context
 * @param feePayer - Fee payer address
 * @returns The role of this token balance change
 */
function determineTokenRole(
  change: TokenBalanceChange,
  tx: RawTransaction,
  feePayer?: string
): TxLegRole {
  const isFeePayer = feePayer
    ? change.owner?.toLowerCase() === feePayer
    : false;
  const isPositive = change.change.ui > 0;

  if (isFeePayer) {
    return isPositive ? "received" : "sent";
  }

  if (isDexProtocol(tx.protocol)) {
    return isPositive ? "protocol_withdraw" : "protocol_deposit";
  }

  return isPositive ? "received" : "sent";
}
