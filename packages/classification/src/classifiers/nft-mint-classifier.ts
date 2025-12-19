import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isNftMintProtocolById } from "../protocols/detector";

export class NftMintClassifier implements Classifier {
  name = "nft-mint";
  priority = 85;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const hasNftMintProtocol = isNftMintProtocolById(tx.protocol?.id);
    if (!hasNftMintProtocol) {
      return null;
    }

    const nftCredits = legs.filter(
      (leg) =>
        leg.side === "credit" &&
        leg.amount.token.decimals === 0 &&
        leg.amount.amountUi >= 1 &&
        (leg.role === "received" || leg.role === "protocol_withdraw")
    );

    if (nftCredits.length === 0) {
      return null;
    }

    const primaryNft = nftCredits[0]!;
    const minter = primaryNft.accountId.replace("external:", "");

    const paymentLeg = legs.find(
      (leg) =>
        leg.side === "debit" &&
        leg.role === "sent" &&
        leg.amount.token.symbol === "SOL"
    );

    const totalMinted = nftCredits.reduce(
      (sum, leg) => sum + leg.amount.amountUi,
      0
    );

    return {
      primaryType: "nft_mint",
      primaryAmount: primaryNft.amount,
      secondaryAmount: paymentLeg?.amount ?? null,
      sender: null,
      receiver: minter,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        nft_mint: primaryNft.amount.token.mint,
        nft_name: primaryNft.amount.token.name,
        quantity: totalMinted,
        mint_price: paymentLeg?.amount.amountUi,
        protocol: tx.protocol?.id,
      },
    };
  }
}
