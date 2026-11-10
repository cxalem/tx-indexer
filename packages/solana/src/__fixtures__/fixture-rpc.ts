/**
 * Offline replay helpers for recorded mainnet fixtures (test-only).
 *
 * The fixtures store the verbatim JSON-RPC response body. To replay them the
 * way production does, we build a real @solana/kit RPC on top of a mocked
 * transport, so kit's own response transformers (bigint parsing, numeric
 * downcasting, JSON-RPC error mapping) run exactly as they do over HTTP.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSolanaRpcFromTransport } from "@solana/kit";

export const FIXTURE_DIR = join(import.meta.dir, "mainnet");

export interface FixtureMeta {
  signature: string;
  cluster: string;
  slot: number | null;
  version: number | null;
  commitment: string;
  description: string;
}

/**
 * Parses JSON while preserving every integer literal as a bigint (the same
 * contract as kit's internal parseJsonWithBigInts, which is not re-exported).
 * Floats stay numbers.
 */
export function parseJsonWithBigInts(text: string): unknown {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += text[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      let j = i + 1;
      while (j < text.length && /[0-9.eE+-]/.test(text[j]!)) j++;
      const token = text.slice(i, j);
      out += /^-?\d+$/.test(token) ? `{"__bigint__":"${token}"}` : token;
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return JSON.parse(out, (_key, value) =>
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length === 1 &&
    typeof value.__bigint__ === "string"
      ? BigInt(value.__bigint__)
      : value,
  );
}

export function readFixtureText(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), "utf8");
}

/** Returns the fixture metadata and the verbatim RPC response body text. */
export function loadFixture(name: string): {
  meta: FixtureMeta;
  responseText: string;
} {
  const text = readFixtureText(name);
  const meta = JSON.parse(text)._meta as FixtureMeta;
  const marker = '"response": ';
  const start = text.indexOf(marker) + marker.length;
  const end = text.lastIndexOf("}");
  return { meta, responseText: text.slice(start, end).trim() };
}

/**
 * Builds a kit RPC whose transport answers `getTransaction` from recorded
 * response bodies keyed by signature (null result for unknown signatures).
 * Any other method throws, so a test cannot reach the network by accident.
 */
export function createFixtureRpc(
  responsesBySignature: Record<string, string>,
  options: { historySignatures?: string[] } = {},
) {
  const calls: Array<{ method: string; params: unknown }> = [];
  const transport = async ({ payload }: { payload: unknown }) => {
    const { id, method, params } = payload as {
      id: unknown;
      method: string;
      params: unknown[];
    };
    calls.push({ method, params });
    if (method === "getSignaturesForAddress" && options.historySignatures) {
      const before = (params[1] as { before?: string } | undefined)?.before;
      // Single page: everything on the first call, nothing after.
      const result = before
        ? []
        : options.historySignatures.map((signature, i) => ({
            signature,
            slot: BigInt(1000 - i),
            blockTime: BigInt(1700000000 - i),
            err: null,
            memo: null,
            confirmationStatus: "finalized",
          }));
      return { jsonrpc: "2.0", id, result } as never;
    }
    if (method !== "getTransaction") {
      throw new Error(`fixture RPC: unexpected method ${method}`);
    }
    const signature = String(params[0]);
    const body = responsesBySignature[signature];
    const parsed = body
      ? (parseJsonWithBigInts(body) as Record<string, unknown>)
      : { jsonrpc: "2.0", result: null };
    return { ...parsed, id } as never;
  };
  const rpc = createSolanaRpcFromTransport(transport as never);
  return { rpc, calls };
}
