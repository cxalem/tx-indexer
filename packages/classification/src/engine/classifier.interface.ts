import type { TxLeg, RawTransaction } from "@tx-indexer/core/tx/tx.types";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { LegInputVersion } from "@tx-indexer/core/tx/leg-inputs";

export interface ClassifierContext {
  legs: TxLeg[];
  tx: RawTransaction;
  walletAddress?: string;
}

export interface Classifier {
  name: string;
  priority: number;
  /**
   * The leg input this classifier was calibrated on and reads (see LegInputVersion).
   * Omitted = "v1-main": the legs as built at 3111fd7. A classifier moves to a newer
   * input only when it is migrated on evidence.
   */
  inputVersion?: LegInputVersion;
  classify(context: ClassifierContext): TransactionClassification | null;
}

