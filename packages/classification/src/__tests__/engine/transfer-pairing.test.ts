import { describe, test, expect } from "bun:test";
import {
  findBestExternalTransferPair,
  isTinySolMovement,
} from "../../engine/transfer-pairing";
import {
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

describe("transfer-pairing", () => {
  test("prefers exact amount sender/receiver match", () => {
    const sender = "SENDER";
    const receiverA = "A";
    const receiverB = "B";
    const legs = [
      createMockLeg({
        accountId: `external:${sender}`,
        side: "debit",
        role: "sent",
        amount: createUsdcAmount(100),
      }),
      createMockLeg({
        accountId: `external:${receiverA}`,
        side: "credit",
        role: "received",
        amount: createUsdcAmount(50),
      }),
      createMockLeg({
        accountId: `external:${receiverB}`,
        side: "credit",
        role: "received",
        amount: createUsdcAmount(100),
      }),
    ];

    const pair = findBestExternalTransferPair(legs);

    expect(pair).not.toBeNull();
    expect(pair?.receiverLeg.accountId).toBe(`external:${receiverB}`);
  });

  test("de-prioritizes tiny SOL pair when token transfer exists", () => {
    const sender = "SENDER";
    const receiver = "RECEIVER";
    const legs = [
      createMockLeg({
        accountId: `external:${sender}`,
        side: "debit",
        role: "sent",
        amount: createSolAmount(0.000005),
      }),
      createMockLeg({
        accountId: `external:${receiver}`,
        side: "credit",
        role: "received",
        amount: createSolAmount(0.000005),
      }),
      createMockLeg({
        accountId: `external:${sender}`,
        side: "debit",
        role: "sent",
        amount: createUsdcAmount(75),
      }),
      createMockLeg({
        accountId: `external:${receiver}`,
        side: "credit",
        role: "received",
        amount: createUsdcAmount(75),
      }),
    ];

    const pair = findBestExternalTransferPair(legs);

    expect(pair).not.toBeNull();
    expect(pair?.senderLeg.amount.token.symbol).toBe("USDC");
  });

  test("is order invariant for same inputs", () => {
    const sender = "SENDER";
    const receiver = "RECEIVER";
    const ordered = [
      createMockLeg({
        accountId: `external:${sender}`,
        side: "debit",
        role: "sent",
        amount: createUsdcAmount(5),
      }),
      createMockLeg({
        accountId: `external:${receiver}`,
        side: "credit",
        role: "received",
        amount: createUsdcAmount(5),
      }),
    ];

    const reversed = [...ordered].reverse();

    const pairA = findBestExternalTransferPair(ordered);
    const pairB = findBestExternalTransferPair(reversed);

    expect(pairA?.senderLeg.amount.token.mint).toBe(pairB?.senderLeg.amount.token.mint);
    expect(pairA?.senderLeg.amount.amountRaw).toBe(pairB?.senderLeg.amount.amountRaw);
    expect(pairA?.receiverLeg.amount.amountRaw).toBe(pairB?.receiverLeg.amount.amountRaw);
  });

  test("detects tiny SOL movement helper", () => {
    const tiny = createMockLeg({
      accountId: "external:USER",
      side: "debit",
      role: "sent",
      amount: createSolAmount(0.000001),
    });
    const normal = createMockLeg({
      accountId: "external:USER",
      side: "debit",
      role: "sent",
      amount: createSolAmount(1),
    });

    expect(isTinySolMovement(tiny)).toBe(true);
    expect(isTinySolMovement(normal)).toBe(false);
  });
});
