import { describe, test, expect } from "bun:test";
import { BridgeClassifier } from "../../classifiers/bridge-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createNftAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("BridgeClassifier", () => {
  const classifier = new BridgeClassifier();

  describe("bridge_in (receiving from bridge)", () => {
    test("should classify DeGods bridge in transaction", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.02),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("DeGod #1234"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "degods-bridge", name: "DeGods Bridge" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("bridge_in");
      expect(result?.primaryAmount?.token.name).toBe("DeGod #1234");
      expect(result?.receiver).toBe(receiverAddress);
      expect(result?.confidence).toBe(0.9);
      expect(result?.metadata?.bridge_protocol).toBe("degods-bridge");
    });

    test("should classify Wormhole bridge in transaction", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.001),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("WETH", 8, 1.5),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "wormhole", name: "Wormhole" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("bridge_in");
      expect(result?.metadata?.bridge_protocol).toBe("wormhole");
    });

    test("should classify deBridge bridge in transaction", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createTokenAmount("USDC", 6, 1000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "debridge", name: "deBridge" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("bridge_in");
    });

    test("should classify Allbridge bridge in transaction", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(5.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "allbridge", name: "Allbridge" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("bridge_in");
    });
  });

  describe("bridge_out (sending to bridge)", () => {
    test("should classify bridge out transaction", () => {
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
          amount: createTokenAmount("USDC", 6, 500),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "wormhole", name: "Wormhole" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("bridge_out");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.sender).toBe(senderAddress);
    });

    test("should classify NFT bridge out transaction", () => {
      const senderAddress = "SENDER123";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.02),
        }),
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createNftAmount("DeGod #5678"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "degods-bridge", name: "DeGods Bridge" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("bridge_out");
    });
  });

  describe("should NOT classify as bridge", () => {
    test("should return null when no bridge protocol", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("USDC", 6, 100),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no token movement", () => {
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
        protocol: { id: "wormhole", name: "Wormhole" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});
