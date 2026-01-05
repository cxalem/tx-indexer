"use client";

import {
  useConnectWallet,
  useDisconnectWallet,
  useWallet,
} from "@solana/react-hooks";
import { useState } from "react";
import { truncate, cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

const CONNECTORS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "wallet-standard:phantom", label: "phantom" },
  { id: "wallet-standard:solflare", label: "solflare" },
  { id: "wallet-standard:backpack", label: "backpack" },
];

export function ConnectWalletButton() {
  const wallet = useWallet();
  const connectWallet = useConnectWallet();
  const disconnectWallet = useDisconnectWallet();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const isConnected = wallet.status === "connected";
  const address = isConnected
    ? wallet.session.account.address.toString()
    : null;

  async function handleConnect(connectorId: string) {
    setError(null);
    try {
      await connectWallet(connectorId);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unable to connect");
    }
  }

  async function handleDisconnect() {
    setError(null);
    try {
      await disconnectWallet();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unable to disconnect");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
          "bg-vibrant-red text-white hover:bg-vibrant-red/90",
          "cursor-pointer min-w-[160px] justify-center",
        )}
      >
        {address ? (
          <span className="font-mono">{truncate(address)}</span>
        ) : (
          <span>connect wallet</span>
        )}
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-full min-w-[240px] rounded-lg border border-neutral-200 bg-white shadow-lg">
          {isConnected ? (
            <div className="p-2 space-y-2">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <p className="text-xs font-medium text-neutral-500 mb-1">
                  connected
                </p>
                <p className="font-mono text-sm text-neutral-900">
                  {truncate(address ?? "")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                disconnect
              </button>
            </div>
          ) : (
            <div className="pb-2">
              <p className="text-xs font-medium text-neutral-500 px-3 py-2">
                choose wallet
              </p>
              <div className="space-y-1">
                {CONNECTORS.map((connector) => (
                  <button
                    key={connector.id}
                    type="button"
                    onClick={() => void handleConnect(connector.id)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors flex justify-between items-center"
                  >
                    <span>{connector.label}</span>
                    <span className="text-neutral-400">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="px-3 pb-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
