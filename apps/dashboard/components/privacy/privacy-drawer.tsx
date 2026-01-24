"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Shield, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { usePrivacyCash } from "@/hooks/use-privacy-cash";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useWalletLabels } from "@/hooks/use-wallet-labels";
import {
  PRIVACY_CASH_SUPPORTED_TOKENS,
  type PrivacyCashToken,
} from "@/lib/privacy/constants";
import {
  ProcessingOverlay,
  SuccessState,
  ErrorState,
  ModeTabs,
  AssetSelector,
  BalanceDisplay,
  AmountInput,
  RecipientSelector,
  InfoBox,
  type OperationMode,
  type PrivacyDrawerProps,
} from "./drawer";

export function PrivacyDrawer({
  open,
  onOpenChange,
  onSuccess,
}: PrivacyDrawerProps) {
  const { address: walletAddress, status: walletStatus } = useUnifiedWallet();
  const { balance: dashboardBalance } = useDashboardData(walletAddress);
  const { labelsList } = useWalletLabels();
  const {
    privateBalance,
    isLoadingBalance,
    status,
    isProcessing,
    isInitialized,
    signature,
    error,
    initialize,
    shield,
    unshield,
    refreshBalance,
    reset,
  } = usePrivacyCash();

  const [mode, setMode] = useState<OperationMode>("deposit");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState<PrivacyCashToken>("SOL");

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const isConnected = walletStatus === "connected";
  const amountNum = parseFloat(amount) || 0;
  const showResultState = status === "success" || status === "error";

  const tokenConfig = PRIVACY_CASH_SUPPORTED_TOKENS[selectedToken];
  const walletBalance =
    selectedToken === "SOL"
      ? (dashboardBalance?.sol.ui ?? 0)
      : (dashboardBalance?.tokens.find((t) => t.mint === tokenConfig.mint)
          ?.amount.ui ?? 0);

  const privateBalanceAmount = privateBalance?.amount ?? 0;

  useEffect(() => {
    if (open && isConnected && !isInitialized) {
      initialize();
    }
  }, [open, isConnected, isInitialized, initialize]);

  useEffect(() => {
    if (open && isInitialized) {
      refreshBalance(selectedToken);
    }
  }, [open, isInitialized, refreshBalance, selectedToken]);

  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => onSuccessRef.current?.(), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isConnected || isProcessing || amountNum <= 0) return;

      if (mode === "deposit") {
        await shield({ amount: amountNum, token: selectedToken });
      } else {
        if (!recipientAddress) return;
        await unshield({
          amount: amountNum,
          token: selectedToken,
          recipientAddress,
        });
      }
    },
    [
      isConnected,
      isProcessing,
      amountNum,
      mode,
      selectedToken,
      recipientAddress,
      shield,
      unshield,
    ],
  );

  const handleClose = useCallback(() => {
    setAmount("");
    setRecipientAddress(walletAddress || "");
    reset();
    onOpenChange(false);
  }, [walletAddress, reset, onOpenChange]);

  const handleSetMax = useCallback(() => {
    if (mode === "deposit") {
      const maxAmount =
        selectedToken === "SOL"
          ? Math.max(0, walletBalance - 0.01)
          : walletBalance;
      setAmount(String(maxAmount));
    } else {
      setAmount(String(privateBalanceAmount));
    }
  }, [mode, walletBalance, privateBalanceAmount, selectedToken]);

  const handleTokenSelect = useCallback((token: PrivacyCashToken) => {
    setSelectedToken(token);
    setAmount("");
  }, []);

  const handleModeChange = useCallback((newMode: OperationMode) => {
    setMode(newMode);
    setAmount("");
  }, []);

  const insufficientBalance =
    mode === "deposit"
      ? amountNum > walletBalance
      : amountNum > privateBalanceAmount;

  const isFormValid =
    amountNum > 0 &&
    !insufficientBalance &&
    (mode === "deposit" || recipientAddress.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="flex flex-col"
        preventClose={isProcessing}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Shield className="h-4 w-4 text-purple-500" aria-hidden="true" />
            </div>
            private balance
          </SheetTitle>
          <SheetDescription>
            Move funds between your wallet and private balance. Withdrawals
            can&apos;t be linked to your deposits.
          </SheetDescription>
        </SheetHeader>

        {isProcessing && <ProcessingOverlay status={status} mode={mode} />}

        {status === "success" && signature && (
          <SuccessState
            mode={mode}
            amount={amountNum}
            token={selectedToken}
            recipientAddress={recipientAddress}
            signature={signature}
            onClose={handleClose}
          />
        )}

        {status === "error" && (
          <ErrorState error={error} onClose={handleClose} onRetry={reset} />
        )}

        {!showResultState && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 mt-6">
            <div className="space-y-4 flex-1">
              <ModeTabs mode={mode} onModeChange={handleModeChange} />

              <AssetSelector
                selectedToken={selectedToken}
                walletBalance={walletBalance}
                privateBalance={privateBalanceAmount}
                mode={mode}
                dashboardBalance={dashboardBalance}
                onTokenSelect={handleTokenSelect}
              />

              <BalanceDisplay
                walletBalance={walletBalance}
                privateBalance={privateBalanceAmount}
                selectedToken={selectedToken}
                isLoadingBalance={isLoadingBalance}
              />

              <AmountInput
                amount={amount}
                selectedToken={selectedToken}
                insufficientBalance={insufficientBalance}
                mode={mode}
                onAmountChange={setAmount}
                onSetMax={handleSetMax}
              />

              {mode === "withdraw" && (
                <RecipientSelector
                  recipientAddress={recipientAddress}
                  walletAddress={walletAddress}
                  labelsList={labelsList}
                  onRecipientChange={setRecipientAddress}
                />
              )}

              <InfoBox mode={mode} />
            </div>

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
                disabled={!isConnected || isProcessing || !isFormValid}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  isConnected && !isProcessing && isFormValid
                    ? "bg-purple-500 text-white hover:bg-purple-500/90 cursor-pointer"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed",
                )}
              >
                {mode === "deposit" ? (
                  <>
                    <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                    deposit to private balance
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
                    withdraw from private balance
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
