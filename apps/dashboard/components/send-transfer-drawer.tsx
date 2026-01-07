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
import {
  Send,
  AlertCircle,
  Loader2,
  Tag,
  Check,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { estimateFee, type FeeEstimate } from "@/app/actions/estimate-fee";
import {
  getWalletLabels,
  upsertWalletLabel,
  generateDefaultLabel,
  type WalletLabel,
} from "@/app/actions/wallet-labels";
import { useAuth } from "@/lib/auth";
import {
  useUsdcTransfer,
  type TransferStatus,
} from "@/hooks/use-usdc-transfer";
import {
  isValidSolanaAddress,
  transferAmountSchema,
  transferMemoSchema,
} from "@/lib/validations";

interface SendTransferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// USDC is pegged to USD
const USDC_PRICE = 1.0;

function getStatusMessage(status: TransferStatus): string {
  switch (status) {
    case "preparing":
      return "Preparing transaction...";
    case "signing":
      return "Please sign in your wallet...";
    case "confirming":
      return "Confirming transaction...";
    case "success":
      return "Transfer complete!";
    case "error":
      return "Transfer failed";
    default:
      return "";
  }
}

export function SendTransferDrawer({
  open,
  onOpenChange,
}: SendTransferDrawerProps) {
  const wallet = useWallet();
  const { isAuthenticated } = useAuth();
  const {
    balance: usdcBalance,
    isLoadingBalance,
    transfer,
    status: transferStatus,
    isTransferring,
    signature,
    error: transferError,
    reset: resetTransfer,
  } = useUsdcTransfer();

  const isConnected = wallet.status === "connected";
  const senderAddress = isConnected
    ? wallet.session.account.address.toString()
    : null;

  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState({
    recipient: false,
    amount: false,
  });

  // Fee estimation state
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [isFeeLoading, setIsFeeLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Wallet labels state
  const [savedLabels, setSavedLabels] = useState<WalletLabel[]>([]);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [showLabelPrompt, setShowLabelPrompt] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Load saved labels when drawer opens
  useEffect(() => {
    if (open && isAuthenticated) {
      getWalletLabels().then(setSavedLabels);
    }
  }, [open, isAuthenticated]);

  // Check for existing label when address changes
  useEffect(() => {
    if (!isValidSolanaAddress(recipientAddress) || !isAuthenticated) {
      setCurrentLabel(null);
      return;
    }

    // Check if we have a saved label for this address
    const saved = savedLabels.find((l) => l.address === recipientAddress);
    if (saved) {
      setCurrentLabel(saved.label);
    } else {
      setCurrentLabel(null);
    }
  }, [recipientAddress, savedLabels, isAuthenticated]);

  // Fetch fee estimate when recipient address changes
  useEffect(() => {
    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Reset fee if address is invalid or empty
    if (!isValidSolanaAddress(recipientAddress)) {
      setFeeEstimate(null);
      setIsFeeLoading(false);
      return;
    }

    setIsFeeLoading(true);

    // Debounce the API call
    debounceRef.current = setTimeout(async () => {
      try {
        const estimate = await estimateFee(recipientAddress);
        setFeeEstimate(estimate);
      } catch (error) {
        console.error("Failed to estimate fee:", error);
        setFeeEstimate(null);
      } finally {
        setIsFeeLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [recipientAddress]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter labels for autocomplete
  const filteredLabels = savedLabels.filter(
    (l) =>
      l.label.toLowerCase().includes(recipientAddress.toLowerCase()) ||
      l.address.toLowerCase().includes(recipientAddress.toLowerCase()),
  );

  // Validation
  // Validate recipient address
  const recipientError = (() => {
    if (!touched.recipient) return null;
    if (!recipientAddress) return "Recipient is required";
    if (!isValidSolanaAddress(recipientAddress))
      return "Invalid Solana address";
    return null;
  })();

  // Validate amount with Zod
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

  // Validate memo (optional)
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

  // Calculate totals
  const amountUsd = amountNum * USDC_PRICE;
  const feeUsd = feeEstimate?.feeUsd ?? 0;
  const totalUsd = amountUsd + feeUsd;

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

      // If authenticated and no label exists, prompt for one
      if (isAuthenticated && !currentLabel && !showLabelPrompt) {
        const defaultLabel = await generateDefaultLabel();
        setNewLabel(defaultLabel);
        setShowLabelPrompt(true);
        return;
      }

      // Execute the transfer with optional memo (description)
      const result = await transfer(
        recipientAddress,
        amountNum,
        description || undefined,
      );

      if (result.signature) {
        // Save label if we have one
        if (isAuthenticated && newLabel && !currentLabel) {
          await upsertWalletLabel(recipientAddress, newLabel);
        }
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

  const handleSaveLabel = useCallback(async () => {
    if (!newLabel.trim()) return;

    setIsSavingLabel(true);
    const result = await upsertWalletLabel(recipientAddress, newLabel.trim());
    setIsSavingLabel(false);

    if (result.success) {
      setCurrentLabel(newLabel.trim());
      setShowLabelPrompt(false);
      // Refresh labels
      const labels = await getWalletLabels();
      setSavedLabels(labels);
    }
  }, [recipientAddress, newLabel]);

  const handleSkipLabel = useCallback(() => {
    setShowLabelPrompt(false);
    setNewLabel("");
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleSelectLabel = useCallback((label: WalletLabel) => {
    setRecipientAddress(label.address);
    setCurrentLabel(label.label);
    setShowAutocomplete(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  // Show success/error state
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

        {/* Transfer in progress overlay */}
        {isTransferring && (
          <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-vibrant-red mb-4" />
            <p className="text-sm font-medium text-neutral-700">
              {getStatusMessage(transferStatus)}
            </p>
          </div>
        )}

        {/* Success state */}
        {transferStatus === "success" && signature && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Transfer complete!
            </h3>
            <p className="text-sm text-neutral-500 text-center mb-4">
              {formatUsd(amountNum)} USDC sent to{" "}
              {currentLabel || truncate(recipientAddress)}
            </p>
            <a
              href={`https://itx-indexer.com/indexer/${signature}?add=${senderAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-vibrant-red hover:underline flex items-center gap-1 mb-6"
            >
              View transaction
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 rounded-lg bg-vibrant-red text-white text-sm font-medium hover:bg-vibrant-red/90 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Error state */}
        {transferStatus === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Transfer failed
            </h3>
            <p className="text-sm text-neutral-500 text-center mb-6">
              {transferError || "Something went wrong. Please try again."}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={resetTransfer}
                className="px-4 py-2.5 rounded-lg bg-vibrant-red text-white text-sm font-medium hover:bg-vibrant-red/90 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        {!showResultState && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 mt-6">
            <div className="space-y-4 flex-1">
              {/* From address (read-only) */}
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">
                  from
                </label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 bg-neutral-50 font-mono text-sm text-neutral-500">
                  {senderAddress ? truncate(senderAddress) : "not connected"}
                </div>
              </div>

              {/* Recipient address */}
              <div className="relative" ref={autocompleteRef}>
                <label className="text-xs text-neutral-500 mb-1 block">
                  to
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => {
                      setRecipientAddress(e.target.value);
                      setCurrentLabel(null);
                      if (e.target.value && savedLabels.length > 0) {
                        setShowAutocomplete(true);
                      }
                    }}
                    onFocus={() => {
                      if (recipientAddress && savedLabels.length > 0) {
                        setShowAutocomplete(true);
                      }
                    }}
                    onBlur={() =>
                      setTouched((t) => ({ ...t, recipient: true }))
                    }
                    placeholder={
                      savedLabels.length > 0
                        ? "Enter address or search saved contacts"
                        : "Enter recipient address"
                    }
                    className={cn(
                      "w-full px-3 py-2.5 rounded-lg border bg-white font-mono text-sm transition-colors",
                      "focus:outline-none focus:border-vibrant-red",
                      recipientError ? "border-red-400" : "border-neutral-200",
                    )}
                  />
                  {currentLabel && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">
                      <Tag className="h-3 w-3" />
                      {currentLabel}
                    </div>
                  )}
                </div>

                {/* Autocomplete dropdown */}
                {showAutocomplete && filteredLabels.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredLabels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => handleSelectLabel(label)}
                        className="w-full px-3 py-2 text-left hover:bg-neutral-50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">{label.label}</p>
                          <p className="text-xs text-neutral-500 font-mono">
                            {truncate(label.address)}
                          </p>
                        </div>
                        <Tag className="h-3 w-3 text-neutral-400" />
                      </button>
                    ))}
                  </div>
                )}

                {recipientError && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {recipientError}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-neutral-500">amount</label>
                  <span
                    className={cn(
                      "text-xs",
                      insufficientBalance ? "text-red-500" : "text-neutral-500",
                    )}
                  >
                    {isLoadingBalance ? (
                      <Loader2 className="h-3 w-3 animate-spin inline" />
                    ) : (
                      <>
                        balance:{" "}
                        <span className="font-mono">
                          {formatUsd(
                            amountNum > 0
                              ? currentBalance - amountNum
                              : currentBalance,
                          )}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-neutral-400 font-medium">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      // Only allow numbers and decimal point
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setAmount(value);
                      }
                    }}
                    onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                    placeholder="0.00"
                    className={cn(
                      "w-full pl-10 pr-16 py-4 rounded-lg border bg-white font-mono text-2xl transition-colors",
                      "focus:outline-none focus:border-vibrant-red",
                      amountError ? "border-red-400" : "border-neutral-200",
                    )}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-medium">
                    USDC
                  </div>
                </div>
                <div className="h-5 mt-1">
                  {amountError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {amountError}
                    </p>
                  )}
                </div>
              </div>

              {/* Description (optional) */}
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

              {/* Transaction Summary */}
              {amountNum > 0 && (
                <div className="mt-6 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                  <p className="text-xs text-neutral-500 mb-3">summary</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">amount</span>
                      <span className="font-mono">{formatUsd(amountUsd)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600">
                        fee
                        {feeEstimate?.needsAccountCreation && (
                          <span className="text-neutral-400 text-xs ml-1">
                            (includes account setup)
                          </span>
                        )}
                      </span>
                      <span className="text-neutral-500 flex items-center gap-1">
                        {isFeeLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : feeUsd < 0.01 ? (
                          "less than $0.01"
                        ) : (
                          <span className="font-mono">{formatUsd(feeUsd)}</span>
                        )}
                      </span>
                    </div>
                    <div className="border-t border-neutral-200 pt-2 mt-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-neutral-900">total</span>
                        <span className="font-mono text-neutral-900">
                          {formatUsd(totalUsd)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Label prompt */}
            {showLabelPrompt && (
              <div className="mt-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-neutral-500" />
                  <p className="text-sm font-medium text-neutral-700">
                    save this contact?
                  </p>
                </div>
                <p className="text-xs text-neutral-500 mb-3">
                  Add a label to easily find this address next time
                </p>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., alice, rent, savings"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm mb-3 focus:outline-none focus:border-vibrant-red"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSkipLabel}
                    className="flex-1 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    skip
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLabel}
                    disabled={!newLabel.trim() || isSavingLabel}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-center gap-1",
                      newLabel.trim()
                        ? "bg-vibrant-red text-white hover:bg-vibrant-red/90"
                        : "bg-neutral-200 text-neutral-400 cursor-not-allowed",
                    )}
                  >
                    {isSavingLabel ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    save & send
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={handleCancel}
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
