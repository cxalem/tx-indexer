import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isDexProtocolById } from "../protocols/detector";

/**
 * Finds the best swap pair from the lists of tokens going out and coming in.
 *
 * The best pair is determined by:
 * 1. Must have different token symbols (otherwise it's not a swap)
 * 2. Prefer non-SOL tokens over SOL (SOL is usually just for fees)
 * 3. Prefer the pair with the largest combined value
 *
 * For now, we use amountUi as a proxy for value since we don't have USD prices.
 */
function findSwapPair(
  tokensOut: TxLeg[],
  tokensIn: TxLeg[],
): { initiatorOut: TxLeg; initiatorIn: TxLeg } | null {
  let bestPair: { initiatorOut: TxLeg; initiatorIn: TxLeg } | null = null;
  let bestScore = -Infinity;

  for (const out of tokensOut) {
    for (const inLeg of tokensIn) {
      if (out.amount.token.symbol !== inLeg.amount.token.symbol) {
        // Calculate score based on combined amounts
        let score = out.amount.amountUi + inLeg.amount.amountUi;

        // Heavily penalize pairs involving tiny SOL amounts (likely fees)
        // SOL is often used for fees, so deprioritize small SOL movements
        const outIsTinySol =
          (out.amount.token.symbol === "SOL" ||
            out.amount.token.symbol === "WSOL") &&
          out.amount.amountUi < 0.01;
        const inIsTinySol =
          (inLeg.amount.token.symbol === "SOL" ||
            inLeg.amount.token.symbol === "WSOL") &&
          inLeg.amount.amountUi < 0.01;

        if (outIsTinySol || inIsTinySol) {
          score -= 1000000; // Large penalty to deprioritize fee-like SOL movements
        }

        if (score > bestScore) {
          bestScore = score;
          bestPair = { initiatorOut: out, initiatorIn: inLeg };
        }
      }
    }
  }

  return bestPair;
}

function getNetTokenChangeByMint(legs: TxLeg[]): Map<string, bigint> {
  const netByMint = new Map<string, bigint>();

  for (const leg of legs) {
    const mint = leg.amount.token.mint;
    const amountRaw = BigInt(leg.amount.amountRaw);
    const delta = leg.side === "credit" ? amountRaw : -amountRaw;
    netByMint.set(mint, (netByMint.get(mint) ?? 0n) + delta);
  }

  return netByMint;
}

function isTinySolMovement(leg: TxLeg): boolean {
  return (
    (leg.amount.token.symbol === "SOL" || leg.amount.token.symbol === "WSOL") &&
    leg.amount.amountUi < 0.01
  );
}

export class SwapClassifier implements Classifier {
  name = "swap";
  priority = 80;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx, walletAddress } = context;

    const initiator = tx.accountKeys?.[0] ?? null;

    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    const initiatorTokensOut = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        (leg.role === "sent" || leg.role === "protocol_deposit"),
    );

    const initiatorTokensIn = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "credit" &&
        (leg.role === "received" || leg.role === "protocol_withdraw"),
    );

    const initiatorNetByMint = getNetTokenChangeByMint([
      ...initiatorTokensOut,
      ...initiatorTokensIn,
    ]);

    const netTokensOut = initiatorTokensOut.filter(
      (leg) => (initiatorNetByMint.get(leg.amount.token.mint) ?? 0n) < 0n,
    );
    const netTokensIn = initiatorTokensIn.filter(
      (leg) => (initiatorNetByMint.get(leg.amount.token.mint) ?? 0n) > 0n,
    );

    if (netTokensOut.length === 0 || netTokensIn.length === 0) {
      return null;
    }

    const hasDexProtocol = isDexProtocolById(tx.protocol?.id);

    // Avoid false swap detection when the only outgoing leg is tiny SOL fee-like movement
    // and the protocol is not a known DEX.
    if (!hasDexProtocol && netTokensOut.every(isTinySolMovement)) {
      return null;
    }

    const swapPair = findSwapPair(netTokensOut, netTokensIn);
    if (!swapPair) {
      return null;
    }

    const { initiatorOut, initiatorIn } = swapPair;

    let tokenOut = initiatorOut;
    let tokenIn = initiatorIn;
    let perspectiveWallet = initiator;

    if (walletAddress) {
      const walletAccountId = `external:${walletAddress}`;

      // Get all wallet's outgoing and incoming legs
      const walletTokensOut = legs.filter(
        (leg) =>
          leg.accountId === walletAccountId &&
          leg.side === "debit" &&
          (leg.role === "sent" || leg.role === "protocol_deposit"),
      );

      const walletTokensIn = legs.filter(
        (leg) =>
          leg.accountId === walletAccountId &&
          leg.side === "credit" &&
          (leg.role === "received" || leg.role === "protocol_withdraw"),
      );

      // Use the same best-pair logic to find the main swap tokens
      const walletNetByMint = getNetTokenChangeByMint([
        ...walletTokensOut,
        ...walletTokensIn,
      ]);
      const walletNetTokensOut = walletTokensOut.filter(
        (leg) => (walletNetByMint.get(leg.amount.token.mint) ?? 0n) < 0n,
      );
      const walletNetTokensIn = walletTokensIn.filter(
        (leg) => (walletNetByMint.get(leg.amount.token.mint) ?? 0n) > 0n,
      );

      const walletSwapPair = findSwapPair(
        walletNetTokensOut,
        walletNetTokensIn,
      );
      if (walletSwapPair) {
        tokenOut = walletSwapPair.initiatorOut;
        tokenIn = walletSwapPair.initiatorIn;
        perspectiveWallet = walletAddress;
      }
    }
    const confidence = hasDexProtocol ? 0.95 : 0.75;

    return {
      primaryType: "swap",
      primaryAmount: tokenOut.amount,
      secondaryAmount: tokenIn.amount,
      sender: perspectiveWallet,
      receiver: perspectiveWallet,
      counterparty: null,
      confidence,
      isRelevant: true,
      metadata: {
        swap_type: "token_to_token",
        from_token: tokenOut.amount.token.symbol,
        to_token: tokenIn.amount.token.symbol,
        from_amount: tokenOut.amount.amountUi,
        to_amount: tokenIn.amount.amountUi,
      },
    };
  }
}
