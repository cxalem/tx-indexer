/**
 * Replays one corpus item through a source tree (dynamic imports from `root`), so the same
 * code drives the 3111fd7 tree (generate-oracle.ts) and this tree (legacy-input.test.ts).
 *
 * mode "base":   legs = transactionToLegs (the 3111fd7 builder); final = classifyTransaction.
 * mode "routed": the same `legs` and final, plus `finalWithComplete`: classifyTransaction
 *                with the additive `{ completeLegs }` option (transactionToCompleteLegs), which
 *                must not change the result either.
 * Per-classifier outputs are all eleven classifiers called directly on `legs`.
 */
import { join } from "node:path";
import {
  LEGACY_CLASSIFIERS,
  SYNTHETIC_SIGNATURE,
  syntheticResponseFor,
  type CorpusItem,
  type Perspective,
} from "./corpus";

export interface OracleEntry {
  id: string;
  perspective: Perspective;
  error?: string;
  legs?: unknown[];
  perClassifier?: Record<string, unknown>;
  final?: unknown;
  finalClassifier?: string | null;
  finalWithComplete?: unknown;
  finalWithCompleteClassifier?: string | null;
}

/** JSON-normal form: what a JSON round-trip keeps (bigints as strings). */
export function normal<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

export async function loadTree(root: string) {
  const imp = (p: string) => import(join(root, p));
  const [fetcher, fixtureRpc, synthetic, detector, legs, engine] = await Promise.all([
    imp("packages/solana/src/fetcher/transactions"),
    imp("packages/solana/src/__fixtures__/fixture-rpc"),
    imp("packages/solana/src/__fixtures__/synthetic"),
    imp("packages/classification/src/protocols/detector"),
    imp("packages/solana/src/mappers/transaction-to-legs"),
    imp("packages/classification/src/engine/classification-service"),
  ]);
  const classifiers: Array<[string, { classify: (c: unknown) => unknown }]> = [];
  for (const [name, file, cls] of LEGACY_CLASSIFIERS) {
    const mod = await imp(`packages/classification/src/classifiers/${file}`);
    classifiers.push([name, new mod[cls]()]);
  }
  let complete: { transactionToCompleteLegs: (tx: unknown, w?: string) => unknown[] } | null = null;
  try {
    complete = await imp("packages/solana/src/mappers/complete-legs/transaction-to-legs");
  } catch {
    complete = null; // the 3111fd7 tree has no complete legs
  }
  return { fetcher, fixtureRpc, synthetic, detector, legs, engine, classifiers, complete };
}

type Tree = Awaited<ReturnType<typeof loadTree>>;

async function fetchTx(tree: Tree, item: CorpusItem) {
  if (item.kind === "body") {
    const { rpc } = tree.fixtureRpc.createFixtureRpc({ [item.signature]: item.body });
    return tree.fetcher.fetchTransaction(rpc, item.signature);
  }
  const { rpc } = tree.synthetic.mockRpc(() => syntheticResponseFor(item));
  return tree.fetcher.fetchTransaction(rpc, SYNTHETIC_SIGNATURE);
}

export async function runItem(
  tree: Tree,
  item: CorpusItem,
  perspective: Perspective,
  mode: "base" | "routed",
): Promise<OracleEntry> {
  const wallet = perspective ?? undefined;
  const entry: OracleEntry = { id: item.id, perspective };
  try {
    const tx = await fetchTx(tree, item);
    if (!tx) return { ...entry, error: "null-result" };
    tx.protocol = tree.detector.detectProtocol(tx.programIds);
    type Final = { debugTrace?: { selectedClassifier: string | null } } & Record<string, unknown>;
    const legs: unknown[] = tree.legs.transactionToLegs(tx, wallet);
    const final: Final = tree.engine.classifyTransaction(legs, tx, wallet);
    let extra: Partial<OracleEntry> = {};
    if (mode === "routed") {
      const completeLegs = tree.complete!.transactionToCompleteLegs(tx, wallet);
      const withComplete: Final = tree.engine.classifyTransaction(legs, tx, wallet, { completeLegs });
      const { debugTrace: t, ...rest } = withComplete;
      extra = { finalWithComplete: normal(rest), finalWithCompleteClassifier: t?.selectedClassifier ?? null };
    }
    const perClassifier: Record<string, unknown> = {};
    for (const [name, c] of tree.classifiers) {
      perClassifier[name] = normal(c.classify({ legs, tx, walletAddress: wallet }) ?? null);
    }
    const { debugTrace, ...finalWithoutTrace } = final;
    return {
      ...entry,
      legs: normal(legs) as unknown[],
      perClassifier,
      final: normal(finalWithoutTrace),
      finalClassifier: debugTrace?.selectedClassifier ?? null,
      ...extra,
    };
  } catch (e) {
    return { ...entry, error: `${(e as Error)?.constructor?.name}: ${(e as Error)?.message}` };
  }
}
