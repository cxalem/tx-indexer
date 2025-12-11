/**
 * Type definitions for the web app
 */

export interface Transaction {
  tx: {
    signature: string;
    slot: bigint;
    blockTime: bigint | null;
    err: any | null;
    programIds: string[];
    protocol: {
      id: string;
      name: string;
      iconUrl?: string;
    } | null;
    memo?: string | null;
  };
  classification: {
    primaryType:
      | "transfer"
      | "swap"
      | "nft_purchase"
      | "nft_sale"
      | "nft_mint"
      | "stake_deposit"
      | "stake_withdraw"
      | "token_deposit"
      | "token_withdraw"
      | "airdrop"
      | "bridge_in"
      | "bridge_out"
      | "reward"
      | "fee_only"
      | "other";
    direction: "incoming" | "outgoing" | "self" | "neutral";
    primaryAmount: {
      token: {
        mint: string;
        symbol: string;
        name?: string;
        decimals: number;
      };
      amountRaw: string;
      amountUi: number;
    } | null;
    secondaryAmount?: {
      token: {
        mint: string;
        symbol: string;
        name?: string;
        decimals: number;
      };
      amountRaw: string;
      amountUi: number;
    } | null;
    counterparty: {
      type: "person" | "merchant" | "exchange" | "protocol" | "own_wallet" | "unknown";
      address: string;
      name?: string;
    } | null;
    confidence: number;
    isRelevant?: boolean;
    metadata?: Record<string, any>;
  };
  legs: any[];
}

