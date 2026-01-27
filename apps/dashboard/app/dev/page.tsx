"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProcessingOverlay } from "@/components/privacy/drawer/processing-overlay";
import { DotLottiePlayer } from "@/components/ui/dot-lottie";
import type { OperationMode } from "@/components/privacy/drawer/types";

type ComponentKey = "processing-overlay" | "dot-lottie";

interface ComponentConfig {
  name: string;
  description: string;
}

const COMPONENTS: Record<ComponentKey, ComponentConfig> = {
  "processing-overlay": {
    name: "Processing Overlay",
    description: "Privacy drawer processing states with Lottie animation",
  },
  "dot-lottie": {
    name: "DotLottie Player",
    description: "Lottie animation player component",
  },
};

const PROCESSING_STATUSES = [
  "initializing",
  "preparing",
  "generating_proof",
  "signing",
  "confirming",
  "success",
  "error",
] as const;

export default function DevPlayground() {
  const router = useRouter();
  const [activeComponent, setActiveComponent] =
    useState<ComponentKey>("processing-overlay");
  const [status, setStatus] = useState<string>("generating_proof");
  const [mode, setMode] = useState<OperationMode>("deposit");
  const [lottieSize, setLottieSize] = useState(100);

  // Redirect in production
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      router.replace("/");
    }
  }, [router]);

  // Don't render in production
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-4">
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Component Playground
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Test and preview components in isolation
        </p>
      </div>

      <div className="flex">
        {/* Sidebar - Component List */}
        <div className="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 min-h-[calc(100vh-73px)]">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
              Components
            </h2>
            <nav className="space-y-1">
              {Object.entries(COMPONENTS).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setActiveComponent(key as ComponentKey)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeComponent === key
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {config.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {COMPONENTS[activeComponent].name}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {COMPONENTS[activeComponent].description}
            </p>
          </div>

          {/* Controls */}
          <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 mb-6">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-4">
              Controls
            </h3>

            {activeComponent === "processing-overlay" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PROCESSING_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                          status === s
                            ? "bg-purple-500 text-white"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                    Mode
                  </label>
                  <div className="flex gap-2">
                    {(["deposit", "withdraw"] as OperationMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                          mode === m
                            ? "bg-purple-500 text-white"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : activeComponent === "dot-lottie" ? (
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  Size: {lottieSize}px
                </label>
                <input
                  type="range"
                  min={50}
                  max={300}
                  value={lottieSize}
                  onChange={(e) => setLottieSize(Number(e.target.value))}
                  className="w-full max-w-xs"
                />
              </div>
            ) : null}
          </div>

          {/* Preview */}
          <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Preview
              </span>
            </div>

            <div className="relative min-h-[400px] flex items-center justify-center">
              {activeComponent === "processing-overlay" ? (
                <div className="relative w-[400px] h-[300px] bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                  <ProcessingOverlay status={status} mode={mode} />
                </div>
              ) : activeComponent === "dot-lottie" ? (
                <div className="flex gap-12">
                  <div className="flex flex-col items-center gap-4">
                    <DotLottiePlayer
                      src="/security-lock-privacy.lottie"
                      loop
                      autoplay
                      width={lottieSize}
                      height={lottieSize}
                    />
                    <span className="text-xs text-neutral-500">Original</span>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <DotLottiePlayer
                      src="/security-lock-privacy-purple.lottie"
                      loop
                      autoplay
                      width={lottieSize}
                      height={lottieSize}
                    />
                    <span className="text-xs text-purple-500 font-medium">
                      Purple (Privacy Hub)
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
