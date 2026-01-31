"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useWalletLabels } from "@/hooks/use-wallet-labels";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn, truncate } from "@/lib/utils";
import { Send, AlertCircle } from "lucide-react";
import { estimateFee, type FeeEstimate } from "@/app/actions/estimate-fee";
import {
  upsertWalletLabel,
  generateDefaultLabel,
} from "@/app/actions/wallet-labels";
import { useAuth } from "@/lib/auth";
import { useReauth } from "@/hooks/use-reauth";
import { useTokenTransfer } from "@/hooks/use-token-transfer";
import {
  isValidSolanaAddress,
  transferAmountSchema,
  transferMemoSchema,
} from "@/lib/validations";

import {
  TransferringOverlay,
  TransferSuccess,
  TransferError,
} from "./transfer-states";
import { RecipientInput } from "./recipient-input";
import { AmountInput } from "./amount-input";
import { TransferSummary } from "./transfer-summary";
import { LabelPrompt, SignInPrompt } from "./label-prompt";
import { TokenSelector, type SendableToken } from "./token-selector";

// Default to USDC
const DEFAULT_TOKEN: SendableToken = {
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  logoURI:
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  balance: 0,
  price: 1.0,
};

interface SendTransferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferSuccess?: () => void;
  /** Available tokens to send (with balances) */
  tokens?: SendableToken[];
  /** Initial token to select (by mint address) */
  initialTokenMint?: string | null;
}

export function SendTransferDrawer({
  open,
  onOpenChange,
  onTransferSuccess,
  tokens: externalTokens,
  initialTokenMint,
}: SendTransferDrawerProps) {
  const {
    status: walletStatus,
    address: walletAddress,
    connectionType,
  } = useUnifiedWallet();
  const { isAuthenticated } = useAuth();
  const isMobileDeepLink = connectionType === "mobile";
  const {
    needsReauth,
    isReauthenticating,
    canReauth,
    error: reauthError,
    reauth,
    clearError: clearReauthError,
  } = useReauth();

  // Filter tokens with balance > 0
  const availableTokens = useMemo(() => {
    if (!externalTokens || externalTokens.length === 0) {
      return [DEFAULT_TOKEN];
    }
    const withBalance = externalTokens.filter((t) => t.balance > 0);
    return withBalance.length > 0 ? withBalance : [DEFAULT_TOKEN];
  }, [externalTokens]);

  // Selected token state - default to USDC if available
  const [selectedToken, setSelectedToken] = useState<SendableToken>(() => {
    if (initialTokenMint) {
      const found = availableTokens.find((t) => t.mint === initialTokenMint);
      if (found) return found;
    }
    // Prefer USDC as default
    const usdc = availableTokens.find((t) => t.mint === DEFAULT_TOKEN.mint);
    if (usdc) return usdc;
    return availableTokens[0] ?? DEFAULT_TOKEN;
  });

  // Update selected token when initialTokenMint changes (drawer opens with different token)
  useEffect(() => {
    if (open && initialTokenMint) {
      const found = availableTokens.find((t) => t.mint === initialTokenMint);
      if (found) {
        setSelectedToken(found);
      }
    }
  }, [open, initialTokenMint, availableTokens]);

  // Use the generalized token transfer hook
  const {
    balance: hookTokenBalance,
    isLoadingBalance,
    transfer,
    status: transferStatus,
    isTransferring,
    signature,
    error: transferError,
    reset: resetTransfer,
  } = useTokenTransfer(selectedToken.mint, selectedToken.decimals);

  // Use hook balance if available, otherwise use token's balance from props
  const tokenBalance = hookTokenBalance ?? selectedToken.balance;

  const [showSignInForLabels, setShowSignInForLabels] = useState(false);

  // Use centralized wallet labels hook - shares cache with other components
  const {
    labelsList: savedLabels,
    getLabel,
    invalidate: invalidateLabels,
  } = useWalletLabels();

  const prevTransferStatus = useRef(transferStatus);
  useEffect(() => {
    if (
      prevTransferStatus.current !== "success" &&
      transferStatus === "success"
    ) {
      const timer = setTimeout(() => {
        onTransferSuccess?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevTransferStatus.current = transferStatus;
  }, [transferStatus, onTransferSuccess]);

  const isConnected = walletStatus === "connected";
  const senderAddress = walletAddress;

  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState({ recipient: false, amount: false });

  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [isFeeLoading, setIsFeeLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [showLabelPrompt, setShowLabelPrompt] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // Update current label when recipient changes
  useEffect(() => {
    if (!isValidSolanaAddress(recipientAddress) || !isAuthenticated) {
      setCurrentLabel(null);
      return;
    }
    setCurrentLabel(getLabel(recipientAddress));
  }, [recipientAddress, isAuthenticated, getLabel]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isValidSolanaAddress(recipientAddress)) {
      setFeeEstimate(null);
      setIsFeeLoading(false);
      return;
    }

    setIsFeeLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const estimate = await estimateFee(recipientAddress);
        setFeeEstimate(estimate);
      } catch {
        setFeeEstimate(null);
      } finally {
        setIsFeeLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [recipientAddress]);

  const recipientError = (() => {
    if (!touched.recipient) return null;
    if (!recipientAddress) return "Recipient is required";
    if (!isValidSolanaAddress(recipientAddress))
      return "Invalid Solana address";
    return null;
  })();

  const amountNum = parseFloat(amount) || 0;
  const currentBalance = tokenBalance ?? 0;
  const insufficientBalance = amountNum > currentBalance;
  const amountValidation = transferAmountSchema.safeParse(amountNum);
  const amountError = (() => {
    if (!touched.amount) return null;
    if (!amount) return "Amount is required";
    if (!amountValidation.success) {
      return amountValidation.error.issues[0]?.message || "Invalid amount";
    }
    if (insufficientBalance) return "Insufficient balance";
    return null;
  })();

  const memoValidation = transferMemoSchema.safeParse(description);
  const memoError =
    description && !memoValidation.success
      ? memoValidation.error.issues[0]?.message
      : null;

  const isFormValid =
    isValidSolanaAddress(recipientAddress) &&
    amountValidation.success &&
    !insufficientBalance &&
    memoValidation.success;

  // Calculate USD value
  const amountUsd =
    selectedToken.price !== null ? amountNum * selectedToken.price : null;

  const resetForm = useCallback(() => {
    setRecipientAddress("");
    setAmount("");
    setDescription("");
    setTouched({ recipient: false, amount: false });
    setFeeEstimate(null);
    setCurrentLabel(null);
    setShowLabelPrompt(false);
    setNewLabel("");
    setShowAutocomplete(false);
    resetTransfer();
  }, [resetTransfer]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isFormValid || isTransferring) {
        setTouched({ recipient: true, amount: true });
        return;
      }

      if (isAuthenticated && !currentLabel && !showLabelPrompt) {
        const defaultLabel = await generateDefaultLabel();
        setNewLabel(defaultLabel);
        setShowLabelPrompt(true);
        return;
      }

      const result = await transfer(
        recipientAddress,
        amountNum,
        description || undefined,
      );

      if (result.signature && isAuthenticated && newLabel && !currentLabel) {
        await upsertWalletLabel(recipientAddress, newLabel);
      }
    },
    [
      isFormValid,
      isTransferring,
      isAuthenticated,
      currentLabel,
      showLabelPrompt,
      recipientAddress,
      amountNum,
      description,
      newLabel,
      transfer,
    ],
  );

  const handleSignInForLabels = useCallback(async () => {
    clearReauthError();
    const success = await reauth();
    if (success) {
      setShowSignInForLabels(false);
      // Invalidate labels cache to refetch after sign in
      await invalidateLabels();
    }
  }, [reauth, clearReauthError, invalidateLabels]);

  const handleSaveLabel = useCallback(async () => {
    if (!newLabel.trim()) return;

    setIsSavingLabel(true);
    const result = await upsertWalletLabel(recipientAddress, newLabel.trim());
    setIsSavingLabel(false);

    if (result.success) {
      setCurrentLabel(newLabel.trim());
      setShowLabelPrompt(false);
      // Invalidate labels cache to refetch with new label
      await invalidateLabels();
    }
  }, [recipientAddress, newLabel, invalidateLabels]);

  const handleSelectLabel = useCallback(
    (label: { address: string; label: string }) => {
      setRecipientAddress(label.address);
      setCurrentLabel(label.label);
      setShowAutocomplete(false);
    },
    [],
  );

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleTokenChange = useCallback((token: SendableToken) => {
    setSelectedToken(token);
    // Reset amount when token changes
    setAmount("");
    setTouched((t) => ({ ...t, amount: false }));
  }, []);

  const showResultState =
    transferStatus === "success" || transferStatus === "error";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-vibrant-red/10">
              <Send className="h-4 w-4 text-vibrant-red" aria-hidden="true" />
            </div>
            send
          </SheetTitle>
          <SheetDescription>
            Transfer {selectedToken.symbol} to any address
          </SheetDescription>
        </SheetHeader>

        {isTransferring && <TransferringOverlay status={transferStatus} />}

        {transferStatus === "success" && signature && (
          <TransferSuccess
            amount={amountNum}
            recipientLabel={currentLabel}
            recipientAddress={recipientAddress}
            signature={signature}
            senderAddress={senderAddress}
            onClose={handleClose}
            tokenSymbol={selectedToken.symbol}
          />
        )}

        {transferStatus === "error" && (
          <TransferError
            error={transferError}
            onClose={handleClose}
            onRetry={resetTransfer}
          />
        )}

        {!showResultState && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 mt-6">
            <div className="space-y-4 flex-1">
              <div>
                <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
                  from
                </label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-mono text-sm text-neutral-500 dark:text-neutral-400">
                  {senderAddress ? truncate(senderAddress) : "not connected"}
                </div>
              </div>

              <RecipientInput
                value={recipientAddress}
                onChange={(val) => {
                  setRecipientAddress(val);
                  setCurrentLabel(null);
                }}
                onBlur={() => setTouched((t) => ({ ...t, recipient: true }))}
                error={recipientError}
                currentLabel={currentLabel}
                savedLabels={savedLabels}
                showAutocomplete={showAutocomplete}
                onShowAutocomplete={setShowAutocomplete}
                onSelectLabel={handleSelectLabel}
                onClear={() => {
                  setRecipientAddress("");
                  setCurrentLabel(null);
                }}
                needsReauth={needsReauth}
                showSignInPrompt={showSignInForLabels}
                onShowSignInPrompt={() => setShowSignInForLabels(true)}
              />

              <AmountInput
                value={amount}
                onChange={setAmount}
                onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                error={amountError}
                balance={currentBalance}
                isLoadingBalance={isLoadingBalance}
                insufficientBalance={insufficientBalance}
                tokenSymbol={selectedToken.symbol}
                tokenDecimals={selectedToken.decimals}
                tokenSelector={
                  <TokenSelector
                    tokens={availableTokens}
                    selectedToken={selectedToken}
                    onSelectToken={handleTokenChange}
                    disabled={isTransferring}
                  />
                }
              />

              <div>
                <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
                  note{" "}
                  <span className="text-neutral-400 dark:text-neutral-500">
                    (optional, max 256 chars)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this transfer for…"
                  name="transfer-memo"
                  autoComplete="off"
                  rows={2}
                  maxLength={256}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 transition-colors resize-none",
                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-vibrant-red focus-visible:border-vibrant-red",
                    memoError
                      ? "border-red-300 dark:border-red-700"
                      : "border-neutral-200 dark:border-neutral-700",
                  )}
                />
                {memoError && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    {memoError}
                  </p>
                )}
              </div>

              {amountNum > 0 && amountUsd !== null && (
                <TransferSummary
                  amountUsd={amountUsd}
                  feeEstimate={feeEstimate}
                  isFeeLoading={isFeeLoading}
                />
              )}
            </div>

            {needsReauth && showSignInForLabels && (
              <SignInPrompt
                error={reauthError}
                isReauthenticating={isReauthenticating}
                canReauth={canReauth}
                onSignIn={handleSignInForLabels}
                onCancel={() => setShowSignInForLabels(false)}
              />
            )}

            {showLabelPrompt && (
              <LabelPrompt
                value={newLabel}
                onChange={setNewLabel}
                onSave={handleSaveLabel}
                onSkip={() => {
                  setShowLabelPrompt(false);
                  setNewLabel("");
                }}
                isSaving={isSavingLabel}
              />
            )}

            {isMobileDeepLink && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mt-4">
                <AlertCircle
                  className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Sending is not yet supported via mobile deep links. Use
                  &quot;Open in wallet browser&quot; for full functionality.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-6 pt-4 pb-4 sm:pb-0 border-t border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={!isConnected || isTransferring || isMobileDeepLink}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  isConnected && !isTransferring && !isMobileDeepLink
                    ? "bg-vibrant-red text-white hover:bg-vibrant-red/90 cursor-pointer"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed",
                )}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {showLabelPrompt ? "send without saving" : "send"}
              </button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
