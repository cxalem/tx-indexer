import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";

/**
 * Classifies NFT burn transactions.
 *
 * Priority 85 — same level as NFT mint.
 *
 * Detects burning NFTs: user sends an NFT (decimals=0, amount=1) as a debit
 * with no corresponding credit to another external account.
 * The NFT goes to a protocol/system account or is simply destroyed.
 */
export class NftBurnClassifier implements Classifier {
  name = "nft-burn";
  priority = 85;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    // Find NFT debits (decimals=0, amount >= 1)
    const nftDebits = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.amount.token.decimals === 0 &&
        leg.amount.amountUi >= 1,
    );

    if (nftDebits.length === 0) {
      return null;
    }

    // For each NFT debit, check if there's a matching credit to another external account
    const burnedNfts: TxLeg[] = [];
    for (const nftDebit of nftDebits) {
      const hasExternalCredit = legs.some(
        (leg) =>
          leg.accountId.startsWith("external:") &&
          leg.side === "credit" &&
          leg.amount.token.mint === nftDebit.amount.token.mint &&
          leg.accountId !== nftDebit.accountId,
      );

      // If no external credit, the NFT was burned (sent to program/system or destroyed)
      if (!hasExternalCredit) {
        burnedNfts.push(nftDebit);
      }
    }

    if (burnedNfts.length === 0) {
      return null;
    }

    const primaryLeg = burnedNfts[0]!;
    const burner = primaryLeg.accountId.replace("external:", "");

    return {
      primaryType: "nft_burn",
      primaryAmount: primaryLeg.amount,
      secondaryAmount: null,
      sender: burner,
      receiver: null,
      counterparty: null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        nft_name: primaryLeg.amount.token.name,
        nft_mint: primaryLeg.amount.token.mint,
        nfts_burned: burnedNfts.length,
      },
    };
  }
}
