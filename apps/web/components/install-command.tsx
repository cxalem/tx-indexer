"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

const packageManagers = [
  { id: "npm", label: "npm", command: "npm install tx-indexer" },
  { id: "pnpm", label: "pnpm", command: "pnpm add tx-indexer" },
  { id: "yarn", label: "yarn", command: "yarn add tx-indexer" },
  { id: "bun", label: "bun", command: "bun add tx-indexer" },
];

export function InstallCommand() {
  const [selectedPm, setSelectedPm] = useState("npm");
  const [copied, setCopied] = useState(false);

  const currentCommand =
    packageManagers.find((pm) => pm.id === selectedPm)?.command || "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl rounded-lg border border-[#E5E5E5] bg-white">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E5E5] px-4 py-2">
        {packageManagers.map((pm) => (
          <button
            key={pm.id}
            onClick={() => setSelectedPm(pm.id)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              selectedPm === pm.id
                ? "bg-vibrant-red text-white"
                : "text-foreground/70 hover:bg-neutral-100"
            }`}
          >
            {pm.label}
          </button>
        ))}
      </div>

      {/* Command */}
      <div className="flex items-center justify-between px-4 py-4">
        <code className="font-mono text-sm text-[#242424]">
          {currentCommand}
        </code>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-8 w-8 text-foreground/70 hover:text-vibrant-red"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
