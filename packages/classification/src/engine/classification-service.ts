import type { TxLeg, RawTransaction } from "@tx-indexer/core/tx/tx.types";
import type {
  ClassificationDebugTrace,
  ClassifierDecisionTrace,
  TransactionClassification,
} from "@tx-indexer/core/tx/classification.types";
import type { Classifier, ClassifierContext } from "./classifier.interface";

/**
 * Options for routing versioned leg inputs (see LegInputVersion).
 *
 * `legacyLegs` is the `"v1-main"` view of the SAME transaction and wallet (from
 * `transactionToLegInputs`). When given, classifiers that declare `inputVersion:
 * "v2-closed-token-accounts"` read the `legs` argument and every other classifier reads
 * `legacyLegs`. Without it, every classifier reads `legs`. Never derive `legacyLegs` by
 * filtering a legs array: build it with the mapper.
 */
export interface ClassifyOptions {
  legacyLegs?: TxLeg[];
}
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

export class ClassificationService {
  private classifiers: Array<{ classifier: Classifier; order: number }> = [];
  private registrationOrder = 0;

  constructor() {
    this.registerClassifier(new SolanaPayClassifier());
    this.registerClassifier(new PrivacyCashClassifier());
    this.registerClassifier(new BridgeClassifier());
    this.registerClassifier(new NftMintClassifier());
    this.registerClassifier(new NftTransferClassifier());
    this.registerClassifier(new StakeDepositClassifier());
    this.registerClassifier(new StakeWithdrawClassifier());
    this.registerClassifier(new SwapClassifier());
    this.registerClassifier(new AirdropClassifier());
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
    options?: ClassifyOptions,
  ): TransactionClassification {
    return this.classifyWithTrace(legs, tx, walletAddress, options).classification;
  }

  classifyWithTrace(
    legs: TxLeg[],
    tx: RawTransaction,
    walletAddress?: string,
    options?: ClassifyOptions,
  ): {
    classification: TransactionClassification;
    debugTrace: ClassificationDebugTrace;
  } {
    const currentContext: ClassifierContext = { legs, tx, walletAddress };
    const legacyLegs = options?.legacyLegs;
    const legacyContext: ClassifierContext | null = legacyLegs
      ? { legs: legacyLegs, tx, walletAddress }
      : null;
    // The input each classifier reads, chosen immediately before calling it.
    const inputFor = (
      classifier: Classifier,
    ): { context: ClassifierContext; legInput: ClassifierDecisionTrace["legInput"] } => {
      if (!legacyContext) return { context: currentContext, legInput: "supplied" };
      if (classifier.inputVersion === "v2-closed-token-accounts") {
        return { context: currentContext, legInput: "v2-closed-token-accounts" };
      }
      return { context: legacyContext, legInput: "v1-main" };
    };
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

      const { context, legInput } = inputFor(classifier);
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
          legInput,
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
          legInput,
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
        legInput,
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
 * @param options - `{ legacyLegs }`: the `"v1-main"` legs of the same transaction and wallet
 *   (from `transactionToLegInputs`). Classifiers that declare `"v1-main"` (today: all of
 *   them) read `legacyLegs`; a classifier that declares `"v2-closed-token-accounts"` reads
 *   `legs`. With three arguments every classifier reads `legs`, so results equal to the SDK
 *   pipeline (and to 3111fd7) need the explicit legacy view.
 * @returns Classification result with type, amounts, sender, receiver, and confidence
 */
export function classifyTransaction(
  legs: TxLeg[],
  tx: RawTransaction,
  walletAddress?: string,
  options?: ClassifyOptions,
): TransactionClassification {
  return classificationService.classify(legs, tx, walletAddress, options);
}

/** As `classifyTransaction`, also returning the per-classifier trace (incl. `legInput`). */
export function classifyTransactionWithTrace(
  legs: TxLeg[],
  tx: RawTransaction,
  walletAddress?: string,
  options?: ClassifyOptions,
): {
  classification: TransactionClassification;
  debugTrace: ClassificationDebugTrace;
} {
  return classificationService.classifyWithTrace(legs, tx, walletAddress, options);
}
