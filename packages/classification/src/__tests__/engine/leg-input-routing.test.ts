/**
 * Named leg inputs in the ONE classification engine. `legs` is the "v1-main" input with its
 * 1.6.x meaning; the optional `{ completeLegs }` ("v2-closed-token-accounts") is read only by
 * a classifier that declares it. Every built-in classifier reads "v1-main", so passing
 * `completeLegs` changes nothing but the trace's `legInput`; without options the engine
 * behaves exactly as at 3111fd7 (no `legInput` in the trace).
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

type Registered = Array<{ classifier: Classifier; order: number }>;
const registered = (s: ClassificationService) => (s as unknown as { classifiers: Registered }).classifiers;

/** A fresh engine whose classifiers record the legs array they were given and their output. */
function spiedService() {
  const service = new ClassificationService();
  const seen = new Map<string, TxLeg[]>();
  const outputs = new Map<string, unknown>();
  for (const { classifier } of registered(service)) {
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

const semantic = (trace: { decisions: Array<Record<string, unknown>> }) =>
  trace.decisions.map(({ elapsedMs: _drop, ...rest }) => rest);

const fee = createMockLeg({ accountId: "fee:network", side: "credit", role: "fee", amount: createSolAmount(0.000005) });
const transferLegs = [
  fee,
  createMockLeg({ accountId: `external:${BOB}`, side: "debit", role: "sent", amount: createUsdcAmount(5) }),
  createMockLeg({ accountId: `external:${CAROL}`, side: "credit", role: "received", amount: createUsdcAmount(5) }),
];
const sell = [
  createMockLeg({ accountId: `external:${ALICE}`, side: "debit", role: "sent", amount: createTokenAmount("JUNK", 6, 1000, "JunkMint") }),
  createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createSolAmount(2) }),
];

describe("named inputs: every built-in classifier reads v1-main (`legs`)", () => {
  test("declared versions", () => {
    const versions = registered(new ClassificationService()).map(({ classifier }) => classifier.inputVersion ?? "v1-main");
    expect(versions).toHaveLength(11);
    expect(new Set(versions)).toEqual(new Set(["v1-main"]));
  });

  test("without options: every classifier reads `legs` and the trace has no legInput (1.6.x)", () => {
    const { service, seen } = spiedService();
    const legs: TxLeg[] = [];
    const { debugTrace } = service.classifyWithTrace(legs, createMockTransaction(), ALICE);
    expect(seen.size).toBe(11);
    for (const l of seen.values()) expect(l).toBe(legs);
    expect(debugTrace.decisions.every((d) => !("legInput" in d))).toBe(true);
  });

  test("with { completeLegs }: built-ins still read `legs`; the trace says v1-main", () => {
    const { service, seen } = spiedService();
    const legs: TxLeg[] = [];
    const completeLegs: TxLeg[] = [];
    const { debugTrace } = service.classifyWithTrace(legs, createMockTransaction(), ALICE, { completeLegs });
    for (const l of seen.values()) expect(l).toBe(legs);
    expect(debugTrace.decisions.every((d) => d.legInput === "v1-main")).toBe(true);
  });

  test("varying completeLegs never changes a built-in classifier's output or the result", () => {
    const tx = createMockTransaction({ accountKeys: [ALICE, BOB, CAROL] });
    const run = (completeLegs?: TxLeg[]) => {
      const { service, outputs } = spiedService();
      const r = service.classifyWithTrace(transferLegs, tx, ALICE, completeLegs ? { completeLegs } : undefined);
      const { debugTrace: _t, ...classification } = r.classification as typeof r.classification & { debugTrace?: unknown };
      return { outputs: Object.fromEntries(outputs), classification, selected: r.debugTrace.selectedClassifier };
    };
    const base = run();
    for (const v of [[], sell, transferLegs, [createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createNftAmount("Cat") })]]) {
      expect(run(v)).toEqual(base);
    }
  });

  test("a classifier that declares v2 reads completeLegs when given, `legs` otherwise", () => {
    const service = new ClassificationService();
    const seen: TxLeg[][] = [];
    const probe: Classifier = {
      name: "probe-v2",
      priority: 1000,
      inputVersion: "v2-closed-token-accounts",
      classify: (c: ClassifierContext) => {
        seen.push(c.legs);
        return null;
      },
    };
    service.registerClassifier(probe);
    const legs: TxLeg[] = [];
    const completeLegs: TxLeg[] = [];
    const t = service.classifyWithTrace(legs, createMockTransaction(), ALICE, { completeLegs }).debugTrace;
    expect(seen[0]).toBe(completeLegs);
    expect(t.decisions[0]).toMatchObject({ classifier: "probe-v2", legInput: "v2-closed-token-accounts" });
    service.classifyWithTrace(legs, createMockTransaction(), ALICE);
    expect(seen[1]).toBe(legs);
  });
});

describe("arbitration is unchanged", () => {
  test("priorities and the registration-order tie-break (nft-transfer before swap at 80)", () => {
    expect(registered(new ClassificationService()).map((c) => c.classifier.name)).toEqual([
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

  test("swap reads `legs`: a sell only in completeLegs is not a swap", () => {
    const service = new ClassificationService();
    const tx = createMockTransaction({ accountKeys: [ALICE] });
    const onlyComplete = service.classifyWithTrace([sell[1]!], tx, ALICE, { completeLegs: sell });
    expect(onlyComplete.debugTrace.decisions.find((d) => d.classifier === "swap")).toMatchObject({ matched: false, legInput: "v1-main" });
    expect(service.classifyWithTrace(sell, tx, ALICE).debugTrace.selectedClassifier).toBe("swap");
  });

  test("semantic trace with options equals the trace without options plus legInput", () => {
    const service = new ClassificationService();
    const tx = createMockTransaction();
    const plain = semantic(service.classifyWithTrace(transferLegs, tx, ALICE).debugTrace);
    const withOpts = semantic(service.classifyWithTrace(transferLegs, tx, ALICE, { completeLegs: sell }).debugTrace);
    expect(withOpts.map(({ legInput: _l, ...rest }) => rest)).toEqual(plain);
  });
});
