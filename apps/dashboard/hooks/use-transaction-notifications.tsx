"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { ClassifiedTransaction } from "tx-indexer";
import { getTransactionDirection } from "@/lib/transaction-utils";
import { useWalletLabels } from "@/hooks/use-wallet-labels";
import { TransactionToast } from "@/components/transaction-toast";

interface UseTransactionNotificationsOptions {
  walletAddress: string | null;
}

/**
 * Truncates a wallet address for display
 */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Formats the notification content for a transaction
 */
function formatTransactionNotification(
  tx: ClassifiedTransaction,
  walletAddress: string,
  labels: Map<string, string>,
): { title: string; body: string } {
  const { classification } = tx;
  const direction = getTransactionDirection(tx, walletAddress);

  // Determine the counterparty (sender for incoming, receiver for outgoing)
  let counterparty: string | null = null;
  if (direction.direction === "incoming" && classification.sender) {
    counterparty = classification.sender;
  } else if (direction.direction === "outgoing" && classification.receiver) {
    counterparty = classification.receiver;
  }

  // Check if we have a label for the counterparty
  const counterpartyDisplay = counterparty
    ? (labels.get(counterparty) ?? truncateAddress(counterparty))
    : null;

  // Build title based on transaction type
  let title: string;
  const type = classification.primaryType;

  switch (type) {
    case "transfer":
      title =
        direction.direction === "incoming"
          ? "Transfer Received"
          : "Transfer Sent";
      break;
    case "swap":
      title = "Swap Completed";
      break;
    case "airdrop":
      title = "Airdrop Received";
      break;
    case "stake_deposit":
      title = "Stake Deposited";
      break;
    case "stake_withdraw":
      title = "Stake Withdrawn";
      break;
    case "nft_purchase":
      title = "NFT Purchased";
      break;
    case "nft_sale":
      title = "NFT Sold";
      break;
    case "nft_mint":
      title = "NFT Minted";
      break;
    case "bridge_in":
      title = "Bridge Received";
      break;
    case "bridge_out":
      title = "Bridge Sent";
      break;
    default:
      title = "New Transaction";
  }

  // Build body with amount and counterparty
  const parts: string[] = [];

  // Add amount if available
  if (classification.primaryAmount) {
    const { amountUi, token } = classification.primaryAmount;
    const formattedAmount = amountUi.toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
    parts.push(`${formattedAmount} ${token.symbol}`);
  }

  // Add counterparty if available
  if (counterpartyDisplay) {
    const preposition = direction.direction === "incoming" ? "from" : "to";
    parts.push(`${preposition} ${counterpartyDisplay}`);
  }

  const body = parts.join(" ") || "Transaction confirmed";

  return { title, body };
}

/**
 * Sends a browser notification if permission is granted.
 * This is a standalone function to avoid stale closure issues with hooks.
 */
function sendBrowserNotification(
  title: string,
  body: string,
  tag: string,
  detailUrl: string,
): void {
  // Check permission at call time, not at hook initialization time
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag, // Prevents duplicate notifications for same tx
    });

    // Open transaction detail page when notification is clicked
    notification.onclick = () => {
      window.open(detailUrl, "_blank");
      notification.close();
    };
  } catch (error) {
    console.error("[Notifications] Failed to send notification:", error);
  }
}

/**
 * Hook to send notifications (both browser and toast) for new transactions.
 */
export function useTransactionNotifications(
  options: UseTransactionNotificationsOptions,
) {
  const { walletAddress } = options;
  // Use centralized wallet labels hook - shares cache with other components
  const { labels } = useWalletLabels();

  const notifyNewTransactions = useCallback(
    (transactions: ClassifiedTransaction[]) => {
      if (!walletAddress || transactions.length === 0) return;

      for (const tx of transactions) {
        const { title, body } = formatTransactionNotification(
          tx,
          walletAddress,
          labels,
        );

        const directionInfo = getTransactionDirection(tx, walletAddress);
        const detailUrl = `https://itx-indexer.com/indexer/${tx.tx.signature}?add=${walletAddress}`;

        // Show custom toast with transaction details
        toast.custom(
          () => (
            <TransactionToast
              transaction={tx}
              direction={directionInfo.direction}
              title={title}
              body={body}
              walletAddress={walletAddress}
            />
          ),
          {
            duration: 5000,
            className:
              "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-4",
          },
        );

        // Send browser notification - check permission at call time
        // When clicked, open the transaction detail page
        sendBrowserNotification(title, body, tx.tx.signature, detailUrl);
      }
    },
    [walletAddress, labels],
  );

  return {
    notifyNewTransactions,
  };
}
