/**
 * Routing of versioned leg inputs in the ONE classification engine: each classifier
 * receives the input version it declares (swap: "v2-closed-token-accounts"; all others,
 * transfer included: "v1-main"), chosen immediately before it runs; priorities, the
 * registration-order tie-break and the isRelevant arbitration are unchanged.
 */
import { describe, expect, test } from "bun:test";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { ClassificationService } from "../../engine/classification-service";
import type { Classifier, ClassifierContext } from "../../engine/classifier.interface";
import {
  createMockLeg,
  createMockTransaction,
  createNftAmount,
  createSolAmount,
  createUsdcAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

const ALICE = "A1ice11111111111111111111111111111111111111";
const BOB = "Bob1111111111111111111111111111111111111111";
const CAROL = "Caro1111111111111111111111111111111111111111";
const MIGRATED = new Set(["swap"]);

type Registered = Array<{ classifier: Classifier; order: number }>;

/** A fresh engine whose classifiers record the legs array they were given. */
function spiedService() {
  const service = new ClassificationService();
  const seen = new Map<string, TxLeg[]>();
  const outputs = new Map<string, unknown>();
  for (const { classifier } of (service as unknown as { classifiers: Registered }).classifiers) {
    const original = classifier.classify.bind(classifier);
    classifier.classify = (context: ClassifierContext) => {
      seen.set(classifier.name, context.legs);
      const out = original(context);
      outputs.set(classifier.name, out);
      return out;
    };
  }
  return { service, seen, outputs };
}

const order = (s: ClassificationService) =>
  (s as unknown as { classifiers: Registered }).classifiers.map((c) => c.classifier.name);

const semantic = (trace: { decisions: Array<Record<string, unknown>> }) =>
  trace.decisions.map(({ elapsedMs: _drop, ...rest }) => rest);

const fee = createMockLeg({ accountId: "fee:network", side: "credit", role: "fee", amount: createSolAmount(0.000005) });

describe("each classifier receives the input version it declares", () => {
  test("declared versions: swap migrated, every other classifier (transfer included) v1-main", () => {
    const service = new ClassificationService();
    const versions = Object.fromEntries(
      (service as unknown as { classifiers: Registered }).classifiers.map(({ classifier }) => [
        classifier.name,
        classifier.inputVersion ?? "v1-main",
      ]),
    );
    expect(versions).toEqual({
      "solana-pay": "v1-main",
      bridge: "v1-main",
      "privacy-cash": "v1-main",
      "nft-mint": "v1-main",
      "nft-transfer": "v1-main",
      "stake-deposit": "v1-main",
      "stake-withdraw": "v1-main",
      swap: "v2-closed-token-accounts",
      airdrop: "v1-main",
      "fee-only": "v1-main",
      transfer: "v1-main",
    });
  });

  test("with { legacyLegs }: migrated classifiers get the truthful array, the rest the legacy array; trace says which", () => {
    const { service, seen } = spiedService();
    const v2: TxLeg[] = [];
    const v1: TxLeg[] = [];
    const { debugTrace } = service.classifyWithTrace(v2, createMockTransaction(), ALICE, { legacyLegs: v1 });
    expect(seen.size).toBe(11); // nothing matched, so every classifier ran
    for (const [name, legs] of seen) expect(legs).toBe(MIGRATED.has(name) ? v2 : v1);
    for (const d of debugTrace.decisions) {
      expect(d.legInput).toBe(MIGRATED.has(d.classifier) ? "v2-closed-token-accounts" : "v1-main");
    }
  });

  test("without options every classifier reads the supplied array (legInput: supplied)", () => {
    const { service, seen } = spiedService();
    const legs: TxLeg[] = [];
    const { debugTrace } = service.classifyWithTrace(legs, createMockTransaction(), ALICE);
    for (const l of seen.values()) expect(l).toBe(legs);
    expect(debugTrace.decisions.every((d) => d.legInput === "supplied")).toBe(true);
  });

  test("varying the v2 input never changes what a legacy classifier returns", () => {
    // NFT receive with a SOL payment: legacy classifiers have something to say.
    const v1 = [
      createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createNftAmount("Cat") }),
      createMockLeg({ accountId: `external:${BOB}`, side: "debit", role: "sent", amount: createNftAmount("Cat") }),
      fee,
    ];
    const variants: TxLeg[][] = [
      [],
      v1,
      [createMockLeg({ accountId: `external:${ALICE}`, side: "debit", role: "sent", amount: createUsdcAmount(5) })],
      [
        createMockLeg({ accountId: `external:${ALICE}`, side: "debit", role: "sent", amount: createUsdcAmount(5) }),
        createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createSolAmount(1) }),
      ],
    ];
    const legacyOutputs = variants.map((v2) => {
      const { service, outputs } = spiedService();
      // Run every classifier: call each one through the engine's routing, one by one.
      service.classifyWithTrace(v2, createMockTransaction({ accountKeys: [ALICE, BOB] }), ALICE, { legacyLegs: v1 });
      return Object.fromEntries([...outputs].filter(([name]) => !MIGRATED.has(name)));
    });
    for (const o of legacyOutputs.slice(1)) expect(o).toEqual(legacyOutputs[0]!);
  });
});

describe("arbitration is unchanged", () => {
  test("priorities and the registration-order tie-break (nft-transfer before swap at 80)", () => {
    expect(order(new ClassificationService())).toEqual([
      "solana-pay",
      "bridge",
      "privacy-cash",
      "nft-mint",
      "stake-deposit",
      "stake-withdraw",
      "nft-transfer",
      "swap",
      "airdrop",
      "fee-only",
      "transfer",
    ]);
  });

  test("equal priority: a legacy nft-transfer match on v1 wins over a swap match on v2", () => {
    const v1 = [
      createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createNftAmount("Cat") }),
      createMockLeg({ accountId: `external:${BOB}`, side: "debit", role: "sent", amount: createNftAmount("Cat") }),
    ];
    const v2 = [
      createMockLeg({ accountId: `external:${ALICE}`, side: "debit", role: "sent", amount: createUsdcAmount(5) }),
      createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createTokenAmount("X", 6, 7, "XMint") }),
    ];
    const service = new ClassificationService();
    const routed = service.classifyWithTrace(v2, createMockTransaction({ accountKeys: [ALICE] }), ALICE, { legacyLegs: v1 });
    expect(routed.classification.primaryType).toBe("nft_receive");
    expect(routed.debugTrace.selectedClassifier).toBe("nft-transfer");
    // and the swap alone would have matched v2
    expect(service.classify(v2, createMockTransaction({ accountKeys: [ALICE] }), ALICE).primaryType).toBe("swap");
  });

  test("relevant vs non-relevant: a later transfer (v1) replaces a non-relevant fee-only (v1); without a pair fee-only stays", () => {
    // fee-only and transfer both read v1-main and cannot both match one real array (any
    // external non-fee leg stops fee-only), so fee-only is forced to a non-relevant match to
    // exercise the arbitration; transfer finds its pair in the legacy array, never in v2.
    const v1 = [
      fee,
      createMockLeg({ accountId: `external:${BOB}`, side: "debit", role: "sent", amount: createUsdcAmount(5) }),
      createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createUsdcAmount(5) }),
    ];
    const service = new ClassificationService();
    const feeOnly = (service as unknown as { classifiers: Registered }).classifiers.find(
      (c) => c.classifier.name === "fee-only",
    )!.classifier;
    const realFeeOnly = feeOnly.classify.bind(feeOnly);
    feeOnly.classify = () => realFeeOnly({ legs: [fee], tx: createMockTransaction() });
    const tx = createMockTransaction({ accountKeys: [BOB, ALICE] });
    const routed = service.classifyWithTrace([fee], tx, ALICE, { legacyLegs: v1 });
    expect(routed.debugTrace.selectedClassifier).toBe("transfer");
    expect(routed.classification.sender).toBe(BOB);
    expect(semantic(routed.debugTrace).find((d) => d.classifier === "fee-only")).toEqual({
      classifier: "fee-only",
      priority: 60,
      matched: true,
      relevant: false,
      reason: "Matched non-relevant fee_only",
      legInput: "v1-main",
    });
    expect(semantic(routed.debugTrace).find((d) => d.classifier === "transfer")!.legInput).toBe("v1-main");
    // the pair only in the truthful array: transfer (v1) sees no pair, fee-only stays
    const noPair = new ClassificationService().classifyWithTrace(v1, tx, ALICE, { legacyLegs: [fee] });
    expect(noPair.classification.primaryType).toBe("fee_only");
    expect(noPair.debugTrace.selectedClassifier).toBe("fee-only");
  });

  test("swap gains a match only visible in v2, and loses one only visible in v1", () => {
    const service = new ClassificationService();
    const tx = createMockTransaction({ accountKeys: [ALICE] });
    const sell = [
      createMockLeg({ accountId: `external:${ALICE}`, side: "debit", role: "sent", amount: createTokenAmount("JUNK", 6, 1000, "JunkMint") }),
      createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createSolAmount(2) }),
    ];
    const solOnly = [sell[1]!];
    const gained = service.classifyWithTrace(sell, tx, ALICE, { legacyLegs: solOnly });
    expect(gained.debugTrace.selectedClassifier).toBe("swap");
    const lost = service.classifyWithTrace(solOnly, tx, ALICE, { legacyLegs: sell });
    expect(lost.debugTrace.decisions.find((d) => d.classifier === "swap")!.matched).toBe(false);
  });

  test("semantic trace (timing removed) records order, outcomes and inputs", () => {
    const service = new ClassificationService();
    const v2 = [
      createMockLeg({ accountId: `external:${BOB}`, side: "debit", role: "sent", amount: createUsdcAmount(5) }),
      createMockLeg({ accountId: `external:${CAROL}`, side: "credit", role: "received", amount: createUsdcAmount(5) }),
    ];
    // The pair is only in the truthful array; transfer reads v1-main (empty) and does not match.
    const trace = service.classifyWithTrace(v2, createMockTransaction(), ALICE, { legacyLegs: [] }).debugTrace;
    expect(trace.selectedClassifier).toBeNull();
    expect(semantic(trace).map((d) => [d.classifier, d.matched, d.legInput])).toEqual([
      ["solana-pay", false, "v1-main"],
      ["bridge", false, "v1-main"],
      ["privacy-cash", false, "v1-main"],
      ["nft-mint", false, "v1-main"],
      ["stake-deposit", false, "v1-main"],
      ["stake-withdraw", false, "v1-main"],
      ["nft-transfer", false, "v1-main"],
      ["swap", false, "v2-closed-token-accounts"],
      ["airdrop", false, "v1-main"],
      ["fee-only", false, "v1-main"],
      ["transfer", false, "v1-main"],
    ]);
    // the same pair on v1-main is matched by transfer, as at 3111fd7 (another wallet's pair included)
    const onV1 = service.classifyWithTrace([], createMockTransaction(), ALICE, { legacyLegs: v2 });
    expect(onV1.debugTrace.selectedClassifier).toBe("transfer");
    expect([onV1.classification.sender, onV1.classification.receiver]).toEqual([BOB, CAROL]);
  });
});
