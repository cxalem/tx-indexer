import { describe, test, expect } from "bun:test";
import { getUserLegs } from "../../engine/leg-helpers";
import { createMockLeg, createUsdcAmount } from "../fixtures/mock-factories";

describe("leg-helpers", () => {
  test("getUserLegs matches exact external and wallet account ids", () => {
    const wallet = "WalletABC123";
    const legs = [
      createMockLeg({
        accountId: `external:${wallet}`,
        side: "debit",
        role: "sent",
        amount: createUsdcAmount(1),
      }),
      createMockLeg({
        accountId: `wallet:${wallet}`,
        side: "credit",
        role: "received",
        amount: createUsdcAmount(1),
      }),
      createMockLeg({
        accountId: `external:${wallet}suffix`,
        side: "credit",
        role: "received",
        amount: createUsdcAmount(1),
      }),
    ];

    const userLegs = getUserLegs(legs, wallet as never);

    expect(userLegs).toHaveLength(2);
    expect(userLegs.every((leg) => leg.accountId.endsWith(wallet))).toBe(true);
  });
});
