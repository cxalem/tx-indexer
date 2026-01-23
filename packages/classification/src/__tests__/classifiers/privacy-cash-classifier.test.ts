import { describe, test, expect } from "bun:test";
import { PrivacyCashClassifier } from "../../classifiers/privacy-cash-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";
import {
  PRIVACY_CASH_SPL_POOL,
  PRIVACY_CASH_FEE_RECIPIENT,
} from "@tx-indexer/solana/constants/program-ids";

describe("PrivacyCashClassifier", () => {
  const classifier = new PrivacyCashClassifier();

  describe("privacy_deposit (shield)", () => {
    test("should classify SOL deposit/shield transaction", () => {
      const senderAddress = "SENDER123";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.001),
        }),
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_deposit");
      expect(result?.primaryAmount?.amountUi).toBe(1.0);
      expect(result?.primaryAmount?.token.symbol).toBe("SOL");
      expect(result?.sender).toBe(senderAddress);
      expect(result?.receiver).toBeNull();
      expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result?.metadata?.privacy_protocol).toBe("privacy-cash");
      expect(result?.metadata?.privacy_operation).toBe("shield");
      expect(result?.metadata?.token_type).toBe("SOL");
    });

    test("should classify USDC deposit/shield transaction", () => {
      const senderAddress = "SENDER123";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.001),
        }),
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(100.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_deposit");
      expect(result?.primaryAmount?.amountUi).toBe(100.0);
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.metadata?.token_type).toBe("SPL");
      expect(result?.metadata?.token_mint).toBe(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
      expect(result?.metadata?.is_supported_token).toBe(true);
    });

    test("should classify USDT deposit/shield transaction", () => {
      const senderAddress = "SENDER123";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount(
            "USDT",
            6,
            50.0,
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
          ),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_deposit");
      expect(result?.primaryAmount?.token.symbol).toBe("USDT");
      expect(result?.metadata?.is_supported_token).toBe(true);
    });
  });

  describe("privacy_withdraw (unshield)", () => {
    test("should classify SOL withdrawal/unshield transaction", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(0.5),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_withdraw");
      expect(result?.primaryAmount?.amountUi).toBe(0.5);
      expect(result?.primaryAmount?.token.symbol).toBe("SOL");
      expect(result?.receiver).toBe(receiverAddress);
      expect(result?.sender).toBeNull();
      expect(result?.metadata?.privacy_operation).toBe("unshield");
      expect(result?.metadata?.token_type).toBe("SOL");
    });

    test("should classify USDC withdrawal/unshield transaction", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(250.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_withdraw");
      expect(result?.primaryAmount?.amountUi).toBe(250.0);
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.metadata?.token_type).toBe("SPL");
    });

    test("should classify withdrawal with protocol_withdraw role", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createSolAmount(2.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_withdraw");
    });
  });

  describe("edge cases", () => {
    test("should return null when protocol is not privacy-cash", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when protocol is null", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: null,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no external legs (only fees)", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.001),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should handle mixed deposit/withdrawal by selecting larger amount", () => {
      const address1 = "ADDRESS1";
      const address2 = "ADDRESS2";
      const legs = [
        // Small deposit
        createMockLeg({
          accountId: `external:${address1}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.1),
        }),
        // Larger withdrawal - should be primary
        createMockLeg({
          accountId: `external:${address2}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_withdraw");
      expect(result?.primaryAmount?.amountUi).toBe(1.0);
      expect(result?.receiver).toBe(address2);
    });

    test("should include fee amount in metadata when present", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.0025),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.metadata?.fee_amount).toBe(0.0025);
    });

    test("should handle unsupported SPL token with lower confidence", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount(
            "UNKNOWN",
            9,
            100.0,
            "UNKNOWN_MINT_ADDRESS",
          ),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_deposit");
      expect(result?.metadata?.is_supported_token).toBe(false);
      expect(result?.confidence).toBe(0.85); // Lower confidence for unknown token
    });
  });

  describe("counterparty", () => {
    test("should set counterparty to Privacy Cash protocol", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.counterparty).not.toBeNull();
      expect(result?.counterparty?.type).toBe("protocol");
      expect(result?.counterparty?.name).toBe("Privacy Cash");
    });
  });

  describe("pool-based detection (relayer-submitted transactions)", () => {
    test("should detect withdrawal when tokens flow from pool to user (no protocol)", () => {
      const receiverAddress = "USER_WALLET_123";
      const legs = [
        // Pool sends tokens (debit)
        createMockLeg({
          accountId: `external:${PRIVACY_CASH_SPL_POOL}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(2.5),
        }),
        // User receives tokens (credit)
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(1.728446),
        }),
        // Fee recipient gets fee
        createMockLeg({
          accountId: `external:${PRIVACY_CASH_FEE_RECIPIENT}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(0.771554),
        }),
      ];
      // No protocol detected (relayer-submitted tx)
      const tx = createMockTransaction({
        protocol: null,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_withdraw");
      expect(result?.primaryAmount?.amountUi).toBe(1.728446);
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.receiver).toBe(receiverAddress);
      expect(result?.metadata?.privacy_operation).toBe("unshield");
    });

    test("should detect withdrawal when only fee recipient is involved", () => {
      const receiverAddress = "USER_WALLET_123";
      const legs = [
        // Fee recipient sends tokens (acts as pool in some cases)
        createMockLeg({
          accountId: `external:${PRIVACY_CASH_FEE_RECIPIENT}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.5),
        }),
        // User receives tokens
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(0.45),
        }),
      ];
      const tx = createMockTransaction({
        protocol: null,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_withdraw");
      expect(result?.receiver).toBe(receiverAddress);
    });

    test("should not classify regular transfer without pool accounts", () => {
      const senderAddress = "SENDER123";
      const receiverAddress = "RECEIVER456";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: null,
      });

      const result = classifier.classify({ legs, tx });

      // Should return null - this is a regular transfer, not Privacy Cash
      expect(result).toBeNull();
    });

    test("should exclude pool accounts from user legs calculation", () => {
      const receiverAddress = "USER_WALLET_123";
      const legs = [
        // Pool debit should NOT be counted as user debit
        createMockLeg({
          accountId: `external:${PRIVACY_CASH_SPL_POOL}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(100.0),
        }),
        // User credit
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(95.0),
        }),
        // Fee recipient credit should NOT be counted as user credit
        createMockLeg({
          accountId: `external:${PRIVACY_CASH_FEE_RECIPIENT}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(5.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "privacy-cash", name: "Privacy Cash" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("privacy_withdraw");
      // Should be the user's received amount, not the pool's or fee recipient's
      expect(result?.primaryAmount?.amountUi).toBe(95.0);
      expect(result?.receiver).toBe(receiverAddress);
    });
  });
});
