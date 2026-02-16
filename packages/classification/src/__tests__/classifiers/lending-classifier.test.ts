import { describe, test, expect } from "bun:test";
import { LendingClassifier } from "../../classifiers/lending-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("LendingClassifier", () => {
  const classifier = new LendingClassifier();

  describe("token deposits", () => {
    test("should classify USDC deposit into Marginfi", () => {
      const userAddress = "USER123";
      const depositAmount = 1000;
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createUsdcAmount(depositAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "marginfi", name: "Marginfi" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_deposit");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.primaryAmount?.amountUi).toBe(depositAmount);
      expect(result?.sender).toBe(userAddress);
      expect(result?.receiver).toBeNull();
      expect(result?.confidence).toBe(0.9);
      expect(result?.metadata?.protocol).toBe("marginfi");
      expect(result?.metadata?.action).toBe("deposit");
    });

    test("should classify SOL deposit into Solend", () => {
      const userAddress = "USER123";
      const depositAmount = 5.0;
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(depositAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "solend", name: "Solend" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_deposit");
      expect(result?.primaryAmount?.token.symbol).toBe("SOL");
      expect(result?.primaryAmount?.amountUi).toBe(depositAmount);
    });

    test("should classify deposit with receipt token (deposit USDC, receive cUSDC)", () => {
      const userAddress = "USER123";
      const depositAmount = 500;
      const receiptAmount = 480; // receipt token has different exchange rate
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createUsdcAmount(depositAmount),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createTokenAmount("cUSDC", 6, receiptAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "kamino-lending", name: "Kamino Lending" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_deposit");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.primaryAmount?.amountUi).toBe(depositAmount);
      expect(result?.metadata?.protocol).toBe("kamino-lending");
    });

    test("should classify deposit into Kamino vault (deposit USDC, receive kUSDC)", () => {
      const userAddress = "USER123";
      const depositAmount = 1000;
      const receiptAmount = 950;
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createUsdcAmount(depositAmount),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createTokenAmount("kUSDC", 6, receiptAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "kamino-vault", name: "Kamino Vault" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_deposit");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.primaryAmount?.amountUi).toBe(depositAmount);
      expect(result?.metadata?.protocol).toBe("kamino-vault");
    });
  });

  describe("token withdrawals", () => {
    test("should classify USDC withdrawal from Marginfi", () => {
      const userAddress = "USER123";
      const withdrawAmount = 1000;
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createUsdcAmount(withdrawAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "marginfi", name: "Marginfi" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_withdraw");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.primaryAmount?.amountUi).toBe(withdrawAmount);
      expect(result?.sender).toBeNull();
      expect(result?.receiver).toBe(userAddress);
      expect(result?.metadata?.action).toBe("withdraw");
    });

    test("should classify withdrawal with receipt token burn (send cUSDC, receive USDC)", () => {
      const userAddress = "USER123";
      const receiptAmount = 480;
      const withdrawAmount = 500;
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createTokenAmount("cUSDC", 6, receiptAmount),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createUsdcAmount(withdrawAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "solend", name: "Solend" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_withdraw");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.primaryAmount?.amountUi).toBe(withdrawAmount);
      expect(result?.metadata?.protocol).toBe("solend");
    });
  });

  describe("should NOT classify as lending", () => {
    test("should return null when no lending protocol", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(100),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no account keys", () => {
      const legs = [
        createMockLeg({
          accountId: "external:USER123",
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(100),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "marginfi", name: "Marginfi" },
        accountKeys: [],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no relevant token movements", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "marginfi", name: "Marginfi" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should prefer non-SOL token as primary for deposit", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createSolAmount(0.01), // small SOL for rent
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createUsdcAmount(1000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "marginfi", name: "Marginfi" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_deposit");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
    });
  });
});
