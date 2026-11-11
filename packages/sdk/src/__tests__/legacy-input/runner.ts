/**
 * Replays one corpus item through a source tree (dynamic imports from `root`), so the same
 * code drives the 3111fd7 tree (generate-oracle.ts) and this tree (legacy-input.test.ts).
 *
 * mode "base":   legs = transactionToLegs (the 3111fd7 builder); final = classifyTransaction.
 * mode "routed": legs = transactionToLegInputs()["v1-main"]; final = classifyTransaction with
 *                the truthful legs and `{ legacyLegs }` (the SDK path).
 * Per-classifier outputs are the nine legacy classifiers called directly on `legs`.
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
  let legInputs: { transactionToLegInputs: (tx: unknown, w?: string) => Record<string, unknown[]> } | null = null;
  try {
    legInputs = await imp("packages/solana/src/mappers/leg-inputs");
  } catch {
    legInputs = null; // the 3111fd7 tree has no leg inputs
  }
  return { fetcher, fixtureRpc, synthetic, detector, legs, engine, classifiers, legInputs };
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
    let legs: unknown[];
    let final: { debugTrace?: { selectedClassifier: string | null } } & Record<string, unknown>;
    if (mode === "base") {
      legs = tree.legs.transactionToLegs(tx, wallet);
      final = tree.engine.classifyTransaction(legs, tx, wallet);
    } else {
      const inputs = tree.legInputs!.transactionToLegInputs(tx, wallet);
      legs = inputs["v1-main"]!;
      final = tree.engine.classifyTransaction(inputs["v2-closed-token-accounts"], tx, wallet, {
        legacyLegs: legs,
      });
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
    };
  } catch (e) {
    return { ...entry, error: `${(e as Error)?.constructor?.name}: ${(e as Error)?.message}` };
  }
}
