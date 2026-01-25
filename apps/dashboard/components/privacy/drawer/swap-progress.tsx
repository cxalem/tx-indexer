"use client";

import { useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SwapStep } from "./types";

interface SwapProgressProps {
  currentStep: SwapStep;
}

// Visual steps shown to user (simplified from actual state machine)
type VisualStep =
  | "preparing"
  | "withdrawing"
  | "quoting"
  | "swapping"
  | "securing";

const STEPS: { key: VisualStep; label: string }[] = [
  { key: "preparing", label: "Preparing" },
  { key: "withdrawing", label: "Withdrawing privately" },
  { key: "quoting", label: "Getting quote" },
  { key: "swapping", label: "Swapping" },
  { key: "securing", label: "Securing your funds" },
];

// Map actual state machine steps to visual steps
function mapToVisualStep(step: SwapStep): VisualStep | null {
  switch (step) {
    case "initializing":
      return "preparing";
    case "withdrawing":
    case "waiting_funds":
      return "withdrawing";
    case "quoting":
      return "quoting";
    case "swapping":
    case "confirming_swap":
      return "swapping";
    case "depositing":
    case "confirming_deposit":
      return "securing";
    default:
      return null;
  }
}

function getStepIndex(currentStep: SwapStep): number {
  const visualStep = mapToVisualStep(currentStep);
  if (!visualStep) return -1;
  return STEPS.findIndex((s) => s.key === visualStep);
}

export function SwapProgress({ currentStep }: SwapProgressProps) {
  const currentIndex = getStepIndex(currentStep);
  const isError = currentStep === "error";
  const isSuccess = currentStep === "success";

  // Track the last active step index for error state
  const lastActiveIndexRef = useRef<number>(0);

  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < STEPS.length) {
      lastActiveIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  // Use last active index for error state
  const effectiveIndex = isError ? lastActiveIndexRef.current : currentIndex;

  return (
    <div className="absolute inset-0 bg-white/95 dark:bg-neutral-900/95 z-10 flex flex-col items-center justify-center p-6">
      <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-8">
        {isError ? "Swap failed" : "Swapping..."}
      </h3>

      {/* Vertical progress rail */}
      <div className="flex flex-col gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = isSuccess || (!isError && effectiveIndex > index);
          const isActive = !isSuccess && !isError && effectiveIndex === index;
          const isErrorStep = isError && index === lastActiveIndexRef.current;
          const isCompletedBeforeError =
            isError && index < lastActiveIndexRef.current;
          const isPending =
            !isCompleted &&
            !isActive &&
            !isErrorStep &&
            !isCompletedBeforeError;
          const isLastStep = index === STEPS.length - 1;

          return (
            <div key={step.key} className="flex items-start gap-4">
              {/* Rail column */}
              <div className="flex flex-col items-center">
                {/* Dot */}
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                    "transition-all duration-500 ease-out",
                    (isCompleted || isCompletedBeforeError) &&
                      "bg-purple-500 border-purple-500",
                    isActive &&
                      "border-purple-500 bg-purple-500/20 animate-pulse",
                    isErrorStep && "bg-red-500 border-red-500 animate-pulse",
                    isPending &&
                      "border-neutral-300 dark:border-neutral-600 bg-transparent",
                  )}
                >
                  {(isCompleted || isCompletedBeforeError) && (
                    <Check
                      className="w-3 h-3 text-white animate-in zoom-in-0 duration-300"
                      strokeWidth={3}
                    />
                  )}
                </div>
                {/* Connecting line (not for last step) */}
                {!isLastStep && (
                  <div className="relative w-0.5 h-9 bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                    {/* Animated fill */}
                    <div
                      className={cn(
                        "absolute inset-x-0 top-0 bg-purple-500",
                        "transition-[height] duration-500 ease-out",
                        isCompleted || isCompletedBeforeError
                          ? "h-full"
                          : "h-0",
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-sm font-medium mt-0.5",
                  "transition-colors duration-300",
                  (isCompleted || isCompletedBeforeError) &&
                    "text-purple-600 dark:text-purple-400",
                  isActive && "text-purple-600 dark:text-purple-400",
                  isErrorStep && "text-red-500",
                  isPending && "text-neutral-400 dark:text-neutral-500",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-8">
        {isError ? "Please try again" : "This takes about a minute"}
      </p>
    </div>
  );
}
