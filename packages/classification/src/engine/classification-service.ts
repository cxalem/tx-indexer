import type { TxLeg, RawTransaction } from "@tx-indexer/core/tx/tx.types";
import type {
  ClassificationDebugTrace,
  ClassifierDecisionTrace,
  TransactionClassification,
} from "@tx-indexer/core/tx/classification.types";
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
import { PerpsClassifier } from "../classifiers/perps-classifier";
import { DcaClassifier } from "../classifiers/dca-classifier";
import { GovernanceClassifier } from "../classifiers/governance-classifier";
import { DomainClassifier } from "../classifiers/domain-classifier";
import { CompressClassifier } from "../classifiers/compress-classifier";
import { MultisigClassifier } from "../classifiers/multisig-classifier";
import { TipClassifier } from "../classifiers/tip-classifier";
import { NftBurnClassifier } from "../classifiers/nft-burn-classifier";
import { TokenBurnClassifier } from "../classifiers/token-burn-classifier";
import { TokenCreateClassifier } from "../classifiers/token-create-classifier";
import { TokenMigrateClassifier } from "../classifiers/token-migrate-classifier";
import { EscrowClassifier } from "../classifiers/escrow-classifier";
import { MemoClassifier } from "../classifiers/memo-classifier";
import { AccountCloseClassifier } from "../classifiers/account-close-classifier";

export class ClassificationService {
  private classifiers: Array<{ classifier: Classifier; order: number }> = [];
  private registrationOrder = 0;

  constructor() {
    // Classifiers are auto-sorted by priority (highest first)
    this.registerClassifier(new MultisigClassifier());
    this.registerClassifier(new SolanaPayClassifier());
    this.registerClassifier(new PrivacyCashClassifier());
    this.registerClassifier(new BridgeClassifier());
    this.registerClassifier(new TokenCreateClassifier());
    this.registerClassifier(new CompressClassifier());
    this.registerClassifier(new TokenMigrateClassifier());
    this.registerClassifier(new NftMintClassifier());
    this.registerClassifier(new NftBurnClassifier());
    this.registerClassifier(new NftTransferClassifier());
    this.registerClassifier(new GovernanceClassifier());
    this.registerClassifier(new DomainClassifier());
    this.registerClassifier(new PerpsClassifier());
    this.registerClassifier(new DcaClassifier());
    this.registerClassifier(new EscrowClassifier());
    this.registerClassifier(new StakeDepositClassifier());
    this.registerClassifier(new StakeWithdrawClassifier());
    this.registerClassifier(new SwapClassifier());
    this.registerClassifier(new TipClassifier());
    this.registerClassifier(new TokenBurnClassifier());
    this.registerClassifier(new AirdropClassifier());
    this.registerClassifier(new MemoClassifier());
    this.registerClassifier(new AccountCloseClassifier());
    this.registerClassifier(new TransferClassifier());
    this.registerClassifier(new FeeOnlyClassifier());
  }

  registerClassifier(classifier: Classifier): void {
    this.classifiers.push({ classifier, order: this.registrationOrder++ });
    this.classifiers.sort((a, b) => {
      if (b.classifier.priority !== a.classifier.priority) {
        return b.classifier.priority - a.classifier.priority;
      }
      return a.order - b.order;
    });
  }

  classify(
    legs: TxLeg[],
    tx: RawTransaction,
    walletAddress?: string,
  ): TransactionClassification {
    return this.classifyWithTrace(legs, tx, walletAddress).classification;
  }

  classifyWithTrace(
    legs: TxLeg[],
    tx: RawTransaction,
    walletAddress?: string,
  ): {
    classification: TransactionClassification;
    debugTrace: ClassificationDebugTrace;
  } {
    const context: ClassifierContext = { legs, tx, walletAddress };
    const decisions: ClassifierDecisionTrace[] = [];
    let firstNonRelevant: TransactionClassification | null = null;
    let firstNonRelevantClassifier: string | null = null;
    let relevantMatch: {
      classification: TransactionClassification;
      classifier: string;
    } | null = null;

    for (const { classifier } of this.classifiers) {
      if (relevantMatch) {
        decisions.push({
          classifier: classifier.name,
          priority: classifier.priority,
          matched: false,
          relevant: false,
          reason: `Not evaluated: already matched by ${relevantMatch.classifier}`,
        });
        continue;
      }

      const startedAt = Date.now();
      const result = classifier.classify(context);
      const elapsedMs = Date.now() - startedAt;

      if (!result) {
        decisions.push({
          classifier: classifier.name,
          priority: classifier.priority,
          matched: false,
          relevant: false,
          reason: "No match",
          elapsedMs,
        });
        continue;
      }

      const isRelevant = result.isRelevant ?? true;
      if (isRelevant) {
        relevantMatch = {
          classification: result,
          classifier: classifier.name,
        };
        decisions.push({
          classifier: classifier.name,
          priority: classifier.priority,
          matched: true,
          relevant: true,
          reason: `Matched ${result.primaryType}`,
          elapsedMs,
        });
        continue;
      }

      decisions.push({
        classifier: classifier.name,
        priority: classifier.priority,
        matched: true,
        relevant: false,
        reason: `Matched non-relevant ${result.primaryType}`,
        elapsedMs,
      });

      if (!firstNonRelevant) {
        firstNonRelevant = result;
        firstNonRelevantClassifier = classifier.name;
      }
    }

    const fallback: TransactionClassification = {
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

    const selected =
      relevantMatch?.classification ?? firstNonRelevant ?? fallback;
    const selectedClassifier =
      relevantMatch?.classifier ?? firstNonRelevantClassifier ?? null;

    const debugTrace: ClassificationDebugTrace = {
      selectedClassifier,
      selectedType: selected.primaryType,
      walletAddress: walletAddress ?? null,
      decisions,
    };

    const classificationWithTrace: TransactionClassification = {
      ...selected,
      debugTrace,
    };

    return {
      classification: classificationWithTrace,
      debugTrace,
    };
  }
}

export const classificationService = new ClassificationService();

/**
 * Classifies a transaction based on its accounting legs and context.
 *
 * Uses a priority-ordered chain of classifiers (Solana Pay > Privacy Cash > Bridge > NFT Mint > NFT Transfer > Stake Deposit > Stake Withdraw > Swap > Airdrop > Fee-only > Transfer)
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

export function classifyTransactionWithTrace(
  legs: TxLeg[],
  tx: RawTransaction,
  walletAddress?: string,
): {
  classification: TransactionClassification;
  debugTrace: ClassificationDebugTrace;
} {
  return classificationService.classifyWithTrace(legs, tx, walletAddress);
}
