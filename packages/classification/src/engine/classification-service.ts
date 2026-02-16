import type { TxLeg, RawTransaction } from "@tx-indexer/core/tx/tx.types";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { Classifier, ClassifierContext } from "./classifier.interface";
import { TransferClassifier } from "../classifiers/transfer-classifier";
import { SwapClassifier } from "../classifiers/swap-classifier";
import { AirdropClassifier } from "../classifiers/airdrop-classifier";
import { FeeOnlyClassifier } from "../classifiers/fee-only-classifier";
import { SolanaPayClassifier } from "../classifiers/solana-pay-classifier";
import { NftMintClassifier } from "../classifiers/nft-mint-classifier";
import { NftTransferClassifier } from "../classifiers/nft-transfer-classifier";
import { StakeDepositClassifier } from "../classifiers/stake-deposit-classifier";
import { StakeWithdrawClassifier } from "../classifiers/stake-withdraw-classifier";
import { BridgeClassifier } from "../classifiers/bridge-classifier";
import { PrivacyCashClassifier } from "../classifiers/privacy-cash-classifier";
import { LendingClassifier } from "../classifiers/lending-classifier";
import { LiquidityClassifier } from "../classifiers/liquidity-classifier";
import { RewardClassifier } from "../classifiers/reward-classifier";

export class ClassificationService {
  private classifiers: Classifier[] = [];

  constructor() {
    this.registerClassifier(new SolanaPayClassifier());
    this.registerClassifier(new PrivacyCashClassifier());
    this.registerClassifier(new BridgeClassifier());
    this.registerClassifier(new NftMintClassifier());
    this.registerClassifier(new LendingClassifier());
    this.registerClassifier(new LiquidityClassifier());
    this.registerClassifier(new NftTransferClassifier());
    this.registerClassifier(new StakeDepositClassifier());
    this.registerClassifier(new StakeWithdrawClassifier());
    this.registerClassifier(new SwapClassifier());
    this.registerClassifier(new RewardClassifier());
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
    tx: RawTransaction,
    walletAddress?: string,
  ): TransactionClassification {
    const context: ClassifierContext = { legs, tx, walletAddress };

    for (const classifier of this.classifiers) {
      const result = classifier.classify(context);
      if (result && result.isRelevant) {
        return result;
      }
    }

    return {
      primaryType: "other",
      primaryAmount: null,
      secondaryAmount: null,
      sender: null,
      receiver: null,
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
 * Uses a priority-ordered chain of classifiers (Solana Pay > Privacy Cash > Bridge > NFT Mint > Lending > Liquidity > NFT Transfer > Stake Deposit > Stake Withdraw > Swap > Reward > Airdrop > Transfer > Fee-only)
 * to determine the transaction type, direction, amounts, sender, and receiver.
 *
 * @param legs - Transaction legs representing all balance movements
 * @param tx - Raw transaction data for additional context (protocol, memo, etc.)
 * @param walletAddress - Optional wallet address for perspective-aware classification (e.g., swap direction)
 * @returns Classification result with type, amounts, sender, receiver, and confidence
 */
export function classifyTransaction(
  legs: TxLeg[],
  tx: RawTransaction,
  walletAddress?: string,
): TransactionClassification {
  return classificationService.classify(legs, tx, walletAddress);
}
