/**
 * Generates legacy-digests.3111fd7.json: sha256 of every source file that builds `legs`,
 * classifies them ("v1-main") and filters the list, as it must be (= 3111fd7).
 *
 *   bun packages/sdk/src/__tests__/legacy-input/generate-digests.ts
 *
 * Roots: the `legs` mapper (packages/solana/src/mappers/transaction-to-legs.ts and
 * balance-parser.ts), every classifier the engine registers, the protocol detector and the
 * list spam filter. The closure follows value imports (relative and @tx-indexer/*);
 * `import type` is skipped (erased at runtime). Each file is verified with git before its
 * digest is written: it must equal `git show 3111fd7:<path>` byte for byte.
 * The generator refuses to write if any check fails. legacy-digests.test.ts then compares the
 * working tree with the JSON without needing git.
 *
 * Updating deliberately: when a classifier is migrated (or a legacy dependency changes on
 * purpose), regenerate with `--allow-changed <path>` for each intended file; the JSON records
 * it under `changedFromBase`, and the same commit needs an accuracy/CHANGES.md entry.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const BASE = "3111fd7";
const REPO = resolve(import.meta.dir, "../../../../..");
const OUT = join(import.meta.dir, "legacy-digests.3111fd7.json");
const ALIASES: Record<string, string> = {
  "@tx-indexer/core/": "packages/domain/src/",
  "@tx-indexer/solana/": "packages/solana/src/",
  "@tx-indexer/classification/": "packages/classification/src/",
};

export const ROOTS = [
  ...readdirSync(join(REPO, "packages/classification/src/classifiers"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `packages/classification/src/classifiers/${f}`),
  "packages/classification/src/protocols/detector.ts",
  "packages/solana/src/mappers/balance-parser.ts",
  "packages/solana/src/mappers/transaction-to-legs.ts",
  "packages/domain/src/tx/spam-filter.ts",
];

function resolveSpec(from: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith(".")) base = join(dirname(from), spec);
  for (const [alias, dir] of Object.entries(ALIASES)) if (spec.startsWith(alias)) base = dir + spec.slice(alias.length);
  if (!base) return null; // a package dependency (@solana/kit, zod): pinned by the lockfile
  for (const c of [`${base}.ts`, `${base}/index.ts`, base]) if (existsSync(join(REPO, c)) && c.endsWith(".ts")) return c;
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

/** Value imports and re-exports of a file (type-only ones skipped). */
function valueImports(file: string): string[] {
  const text = readFileSync(join(REPO, file), "utf8");
  const out: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/gms;
  for (const m of text.matchAll(re)) {
    if (m[2]) continue;
    const clause = m[3]!.trim();
    // `import { type A, type B }` is type-only too
    if (/^\{[^}]*\}$/.test(clause) && clause.slice(1, -1).split(",").every((p) => !p.trim() || p.trim().startsWith("type "))) continue;
    const r = resolveSpec(file, m[4]!);
    if (r) out.push(r);
  }
  for (const m of text.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    const r = resolveSpec(file, m[1]!);
    if (r) out.push(r);
  }
  return out;
}

export function closure(): string[] {
  const seen = new Set<string>();
  const stack = [...ROOTS];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    stack.push(...valueImports(f));
  }
  return [...seen].sort();
}

export const sha256 = (path: string) => createHash("sha256").update(readFileSync(join(REPO, path))).digest("hex");

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
}

if (import.meta.main) {
  const allow = new Set<string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) if (argv[i] === "--allow-changed") allow.add(argv[++i]!);
  const files = closure();
  const problems: string[] = [];
  for (const f of files) {
    if (allow.has(f)) continue;
    const basePath = f;
    let base: string;
    try {
      base = git(["show", `${BASE}:${basePath}`]);
    } catch {
      problems.push(`${f}: not present at ${BASE}`);
      continue;
    }
    const mine = readFileSync(join(REPO, f), "utf8");
    if (mine !== base) problems.push(`${f}: differs from ${BASE}:${basePath}`);
  }
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  const digests = Object.fromEntries(files.map((f) => [f, sha256(f)]));
  writeFileSync(
    OUT,
    JSON.stringify({ base: BASE, roots: ROOTS, changedFromBase: [...allow].sort(), files: digests }, null, 2) + "\n",
  );
  console.log(`${files.length} files verified against ${BASE} -> ${relative(REPO, OUT)}`);
}
