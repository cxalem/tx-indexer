import type { TxLeg, RawTransaction } from "@tx-indexer/core/tx/tx.types";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { Classifier, ClassifierContext } from "./classifier.interface";
import { TransferClassifier } from "../classifiers/transfer-classifier";
import { SwapClassifier } from "../classifiers/swap-classifier";
import { AirdropClassifier } from "../classifiers/airdrop-classifier";
import { FeeOnlyClassifier } from "../classifiers/fee-only-classifier";
import { SolanaPayClassifier } from "../classifiers/solana-pay-classifier";

export class ClassificationService {
  private classifiers: Classifier[] = [];

  constructor() {
    this.registerClassifier(new SolanaPayClassifier());
    this.registerClassifier(new SwapClassifier());
    this.registerClassifier(new AirdropClassifier());
    this.registerClassifier(new TransferClassifier());
    this.registerClassifier(new FeeOnlyClassifier());
  }

  registerClassifier(classifier: Classifier): void {
    this.classifiers.push(classifier);
    this.classifiers.sort((a, b) => b.priority - a.priority);
  }

  classify(
    legs: TxLeg[],
    walletAddress: string,
    tx: RawTransaction
  ): TransactionClassification {
    const context: ClassifierContext = { legs, walletAddress, tx };

    for (const classifier of this.classifiers) {
      const result = classifier.classify(context);
      if (result && result.isRelevant) {
        return result;
      }
    }

    return {
      primaryType: "other",
      direction: "neutral",
      primaryAmount: null,
      secondaryAmount: null,
      counterparty: null,
      confidence: 0.0,
      isRelevant: false,
      metadata: {},
    };
  }
}

export const classificationService = new ClassificationService();

/**
 * Classifies a transaction based on its accounting legs and context.
 * 
 * Uses a priority-ordered chain of classifiers (Solana Pay > Swap > Airdrop > Transfer > Fee-only)
 * to determine the transaction type, direction, amounts, and counterparty from the wallet's perspective.
 * 
 * @param legs - Transaction legs representing all balance movements
 * @param walletAddress - Address of the wallet for classification perspective
 * @param tx - Raw transaction data for additional context (protocol, memo, etc.)
 * @returns Classification result with type, amounts, counterparty, and confidence
 */
export function classifyTransaction(
  legs: TxLeg[],
  walletAddress: string,
  tx: RawTransaction
): TransactionClassification {
  return classificationService.classify(legs, walletAddress, tx);
}
