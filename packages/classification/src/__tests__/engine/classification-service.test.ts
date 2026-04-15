import { describe, test, expect } from "bun:test";
import { ClassificationService } from "../../engine/classification-service";
import type {
  Classifier,
  ClassifierContext,
} from "../../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import {
  createMockLeg,
  createMockTransaction,
  createSolAmount,
} from "../fixtures/mock-factories";

function makeClassification(
  primaryType: TransactionClassification["primaryType"],
): TransactionClassification {
  return {
    primaryType,
    primaryAmount: null,
    secondaryAmount: null,
    sender: null,
    receiver: null,
    counterparty: null,
    confidence: 0.9,
    isRelevant: true,
    metadata: {},
  };
}

class TestClassifier implements Classifier {
  constructor(
    public name: string,
    public priority: number,
    private readonly result: TransactionClassification | null,
  ) {}

  classify(context: ClassifierContext): TransactionClassification | null {
    void context;
    return this.result;
  }
}

describe("ClassificationService", () => {
  test("returns fee_only when no relevant classifier matches", () => {
    const service = new ClassificationService();
    const feePayer = "FEE_PAYER_1";
    const tx = createMockTransaction();
    const legs = [
      createMockLeg({
        accountId: `external:${feePayer}`,
        side: "debit",
        role: "fee",
        amount: createSolAmount(0.000005),
      }),
      createMockLeg({
        accountId: "fee:network",
        side: "credit",
        role: "fee",
        amount: createSolAmount(0.000005),
      }),
    ];

    const result = service.classify(legs, tx);

    expect(result.primaryType).toBe("fee_only");
    expect(result.isRelevant).toBe(false);
    expect(result.debugTrace?.selectedClassifier).toBe("fee-only");
    expect(result.debugTrace?.decisions.length).toBeGreaterThan(0);
  });

  test("still prefers relevant classification when available", () => {
    const service = new ClassificationService();
    const sender = "SENDER_1";
    const receiver = "RECEIVER_1";
    const tx = createMockTransaction();
    const legs = [
      createMockLeg({
        accountId: `external:${sender}`,
        side: "debit",
        role: "fee",
        amount: createSolAmount(0.000005),
      }),
      createMockLeg({
        accountId: `external:${sender}`,
        side: "debit",
        role: "sent",
        amount: createSolAmount(1),
      }),
      createMockLeg({
        accountId: `external:${receiver}`,
        side: "credit",
        role: "received",
        amount: createSolAmount(1),
      }),
    ];

    const result = service.classify(legs, tx);

    expect(result.primaryType).toBe("transfer");
    expect(result.isRelevant).toBe(true);
  });

  test("keeps registration order for equal priority classifiers", () => {
    const service = new ClassificationService();
    const tx = createMockTransaction();

    service.registerClassifier(
      new TestClassifier("first", 200, makeClassification("transfer")),
    );
    service.registerClassifier(
      new TestClassifier("second", 200, makeClassification("swap")),
    );

    const result = service.classify([], tx);

    expect(result.primaryType).toBe("transfer");
    expect(result.debugTrace?.selectedClassifier).toBe("first");
  });

  test("classifyWithTrace includes no-match and skipped decisions", () => {
    const service = new ClassificationService();
    const tx = createMockTransaction();

    service.registerClassifier(new TestClassifier("first", 300, null));
    service.registerClassifier(
      new TestClassifier("second", 250, makeClassification("transfer")),
    );
    service.registerClassifier(new TestClassifier("third", 200, null));

    const { classification, debugTrace } = service.classifyWithTrace([], tx);

    expect(classification.primaryType).toBe("transfer");
    expect(debugTrace.selectedClassifier).toBe("second");

    const first = debugTrace.decisions.find((d) => d.classifier === "first");
    const second = debugTrace.decisions.find((d) => d.classifier === "second");
    const third = debugTrace.decisions.find((d) => d.classifier === "third");

    expect(first?.reason).toBe("No match");
    expect(second?.matched).toBe(true);
    expect(third?.reason).toContain("Not evaluated");
  });
});
