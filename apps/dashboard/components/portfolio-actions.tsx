"use client";

import { useState, useEffect, useRef } from "react";
import { MoreHorizontal, Send, ArrowLeftRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioActionsProps {
  onSend?: () => void;
  onTrade?: () => void;
  onEarn?: () => void;
}

export function PortfolioActions({
  onSend = () => console.log("send"),
  onTrade = () => console.log("trade"),
  onEarn = () => console.log("earn"),
}: PortfolioActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="flex items-center gap-2" ref={menuRef}>
      <button
        type="button"
        onClick={onSend}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors",
          "bg-vibrant-red text-white hover:bg-vibrant-red/90",
        )}
      >
        <Send className="h-3.5 w-3.5" />
        send
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "p-1.5 rounded-lg border border-neutral-200 transition-colors",
            "hover:bg-neutral-50 text-neutral-500",
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] rounded-lg border border-neutral-200 bg-white shadow-lg py-1">
            <button
              type="button"
              onClick={() => {
                onTrade();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors"
            >
              <ArrowLeftRight className="h-4 w-4 text-neutral-400" />
              trade
            </button>
            <button
              type="button"
              onClick={() => {
                onEarn();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors"
            >
              <TrendingUp className="h-4 w-4 text-neutral-400" />
              earn
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
