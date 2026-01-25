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
import {
  Shield,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
} from "lucide-react";
import { usePrivacyCash } from "@/hooks/use-privacy-cash";
import { usePrivateSwap } from "@/hooks/use-private-swap";
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
  SwapSuccessState,
  SwapErrorState,
  HubTabs,
  ModeTabs,
  AssetSelector,
  BalanceDisplay,
  AmountInput,
  RecipientSelector,
  InfoBox,
  SwapContent,
  SwapProgress,
  type HubTab,
  type OperationMode,
  type SwapStep,
  type PrivacyDrawerProps,
} from "./drawer";

export function PrivacyDrawer({
  open,
  onOpenChange,
  onSuccess,
}: PrivacyDrawerProps) {
  const { address: walletAddress, status: walletStatus } = useUnifiedWallet();
  const { balance: dashboardBalance, refetch: refetchDashboardBalance } =
    useDashboardData(walletAddress);
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
    getClient,
  } = usePrivacyCash();

  // Hub state
  const [activeTab, setActiveTab] = useState<HubTab>("transfer");

  // Transfer state
  const [mode, setMode] = useState<OperationMode>("deposit");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState<PrivacyCashToken>("USDC");
  const [walletBalanceAdjustment, setWalletBalanceAdjustment] = useState(0);
  const [privateBalanceAdjustment, setPrivateBalanceAdjustment] = useState(0);
  const prevRawWalletBalanceRef = useRef<number | null>(null);
  const prevRawPrivateBalanceRef = useRef<number | null>(null);

  // Swap state
  const [swapFromToken, setSwapFromToken] = useState<PrivacyCashToken>("SOL");
  const [swapToToken, setSwapToToken] = useState<PrivacyCashToken>("USDC");
  const [swapAmount, setSwapAmount] = useState("");

  // Use the real private swap hook
  const {
    state: swapState,
    isSwapping: isPrivateSwapping,
    estimatedOutput: swapEstimatedOutput,
    isLoadingQuote,
    isBelowMinimum,
    minimumAmount,
    executeSwap,
    getQuote,
    reset: resetSwap,
  } = usePrivateSwap();

  // Store values at submission time for use in success effect
  const submittedValuesRef = useRef<{
    amount: number;
    mode: OperationMode;
  } | null>(null);

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const isConnected = walletStatus === "connected";
  const amountNum = parseFloat(amount) || 0;
  const showTransferResultState = status === "success" || status === "error";
  const showSwapResultState =
    swapState.step === "success" || swapState.step === "error";
  const isSwapping = isPrivateSwapping;

  const tokenConfig = PRIVACY_CASH_SUPPORTED_TOKENS[selectedToken];
  const rawWalletBalance =
    selectedToken === "SOL"
      ? (dashboardBalance?.sol.ui ?? 0)
      : (dashboardBalance?.tokens.find((t) => t.mint === tokenConfig.mint)
          ?.amount.ui ?? 0);

  // Apply optimistic adjustments for immediate feedback
  const walletBalance = Math.max(0, rawWalletBalance + walletBalanceAdjustment);

  const rawPrivateBalance = privateBalance?.amount ?? 0;
  const privateBalanceAmount = Math.max(
    0,
    rawPrivateBalance + privateBalanceAdjustment,
  );

  // Calculate private balances for swap
  // For now, we only support SOL -> SPL swaps, so we pass the SOL private balance
  // The privateBalance from usePrivacyCash is for the currently selected token
  // For swap, we always need SOL balance (swapFromToken is always SOL)
  const privateBalances: Record<PrivacyCashToken, number> = {
    SOL: selectedToken === "SOL" ? privateBalanceAmount : 0, // TODO: fetch SOL balance separately if needed
    USDC: selectedToken === "USDC" ? privateBalanceAmount : 0,
    USDT: selectedToken === "USDT" ? privateBalanceAmount : 0,
  };

  // Reset balance adjustments when real balances change
  useEffect(() => {
    if (
      prevRawWalletBalanceRef.current !== null &&
      prevRawWalletBalanceRef.current !== rawWalletBalance
    ) {
      setWalletBalanceAdjustment(0);
    }
    if (
      prevRawPrivateBalanceRef.current !== null &&
      prevRawPrivateBalanceRef.current !== rawPrivateBalance
    ) {
      setPrivateBalanceAdjustment(0);
    }
    prevRawWalletBalanceRef.current = rawWalletBalance;
    prevRawPrivateBalanceRef.current = rawPrivateBalance;
  }, [rawWalletBalance, rawPrivateBalance]);

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
    if (status === "success" && submittedValuesRef.current) {
      const { amount, mode: submittedMode } = submittedValuesRef.current;

      // Apply optimistic balance adjustments for immediate feedback
      if (submittedMode === "deposit") {
        setWalletBalanceAdjustment(-amount);
        setPrivateBalanceAdjustment(amount);
      } else {
        // send mode - private balance goes down
        setPrivateBalanceAdjustment(-amount);
      }

      // Refresh both wallet and private balance after successful operation
      // Use silent mode to avoid overwriting the success status
      refreshBalance(selectedToken, true);
      refetchDashboardBalance();

      const callbackTimer = setTimeout(() => onSuccessRef.current?.(), 2000);
      return () => clearTimeout(callbackTimer);
    }
  }, [status, refreshBalance, refetchDashboardBalance, selectedToken]);

  // Fetch real quote when swap params change
  useEffect(() => {
    if (activeTab !== "swap") return;

    const amount = parseFloat(swapAmount) || 0;
    getQuote(swapFromToken, swapToToken, amount);
  }, [activeTab, swapAmount, swapFromToken, swapToToken, getQuote]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isConnected || isProcessing || amountNum <= 0) return;

      // Store values at submission time for use in success effect
      submittedValuesRef.current = { amount: amountNum, mode };

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

  const handleSwapSubmit = useCallback(async () => {
    if (!isConnected || isSwapping) return;

    const swapAmountNum = parseFloat(swapAmount) || 0;
    if (swapAmountNum <= 0 || isBelowMinimum) return;

    const client = getClient();
    if (!client) {
      console.error("[PrivacyDrawer] Cannot swap: client not available");
      return;
    }

    await executeSwap(client, swapFromToken, swapToToken, swapAmountNum);
  }, [
    isConnected,
    isSwapping,
    swapAmount,
    isBelowMinimum,
    getClient,
    executeSwap,
    swapFromToken,
    swapToToken,
  ]);

  const handleClose = useCallback(() => {
    setAmount("");
    setRecipientAddress(walletAddress || "");
    setWalletBalanceAdjustment(0);
    setPrivateBalanceAdjustment(0);
    setSwapAmount("");
    resetSwap();
    reset();
    onOpenChange(false);
  }, [walletAddress, reset, resetSwap, onOpenChange]);

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

  const handleTabChange = useCallback(
    (tab: HubTab) => {
      setActiveTab(tab);
      if (tab === "swap") {
        // Swap only supports SOL -> SPL, ensure we show SOL balance
        setSelectedToken("SOL");
      } else {
        // Clear swap state when switching away
        setSwapAmount("");
        resetSwap();
      }
    },
    [resetSwap],
  );

  const handleSwapDirection = useCallback(() => {
    setSwapFromToken(swapToToken);
    setSwapToToken(swapFromToken);
    setSwapAmount("");
    // Will trigger getQuote via effect
  }, [swapFromToken, swapToToken]);

  const handleSwapReset = useCallback(() => {
    resetSwap();
  }, [resetSwap]);

  const insufficientBalance =
    mode === "deposit"
      ? amountNum > walletBalance
      : amountNum > privateBalanceAmount;

  const isTransferFormValid =
    amountNum > 0 &&
    !insufficientBalance &&
    (mode === "deposit" || recipientAddress.length > 0);

  const swapAmountNum = parseFloat(swapAmount) || 0;
  const swapInsufficientBalance =
    swapAmountNum > (privateBalances[swapFromToken] ?? 0);
  const isSwapFormValid =
    swapAmountNum > 0 &&
    !swapInsufficientBalance &&
    !isBelowMinimum &&
    swapEstimatedOutput !== "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="flex flex-col"
        preventClose={isProcessing || isSwapping}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Shield className="h-4 w-4 text-purple-500" aria-hidden="true" />
            </div>
            Privacy
          </SheetTitle>
          <SheetDescription>Your funds, hidden from view</SheetDescription>
        </SheetHeader>

        {/* Transfer processing overlay */}
        {activeTab === "transfer" && isProcessing && (
          <ProcessingOverlay status={status} mode={mode} />
        )}

        {/* Swap processing overlay */}
        {activeTab === "swap" && isSwapping && (
          <SwapProgress currentStep={swapState.step} />
        )}

        {/* Transfer success state */}
        {activeTab === "transfer" && status === "success" && signature && (
          <SuccessState
            mode={mode}
            amount={amountNum}
            token={selectedToken}
            recipientAddress={recipientAddress}
            signature={signature}
            walletAddress={walletAddress}
            onClose={handleClose}
          />
        )}

        {/* Transfer error state */}
        {activeTab === "transfer" && status === "error" && (
          <ErrorState error={error} onClose={handleClose} onRetry={reset} />
        )}

        {/* Swap success state */}
        {activeTab === "swap" && swapState.step === "success" && (
          <SwapSuccessState
            fromAmount={swapState.inputAmount}
            fromToken={swapFromToken}
            toAmount={swapState.outputAmount}
            toToken={swapToToken}
            onClose={handleClose}
          />
        )}

        {/* Swap error state */}
        {activeTab === "swap" && swapState.step === "error" && (
          <SwapErrorState
            error={swapState.error}
            onClose={handleClose}
            onRetry={handleSwapReset}
          />
        )}

        {/* Main content */}
        {!showTransferResultState && !showSwapResultState && !isSwapping && (
          <div className="flex flex-col flex-1 mt-6">
            <div className="space-y-4 flex-1">
              {/* Hub tabs */}
              <HubTabs activeTab={activeTab} onTabChange={handleTabChange} />

              {/* Transfer tab content */}
              {activeTab === "transfer" && (
                <form onSubmit={handleSubmit} className="space-y-4">
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

                  <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        !isConnected || isProcessing || !isTransferFormValid
                      }
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                        isConnected && !isProcessing && isTransferFormValid
                          ? "bg-purple-500 text-white hover:bg-purple-500/90 cursor-pointer"
                          : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed",
                      )}
                    >
                      {mode === "deposit" ? (
                        <>
                          <ArrowDownToLine
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Deposit
                        </>
                      ) : (
                        <>
                          <ArrowUpFromLine
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          Withdraw
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Swap tab content */}
              {activeTab === "swap" && (
                <div className="space-y-4">
                  <SwapContent
                    fromToken={swapFromToken}
                    toToken={swapToToken}
                    amount={swapAmount}
                    estimatedOutput={swapEstimatedOutput}
                    privateBalances={privateBalances}
                    isLoadingQuote={isLoadingQuote}
                    isBelowMinimum={isBelowMinimum}
                    minimumAmount={minimumAmount}
                    onFromTokenChange={setSwapFromToken}
                    onToTokenChange={setSwapToToken}
                    onAmountChange={setSwapAmount}
                    onSwapDirection={handleSwapDirection}
                  />

                  <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSwapSubmit}
                      disabled={!isConnected || !isSwapFormValid}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                        isConnected && isSwapFormValid
                          ? "bg-purple-500 text-white hover:bg-purple-500/90 cursor-pointer"
                          : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed",
                      )}
                    >
                      <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                      Swap
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
