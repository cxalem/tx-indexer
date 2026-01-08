"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/react-hooks";
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
  getWalletLabels,
  upsertWalletLabel,
  generateDefaultLabel,
  type WalletLabel,
} from "@/app/actions/wallet-labels";
import { useAuth } from "@/lib/auth";
import { useReauth } from "@/hooks/use-reauth";
import { useUsdcTransfer } from "@/hooks/use-usdc-transfer";
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

interface SendTransferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferSuccess?: () => void;
  usdcBalance?: number | null;
}

const USDC_PRICE = 1.0;

export function SendTransferDrawer({
  open,
  onOpenChange,
  onTransferSuccess,
  usdcBalance: externalUsdcBalance,
}: SendTransferDrawerProps) {
  const wallet = useWallet();
  const { isAuthenticated } = useAuth();
  const {
    needsReauth,
    isReauthenticating,
    canReauth,
    error: reauthError,
    reauth,
    clearError: clearReauthError,
  } = useReauth();
  const {
    balance: hookUsdcBalance,
    isLoadingBalance,
    transfer,
    status: transferStatus,
    isTransferring,
    signature,
    error: transferError,
    reset: resetTransfer,
  } = useUsdcTransfer();

  const usdcBalance = externalUsdcBalance ?? hookUsdcBalance;
  const [showSignInForLabels, setShowSignInForLabels] = useState(false);

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

  const isConnected = wallet.status === "connected";
  const senderAddress = isConnected
    ? wallet.session.account.address.toString()
    : null;

  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState({ recipient: false, amount: false });

  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [isFeeLoading, setIsFeeLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [savedLabels, setSavedLabels] = useState<WalletLabel[]>([]);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [showLabelPrompt, setShowLabelPrompt] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  useEffect(() => {
    if (open && isAuthenticated) {
      getWalletLabels().then(setSavedLabels);
    }
  }, [open, isAuthenticated]);

  useEffect(() => {
    if (!isValidSolanaAddress(recipientAddress) || !isAuthenticated) {
      setCurrentLabel(null);
      return;
    }
    const saved = savedLabels.find((l) => l.address === recipientAddress);
    setCurrentLabel(saved?.label ?? null);
  }, [recipientAddress, savedLabels, isAuthenticated]);

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
  const currentBalance = usdcBalance ?? 0;
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

  const amountUsd = amountNum * USDC_PRICE;

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
      getWalletLabels().then(setSavedLabels);
    }
  }, [reauth, clearReauthError]);

  const handleSaveLabel = useCallback(async () => {
    if (!newLabel.trim()) return;

    setIsSavingLabel(true);
    const result = await upsertWalletLabel(recipientAddress, newLabel.trim());
    setIsSavingLabel(false);

    if (result.success) {
      setCurrentLabel(newLabel.trim());
      setShowLabelPrompt(false);
      const labels = await getWalletLabels();
      setSavedLabels(labels);
    }
  }, [recipientAddress, newLabel]);

  const handleSelectLabel = useCallback((label: WalletLabel) => {
    setRecipientAddress(label.address);
    setCurrentLabel(label.label);
    setShowAutocomplete(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const showResultState =
    transferStatus === "success" || transferStatus === "error";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-vibrant-red/10">
              <Send className="h-4 w-4 text-vibrant-red" />
            </div>
            send
          </SheetTitle>
          <SheetDescription>Transfer USDC to any address</SheetDescription>
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
                <label className="text-xs text-neutral-500 mb-1 block">
                  from
                </label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 bg-neutral-50 font-mono text-sm text-neutral-500">
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
              />

              <div>
                <label className="text-xs text-neutral-500 mb-1 block">
                  note{" "}
                  <span className="text-neutral-400">
                    (optional, max 256 chars)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this transfer for?"
                  rows={2}
                  maxLength={256}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-lg border bg-white text-sm transition-colors resize-none",
                    "focus:outline-none focus:border-vibrant-red",
                    memoError ? "border-red-300" : "border-neutral-200",
                  )}
                />
                {memoError && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {memoError}
                  </p>
                )}
              </div>

              {amountNum > 0 && (
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

            <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={!isConnected || isTransferring}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  isConnected && !isTransferring
                    ? "bg-vibrant-red text-white hover:bg-vibrant-red/90"
                    : "bg-neutral-200 text-neutral-400 cursor-not-allowed",
                )}
              >
                <Send className="h-4 w-4" />
                {showLabelPrompt ? "send without saving" : "send"}
              </button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
