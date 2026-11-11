/**
 * The transfer pairing helper is shared by transfer (migrated, uses the new `participant`
 * option) and Solana Pay (legacy, never passes it). With the option omitted it must behave
 * exactly as at 3111fd7: compared here with the 3111fd7 source (`git show`) on generated
 * leg arrays. Without git the test is skipped (UNAVAILABLE), never passed.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { findBestExternalTransferPair } from "../../engine/transfer-pairing";

const BASE = "3111fd7";
const REPO = join(import.meta.dir, "../../../../..");
let baseSource: string | null = null;
try {
  baseSource = execFileSync("git", ["show", `${BASE}:packages/classification/src/engine/transfer-pairing.ts`], {
    cwd: REPO,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch {
  console.warn(`transfer-pairing base comparison: UNAVAILABLE (git or ${BASE} missing)`);
}

/** Small deterministic PRNG so failures reproduce. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const ACCOUNTS = ["external:A", "external:B", "external:C", "external:D", "protocol:jup:SOL:P", "fee:"];
const TOKENS = [
  { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", decimals: 9 },
  { mint: "USDC", symbol: "USDC", decimals: 6 },
  { mint: "NFT", symbol: "NFT", decimals: 0 },
];
const ROLES: TxLeg["role"][] = ["sent", "received", "sent", "received", "fee", "protocol_deposit", "protocol_withdraw", "reward"];

function randomLegs(r: () => number): TxLeg[] {
  const n = 1 + Math.floor(r() * 9);
  return Array.from({ length: n }, () => {
    const token = TOKENS[Math.floor(r() * TOKENS.length)]!;
    const raw = BigInt(Math.floor(r() * 3) === 0 ? 1000 : Math.floor(r() * 5_000_000));
    return {
      accountId: ACCOUNTS[Math.floor(r() * ACCOUNTS.length)]!,
      side: r() < 0.5 ? "debit" : "credit",
      role: ROLES[Math.floor(r() * ROLES.length)]!,
      amount: { token, amountRaw: raw.toString(), amountUi: Number(raw) / 10 ** token.decimals },
    } as TxLeg;
  });
}

describe("findBestExternalTransferPair without options equals 3111fd7", () => {
  test.skipIf(baseSource === null)("5,000 generated leg arrays, default and custom roles", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pairing-base-"));
    const file = join(dir, "transfer-pairing.ts");
    writeFileSync(file, baseSource!);
    const base = (await import(file)) as { findBestExternalTransferPair: typeof findBestExternalTransferPair };
    const r = rng(42);
    let pairs = 0;
    for (let i = 0; i < 5000; i++) {
      const legs = randomLegs(r);
      // Pairs compared by the identity (index) of the chosen legs.
      const ix = (p: ReturnType<typeof findBestExternalTransferPair>) =>
        p === null ? null : [legs.indexOf(p.senderLeg), legs.indexOf(p.receiverLeg)];
      const want = base.findBestExternalTransferPair(legs);
      expect(ix(findBestExternalTransferPair(legs))).toEqual(ix(want));
      expect(ix(findBestExternalTransferPair(legs, undefined, undefined, undefined))).toEqual(ix(want));
      expect(ix(findBestExternalTransferPair(legs, undefined, undefined, {}))).toEqual(ix(want));
      const roles: TxLeg["role"][] = ["sent", "protocol_deposit"];
      expect(ix(findBestExternalTransferPair(legs, roles, ["received", "protocol_withdraw"]))).toEqual(
        ix(base.findBestExternalTransferPair(legs, roles, ["received", "protocol_withdraw"])),
      );
      if (want) pairs++;
    }
    expect(pairs).toBeGreaterThan(50); // the generator does produce pairs
  });

  test("with a participant, only pairs in which it is sender or receiver are eligible (before scoring)", () => {
    const usdc = TOKENS[1]!;
    const leg = (accountId: string, side: "debit" | "credit", raw: number): TxLeg => ({
      accountId,
      side,
      role: side === "debit" ? "sent" : "received",
      amount: { token: usdc, amountRaw: String(raw), amountUi: raw / 1e6 },
    });
    // C -> D moves more; A -> B is smaller but is the only pair involving A.
    const legs = [leg("external:C", "debit", 9_000_000), leg("external:D", "credit", 9_000_000), leg("external:A", "debit", 1_000), leg("external:B", "credit", 1_000)];
    expect(findBestExternalTransferPair(legs)!.senderLeg.accountId).toBe("external:C");
    const forA = findBestExternalTransferPair(legs, undefined, undefined, { participant: "A" })!;
    expect([forA.senderLeg.accountId, forA.receiverLeg.accountId]).toEqual(["external:A", "external:B"]);
    // B is the receiver: same pair.
    expect(findBestExternalTransferPair(legs, undefined, undefined, { participant: "B" })!.senderLeg.accountId).toBe("external:A");
    // A wallet in no pair: none.
    expect(findBestExternalTransferPair(legs, undefined, undefined, { participant: "Z" })).toBeNull();
  });
});
