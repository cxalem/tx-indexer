/**
 * Twin test: the same 1 SOL transfer, once with the receiver as a static
 * account key and once with the receiver loaded from an address lookup table,
 * must produce the same resolved movements and the same classification.
 */
import { describe, test, expect } from "bun:test";
import type { Signature } from "@solana/kit";
import { fetchTransaction } from "@tx-indexer/solana/fetcher/transactions";
import { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";
import { classifyTransaction } from "../../engine/classification-service";
import { detectProtocol } from "../../protocols/detector";
import {
  SOL,
  SENDER,
  RECEIVER,
  SYSTEM_PROGRAM,
  mockRpc,
  syntheticResponse,
} from "@tx-indexer/solana/__fixtures__/synthetic";

const SIG = "TwinSignature11111111111111111111111111111111111111111111111111111111111111111111111111" as Signature;

async function classify(response: unknown) {
  const { rpc } = mockRpc(() => response);
  const tx = (await fetchTransaction(rpc, SIG))!;
  tx.protocol = detectProtocol(tx.programIds);
  const legs = transactionToLegs(tx, SENDER);
  const classification = classifyTransaction(legs, tx, SENDER);
  return { tx, legs, classification };
}

const fmt = (legs: ReturnType<typeof transactionToLegs>) =>
  legs.map((l) => `${l.accountId} ${l.side} ${l.amount.amountRaw} ${l.role}`).sort();

describe("static vs lookup-table receiver twin", () => {
  test("same movements and same classification", async () => {
    const staticTwin = await classify(
      syntheticResponse({
        staticKeys: [SENDER, RECEIVER, SYSTEM_PROGRAM],
        pre: [10n * SOL, 2n * SOL, 1n],
        post: [9n * SOL - 5000n, 3n * SOL, 1n],
        instructions: [{ programIdIndex: 2, accounts: [0, 1] }],
      }),
    );
    const altTwin = await classify(
      syntheticResponse({
        staticKeys: [SENDER, SYSTEM_PROGRAM],
        loaded: { writable: [RECEIVER], readonly: [] },
        pre: [10n * SOL, 1n, 2n * SOL],
        post: [9n * SOL - 5000n, 1n, 3n * SOL],
        instructions: [{ programIdIndex: 1, accounts: [0, 2] }],
      }),
    );

    expect(fmt(altTwin.legs)).toEqual(fmt(staticTwin.legs));
    expect(fmt(altTwin.legs)).toEqual(
      [
        `external:${SENDER} debit 1000005000 sent`,
        `external:${RECEIVER} credit 1000000000 received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );

    const pick = (c: typeof staticTwin.classification) => ({
      primaryType: c.primaryType,
      sender: c.sender,
      receiver: c.receiver,
      amount: c.primaryAmount?.amountRaw,
    });
    expect(pick(altTwin.classification)).toEqual(pick(staticTwin.classification));
    expect(altTwin.classification.primaryType).toBe("transfer");
    expect(altTwin.classification.receiver).toBe(RECEIVER);
    expect(altTwin.tx.reconciliation?.status).toBe("balanced");
    expect(staticTwin.tx.reconciliation?.status).toBe("balanced");
  });
});
