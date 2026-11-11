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
import { DEX_PROTOCOL_IDS } from "../../constants/protocol-constants";

function isDexProtocol(protocol: ProtocolInfo | null | undefined): boolean {
  return (
    protocol !== null &&
    protocol !== undefined &&
    DEX_PROTOCOL_IDS.has(protocol.id)
  );
}

/**
 * COMPLETE legs (input contract "v2-closed-token-accounts"): all balance movements of the
 * transaction, including token accounts closed in it. Published as the optional
 * `completeLegs` field; not read by any classifier or by the list filter. The `legs` the
 * SDK returns and classifies are still built by ../transaction-to-legs.ts, unchanged.
 *
 * Differences from ../transaction-to-legs.ts: token changes from the union of pre and post
 * balances (a closed account's debit, with `closedTokenAccount` on proven closures), owner
 * and mint changes on one account index split, debit/credit from raw amounts, an ownerless
 * movement attributed to the token account, and no token change when a snapshot is
 * unavailable (`tx.tokenBalanceStatus`).
 *
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
export function transactionToCompleteLegs(
  tx: RawTransaction,
  walletAddress?: string,
): TxLeg[] {
  const legs: TxLeg[] = [];
  const feePayer = tx.accountKeys?.[0];
  // Wallet address is kept as-is since Solana addresses are case-sensitive (base58)

  const solChanges = extractSolBalanceChanges(tx);
  const nativeAccounts = nativeTokenAccounts(tx);

  for (const change of solChanges) {
    if (change.change === 0n) continue;

    const solInfo = TOKEN_INFO[KNOWN_TOKENS.SOL];
    if (!solInfo) {
      throw new Error("SOL token info not found in registry");
    }

    // Native-mint (wSOL) token accounts: one representation only, the
    // LAMPORT delta, attributed to the token owner. See nativeTokenAccounts().
    const native = nativeAccounts.get(change.accountIndex);
    if (native) {
      const owner = native.owner ?? change.address;
      // The FULL lamport delta is the owner's movement, also for accounts
      // created in this transaction: their rent-exempt reserve cannot be told
      // apart from funding using transaction data alone (it depends on the
      // cluster's rent parameters), so it is included in the owner's credit.
      const ownerPart = change.change;
      if (ownerPart !== 0n) {
        const isPositive = ownerPart > 0n;
        legs.push({
          accountId: ownerAccountId(
            owner,
            solInfo.symbol,
            tx,
            feePayer,
            walletAddress,
          ),
          side: isPositive ? "credit" : "debit",
          amount: {
            token: solInfo,
            amountRaw: (isPositive ? ownerPart : -ownerPart).toString(),
            amountUi: Math.abs(Number(ownerPart) / 1e9),
          },
          role: ownerRole(owner, isPositive, tx, feePayer, walletAddress),
        });
      }
      continue;
    }

    const accountId = buildAccountId({
      type: "external",
      address: change.address,
    });

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

  // Token changes come from the union of pre and post token balances, so a
  // token account closed in this transaction contributes the debit of its pre
  // amount, attributed to its pre owner (see extractTokenBalanceChanges).
  const tokenChanges = extractTokenBalanceChanges(tx);
  for (const change of tokenChanges) {
    // Debit vs credit from the exact raw delta, never from UI amounts.
    const delta = BigInt(change.change.raw);
    if (delta === 0n) continue;
    // wSOL accounts are represented by their lamport delta (see above); the
    // token-amount change is not emitted, so a sync_native (token amount
    // catching up with lamports already held) never appears as a movement.
    if (change.mint === KNOWN_TOKENS.SOL && nativeAccounts.has(change.accountIndex)) continue;

    // Without an owner, the token ACCOUNT address is the identity, never the mint.
    const owner = tokenChangeOwner(change, tx);
    const accountId = ownerAccountId(
      owner,
      change.tokenInfo.symbol,
      tx,
      feePayer,
      walletAddress,
    );

    const isPositive = delta > 0n;
    const closedAccountAddress =
      change.tokenAccount ?? tx.accountKeys?.[change.accountIndex];
    legs.push({
      accountId,
      side: isPositive ? "credit" : "debit",
      amount: {
        token: change.tokenInfo,
        amountRaw: (isPositive ? delta : -delta).toString(),
        amountUi: Math.abs(change.change.ui),
      },
      role: ownerRole(owner, isPositive, tx, feePayer, walletAddress),
      // Provenance for classifiers: only a proven closure (see
      // TokenBalanceChange.accountClosed) marks its debit, and only when the
      // token account's address is known. The field promises an address, so
      // it is omitted (the debit stays) when the transaction has no account
      // keys to resolve it from.
      ...(change.accountClosed && !isPositive && closedAccountAddress
        ? { closedTokenAccount: closedAccountAddress }
        : {}),
    });
  }

  return legs;
}

interface NativeTokenAccount {
  /** Token owner from the balance metadata (undefined if not reported) */
  owner?: string;
}

/**
 * Native-mint (wSOL) token accounts that exist AFTER the transaction, i.e.
 * have a POST token balance entry in the native mint.
 *
 * Their economic movement is the actual lamport delta, attributed to the
 * token owner; the native token-amount change is suppressed so the movement
 * is represented exactly once. Cases:
 *
 * - existing -> existing (pre and post entries): the full lamport delta is the
 *   owner's movement. Token-amount changes are ignored, so lamports sent
 *   without sync_native still count, and a sync (token amount catching up,
 *   lamport delta zero) produces no leg at all.
 * - created (post entry only): same as existing -> existing, the full
 *   lamport delta goes to the owner. That credit therefore includes the
 *   account's rent-exempt reserve, which cannot be separated from funding
 *   using transaction data alone.
 * - closed (pre entry only): NOT included here, so the lamport change stays
 *   an ordinary external:<account> leg and no token leg is emitted (known
 *   limitation for wSOL; closed NON-native token accounts do get a token
 *   debit, see extractTokenBalanceChanges).
 *
 * When the balance metadata has no owner, the account's own address
 * (accountKeys[accountIndex]) is used as the identity, never the mint.
 *
 * Only the legacy native mint (So11111111111111111111111111111111111111112)
 * is recognised. Token-2022's native mint
 * (9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP) is NOT handled: such
 * accounts keep ordinary lamport and token legs (known limitation).
 */
function nativeTokenAccounts(tx: RawTransaction): Map<number, NativeTokenAccount> {
  const nativeMint = KNOWN_TOKENS.SOL;
  const accounts = new Map<number, NativeTokenAccount>();
  for (const post of tx.postTokenBalances ?? []) {
    if (post.mint !== nativeMint) continue;
    accounts.set(post.accountIndex, {
      owner: post.owner || tx.accountKeys?.[post.accountIndex] || undefined,
    });
  }
  return accounts;
}

/**
 * Account id for a movement attributed to a token owner. Same tagging as
 * token legs: for DEX protocols, owners other than the fee payer / wallet are
 * tagged "protocol:"; otherwise "external:".
 */
function ownerAccountId(
  owner: string,
  symbol: string,
  tx: RawTransaction,
  feePayer?: string,
  walletAddress?: string,
): string {
  if (isDexProtocol(tx.protocol)) {
    const isFeePayer = feePayer && owner === feePayer;
    const isWallet = walletAddress && owner === walletAddress;
    if (isFeePayer || isWallet) {
      return buildAccountId({ type: "external", address: owner });
    }
    return buildAccountId({
      type: "protocol",
      address: owner,
      protocol: tx.protocol!.id,
      token: symbol,
    });
  }
  return buildAccountId({ type: "external", address: owner });
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
 * Determines the role of a movement attributed to a token owner.
 *
 * @param owner - Token account owner
 * @param isPositive - Whether the owner gained
 * @param tx - Raw transaction for protocol context
 * @param feePayer - Fee payer address
 * @param walletAddress - Optional target wallet address for perspective
 */
function ownerRole(
  owner: string | undefined,
  isPositive: boolean,
  tx: RawTransaction,
  feePayer?: string,
  walletAddress?: string,
): TxLegRole {
  const isFeePayer = feePayer ? owner === feePayer : false;
  const isWallet = walletAddress ? owner === walletAddress : false;

  // If the owner is the fee payer or target wallet, use sent/received roles
  if (isFeePayer || isWallet) {
    return isPositive ? "received" : "sent";
  }

  if (isDexProtocol(tx.protocol)) {
    return isPositive ? "protocol_withdraw" : "protocol_deposit";
  }

  return isPositive ? "received" : "sent";
}

/**
 * Identity a token movement is attributed to: the change's owner (pre owner
 * for a closed account's debit, post owner otherwise); when the balance
 * metadata reports no owner, the token account address
 * (`accountKeys[accountIndex]`). Never the mint.
 */
function tokenChangeOwner(change: TokenBalanceChange, tx: RawTransaction): string {
  return (
    change.owner ||
    change.tokenAccount ||
    tx.accountKeys?.[change.accountIndex] ||
    `account-index-${change.accountIndex}`
  );
}
