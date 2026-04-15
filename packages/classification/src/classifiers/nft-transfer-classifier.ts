import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import {
  isNftMintProtocolById,
  isDexProtocolById,
  isNftMarketplaceProtocolById,
} from "../protocols/detector";

function isNftLeg(leg: TxLeg): boolean {
  return (
    leg.amount.token.decimals === 0 &&
    leg.amount.amountUi >= 1 &&
    leg.accountId.startsWith("external:")
  );
}

function findNftLegs(legs: TxLeg[]): { credits: TxLeg[]; debits: TxLeg[] } {
  const nftLegs = legs.filter(isNftLeg);
  return {
    credits: nftLegs.filter((l) => l.side === "credit"),
    debits: nftLegs.filter((l) => l.side === "debit"),
  };
}

function findWalletNftLegs(
  legs: TxLeg[],
  walletAddress: string | undefined,
): { walletCredits: TxLeg[]; walletDebits: TxLeg[] } {
  if (!walletAddress) {
    return { walletCredits: [], walletDebits: [] };
  }
  const walletAccountId = `external:${walletAddress}`;
  const nftLegs = legs.filter(isNftLeg);
  return {
    walletCredits: nftLegs.filter(
      (l) => l.side === "credit" && l.accountId === walletAccountId,
    ),
    walletDebits: nftLegs.filter(
      (l) => l.side === "debit" && l.accountId === walletAccountId,
    ),
  };
}

function findPaymentLeg(
  legs: TxLeg[],
  side: "debit" | "credit",
): TxLeg | undefined {
  return legs.find(
    (leg) =>
      leg.side === side &&
      leg.amount.token.decimals > 0 &&
      (leg.role === "sent" || leg.role === "received") &&
      leg.accountId.startsWith("external:"),
  );
}

function findWalletPaymentLeg(
  legs: TxLeg[],
  walletAddress: string | undefined,
  side: "debit" | "credit",
): TxLeg | undefined {
  if (!walletAddress) return undefined;
  const walletAccountId = `external:${walletAddress}`;
  return legs.find(
    (leg) =>
      leg.accountId === walletAccountId &&
      leg.side === side &&
      leg.amount.token.decimals > 0 &&
      (leg.role === "sent" || leg.role === "received"),
  );
}

export class NftTransferClassifier implements Classifier {
  name = "nft-transfer";
  priority = 80;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx, walletAddress } = context;

    // Skip if it's an NFT mint protocol (handled by NftMintClassifier)
    if (isNftMintProtocolById(tx.protocol?.id)) {
      return null;
    }

    // Skip if it's a DEX protocol (handled by SwapClassifier)
    if (isDexProtocolById(tx.protocol?.id)) {
      return null;
    }

    const { credits: nftCredits, debits: nftDebits } = findNftLegs(legs);

    // No NFT movement = not an NFT transaction
    if (nftCredits.length === 0 && nftDebits.length === 0) {
      return null;
    }

    const isMarketplace = isNftMarketplaceProtocolById(tx.protocol?.id);

    // === MARKETPLACE TRANSACTIONS ===
    // For marketplace txs, we need wallet perspective to determine buy vs sell
    if (isMarketplace) {
      const { walletCredits, walletDebits } = findWalletNftLegs(
        legs,
        walletAddress,
      );

      // NFT Purchase: wallet received NFT (credit)
      if (walletCredits.length > 0) {
        const paymentLeg = findPaymentLeg(legs, "debit");
        const primaryNft = walletCredits[0]!;
        const buyer = primaryNft.accountId.replace("external:", "");

        return {
          primaryType: "nft_purchase",
          primaryAmount: primaryNft.amount,
          secondaryAmount: paymentLeg?.amount ?? null,
          sender: null,
          receiver: buyer,
          counterparty: {
            type: "protocol",
            address: tx.protocol?.id ?? "marketplace",
            name: tx.protocol?.name ?? "NFT Marketplace",
          },
          confidence: 0.9,
          isRelevant: true,
          metadata: {
            nft_mint: primaryNft.amount.token.mint,
            nft_name: primaryNft.amount.token.name,
            quantity: walletCredits.length,
            purchase_price: paymentLeg?.amount.amountUi,
            purchase_token: paymentLeg?.amount.token.symbol,
            marketplace: tx.protocol?.id,
          },
        };
      }

      // NFT Sale: wallet sent NFT (debit)
      if (walletDebits.length > 0) {
        const proceedsLeg = findPaymentLeg(legs, "credit");
        const primaryNft = walletDebits[0]!;
        const seller = primaryNft.accountId.replace("external:", "");

        return {
          primaryType: "nft_sale",
          primaryAmount: primaryNft.amount,
          secondaryAmount: proceedsLeg?.amount ?? null,
          sender: seller,
          receiver: null,
          counterparty: {
            type: "protocol",
            address: tx.protocol?.id ?? "marketplace",
            name: tx.protocol?.name ?? "NFT Marketplace",
          },
          confidence: 0.9,
          isRelevant: true,
          metadata: {
            nft_mint: primaryNft.amount.token.mint,
            nft_name: primaryNft.amount.token.name,
            quantity: walletDebits.length,
            sale_price: proceedsLeg?.amount.amountUi,
            sale_token: proceedsLeg?.amount.token.symbol,
            marketplace: tx.protocol?.id,
          },
        };
      }

      // Wallet not directly involved in NFT movement but tx is on marketplace
      // Use SOL/token flow to determine if this is a purchase or sale
      // - Wallet paid SOL → purchase (buying NFT)
      // - Wallet received SOL → sale (selling NFT)
      // Note: On marketplaces like Magic Eden, the NFT may be in escrow,
      // so we might not see a direct debit/credit from the wallet's NFT account
      const walletPaidLeg = findWalletPaymentLeg(legs, walletAddress, "debit");
      const walletReceivedLeg = findWalletPaymentLeg(
        legs,
        walletAddress,
        "credit",
      );

      // Wallet received SOL/tokens on marketplace with NFT movement → this is a SALE
      // The NFT might show as credit to buyer (not debit from seller) due to escrow
      if (
        walletReceivedLeg &&
        (nftDebits.length > 0 || nftCredits.length > 0)
      ) {
        // Use NFT from debits if available, otherwise from credits (escrow case)
        const primaryNft = nftDebits[0] ?? nftCredits[0]!;
        return {
          primaryType: "nft_sale",
          primaryAmount: primaryNft.amount,
          secondaryAmount: walletReceivedLeg.amount,
          sender: walletAddress ?? null,
          receiver: nftCredits[0]?.accountId.replace("external:", "") ?? null,
          counterparty: {
            type: "protocol",
            address: tx.protocol?.id ?? "marketplace",
            name: tx.protocol?.name ?? "NFT Marketplace",
          },
          confidence: 0.85, // Good confidence based on SOL flow
          isRelevant: true,
          metadata: {
            nft_mint: primaryNft.amount.token.mint,
            nft_name: primaryNft.amount.token.name,
            quantity: nftDebits.length || nftCredits.length,
            sale_price: walletReceivedLeg.amount.amountUi,
            sale_token: walletReceivedLeg.amount.token.symbol,
            marketplace: tx.protocol?.id,
          },
        };
      }

      // Wallet paid SOL/tokens on marketplace with NFT movement → this is a PURCHASE
      if (walletPaidLeg && (nftCredits.length > 0 || nftDebits.length > 0)) {
        // Use NFT from credits if available, otherwise from debits
        const primaryNft = nftCredits[0] ?? nftDebits[0]!;
        return {
          primaryType: "nft_purchase",
          primaryAmount: primaryNft.amount,
          secondaryAmount: walletPaidLeg.amount,
          sender: nftDebits[0]?.accountId.replace("external:", "") ?? null,
          receiver: walletAddress ?? null,
          counterparty: {
            type: "protocol",
            address: tx.protocol?.id ?? "marketplace",
            name: tx.protocol?.name ?? "NFT Marketplace",
          },
          confidence: 0.85, // Good confidence based on SOL flow
          isRelevant: true,
          metadata: {
            nft_mint: primaryNft.amount.token.mint,
            nft_name: primaryNft.amount.token.name,
            quantity: nftCredits.length || nftDebits.length,
            purchase_price: walletPaidLeg.amount.amountUi,
            purchase_token: walletPaidLeg.amount.token.symbol,
            marketplace: tx.protocol?.id,
          },
        };
      }

      // Fallback: No clear wallet involvement, just classify based on NFT movement
      if (nftCredits.length > 0) {
        const primaryNft = nftCredits[0]!;
        return {
          primaryType: "nft_purchase",
          primaryAmount: primaryNft.amount,
          secondaryAmount: null,
          sender: null,
          receiver: primaryNft.accountId.replace("external:", ""),
          counterparty: {
            type: "protocol",
            address: tx.protocol?.id ?? "marketplace",
            name: tx.protocol?.name ?? "NFT Marketplace",
          },
          confidence: 0.7, // Lower confidence when wallet not directly involved
          isRelevant: true,
          metadata: {
            nft_mint: primaryNft.amount.token.mint,
            nft_name: primaryNft.amount.token.name,
            quantity: nftCredits.length,
            marketplace: tx.protocol?.id,
          },
        };
      }

      if (nftDebits.length > 0) {
        const primaryNft = nftDebits[0]!;
        return {
          primaryType: "nft_sale",
          primaryAmount: primaryNft.amount,
          secondaryAmount: null,
          sender: primaryNft.accountId.replace("external:", ""),
          receiver: null,
          counterparty: {
            type: "protocol",
            address: tx.protocol?.id ?? "marketplace",
            name: tx.protocol?.name ?? "NFT Marketplace",
          },
          confidence: 0.7, // Lower confidence when wallet not directly involved
          isRelevant: true,
          metadata: {
            nft_mint: primaryNft.amount.token.mint,
            nft_name: primaryNft.amount.token.name,
            quantity: nftDebits.length,
            marketplace: tx.protocol?.id,
          },
        };
      }
    }

    // === SIMPLE NFT TRANSFERS (no marketplace) ===

    // When we have both credits and debits (full transfer with both parties visible),
    // determine direction based on walletAddress or default to receive perspective
    if (nftCredits.length > 0 && nftDebits.length > 0) {
      const creditAccount = nftCredits[0]!.accountId.replace("external:", "");
      const debitAccount = nftDebits[0]!.accountId.replace("external:", "");

      // Determine if this is a send or receive based on wallet perspective
      const isSending = walletAddress === debitAccount;

      if (isSending) {
        const primaryNft = nftDebits[0]!;
        return {
          primaryType: "nft_send",
          primaryAmount: primaryNft.amount,
          secondaryAmount: null,
          sender: debitAccount,
          receiver: creditAccount,
          counterparty: {
            type: "unknown",
            address: creditAccount,
            name: `${creditAccount.slice(0, 8)}...`,
          },
          confidence: 0.85,
          isRelevant: true,
          metadata: {
            nft_mint: primaryNft.amount.token.mint,
            nft_name: primaryNft.amount.token.name,
            quantity: nftDebits.length,
          },
        };
      } else {
        // Default to receive perspective
        const primaryNft = nftCredits[0]!;
        return {
          primaryType: "nft_receive",
          primaryAmount: primaryNft.amount,
          secondaryAmount: null,
          sender: debitAccount,
          receiver: creditAccount,
          counterparty: {
            type: "unknown",
            address: debitAccount,
            name: `${debitAccount.slice(0, 8)}...`,
          },
          confidence: 0.85,
          isRelevant: true,
          metadata: {
            nft_mint: primaryNft.amount.token.mint,
            nft_name: primaryNft.amount.token.name,
            quantity: nftCredits.length,
          },
        };
      }
    }

    // NFT Receive: got NFT without visible sender
    if (nftCredits.length > 0 && nftDebits.length === 0) {
      const primaryNft = nftCredits[0]!;
      const receiver = primaryNft.accountId.replace("external:", "");

      return {
        primaryType: "nft_receive",
        primaryAmount: primaryNft.amount,
        secondaryAmount: null,
        sender: null,
        receiver,
        counterparty: null,
        confidence: 0.85,
        isRelevant: true,
        metadata: {
          nft_mint: primaryNft.amount.token.mint,
          nft_name: primaryNft.amount.token.name,
          quantity: nftCredits.length,
        },
      };
    }

    // NFT Send: sent NFT without visible receiver
    if (nftDebits.length > 0 && nftCredits.length === 0) {
      const primaryNft = nftDebits[0]!;
      const sender = primaryNft.accountId.replace("external:", "");

      return {
        primaryType: "nft_send",
        primaryAmount: primaryNft.amount,
        secondaryAmount: null,
        sender,
        receiver: null,
        counterparty: null,
        confidence: 0.85,
        isRelevant: true,
        metadata: {
          nft_mint: primaryNft.amount.token.mint,
          nft_name: primaryNft.amount.token.name,
          quantity: nftDebits.length,
        },
      };
    }

    return null;
  }
}
