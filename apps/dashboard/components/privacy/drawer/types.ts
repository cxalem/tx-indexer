import type { WalletLabel } from "@/app/actions/wallet-labels";
import type { useDashboardData } from "@/hooks/use-dashboard-data";
import type { PrivacyCashToken } from "@/lib/privacy/constants";

export type HubTab = "transfer" | "swap";
export type OperationMode = "deposit" | "withdraw";

export type SwapStep =
  | "idle"
  | "initializing"
  | "withdrawing"
  | "waiting_funds"
  | "quoting"
  | "swapping"
  | "confirming_swap"
  | "depositing"
  | "confirming_deposit"
  | "success"
  | "error";

export interface PrivacyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export interface AssetSelectorProps {
  selectedToken: PrivacyCashToken;
  walletBalance: number;
  privateBalance: number;
  mode: OperationMode;
  dashboardBalance: ReturnType<typeof useDashboardData>["balance"];
  privateBalances: Record<PrivacyCashToken, number>;
  isLoadingPrivateBalances?: boolean;
  onTokenSelect: (token: PrivacyCashToken) => void;
}

export interface RecipientSelectorProps {
  recipientAddress: string;
  walletAddress: string | null;
  labelsList: WalletLabel[];
  onRecipientChange: (address: string) => void;
}

export interface SwapState {
  fromToken: PrivacyCashToken;
  toToken: PrivacyCashToken;
  amount: string;
  estimatedOutput: string;
  step: SwapStep;
  error: string | null;
  signature: string | null;
}

export const TOKEN_LOGOS: Record<string, string> = {
  SOL: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  USDC: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  USDT: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
};
