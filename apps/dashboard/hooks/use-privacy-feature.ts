"use client";

/**
 * Privacy Feature Flag Hook
 *
 * Manages the enabled/disabled state of privacy features.
 * State is persisted to localStorage so it survives page refreshes.
 * Uses custom events for cross-component synchronization.
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const { isEnabled, toggle, isLoaded } = usePrivacyFeature();
 *
 *   if (!isLoaded) return <Skeleton />;
 *
 *   return (
 *     <Switch
 *       checked={isEnabled}
 *       onChange={toggle}
 *       label="Enable Privacy Features"
 *     />
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { STORAGE_KEY_PRIVACY_ENABLED } from "@/lib/privacy/constants";

// =============================================================================
// Types
// =============================================================================

/** Animation trigger direction */
export type PrivacyAnimationTrigger = "enter" | "exit" | null;

/**
 * Return type of usePrivacyFeature hook.
 */
export interface UsePrivacyFeatureReturn {
  /** Whether privacy features are currently enabled */
  isEnabled: boolean;
  /** Whether the initial state has been loaded from storage */
  isLoaded: boolean;
  /** Animation trigger - 'enter' when enabling, 'exit' when disabling, null otherwise */
  animationTrigger: PrivacyAnimationTrigger;
  /** Whether animation is currently in progress (disable toggle during this) */
  isAnimating: boolean;
  /** Enable privacy features */
  enable: () => void;
  /** Disable privacy features */
  disable: () => void;
  /** Toggle privacy features on/off */
  toggle: () => void;
  /** Clear the animation trigger (call after animation completes) */
  clearAnimation: () => void;
}

// =============================================================================
// Custom Event for Cross-Component Sync
// =============================================================================

const PRIVACY_CHANGE_EVENT = "privacy-feature-changed";
const PRIVACY_ANIMATION_CLEAR_EVENT = "privacy-animation-clear";

interface PrivacyChangeEventDetail {
  enabled: boolean;
  animate: boolean;
}

function emitPrivacyChange(enabled: boolean, animate: boolean) {
  if (typeof window === "undefined") return;
  // Use setTimeout to emit event outside of React's render cycle
  // This prevents "Cannot update a component while rendering" errors
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent<PrivacyChangeEventDetail>(PRIVACY_CHANGE_EVENT, {
        detail: { enabled, animate },
      }),
    );
  }, 0);
}

function emitAnimationClear() {
  if (typeof window === "undefined") return;
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(PRIVACY_ANIMATION_CLEAR_EVENT));
  }, 0);
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing privacy feature flag state.
 *
 * The state is persisted to localStorage, making it survive page refreshes
 * and browser sessions. The hook handles SSR gracefully by only accessing
 * localStorage after hydration.
 *
 * Cross-component synchronization is achieved via custom events, so when
 * the settings page toggles privacy, the sidebar updates immediately.
 *
 * @returns UsePrivacyFeatureReturn
 */
export function usePrivacyFeature(): UsePrivacyFeatureReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [animationTrigger, setAnimationTrigger] =
    useState<PrivacyAnimationTrigger>(null);

  // Track if this is the initial load (to prevent animation on page load)
  const isInitialLoadRef = useRef(true);

  // Load initial state from localStorage after hydration
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PRIVACY_ENABLED);
      if (stored !== null) {
        setIsEnabled(stored === "true");
      }
    } catch {
      // localStorage not available (SSR, private browsing, etc.)
    }
    setIsLoaded(true);
    // Mark initial load as complete after a short delay
    setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 100);
  }, []);

  // Listen for privacy change events from other components
  useEffect(() => {
    function handlePrivacyChange(event: Event) {
      const customEvent = event as CustomEvent<PrivacyChangeEventDetail>;
      const { enabled, animate } = customEvent.detail;

      setIsEnabled(enabled);
      if (animate && !isInitialLoadRef.current) {
        setAnimationTrigger(enabled ? "enter" : "exit");
      }
    }

    function handleAnimationClear() {
      setAnimationTrigger(null);
    }

    window.addEventListener(PRIVACY_CHANGE_EVENT, handlePrivacyChange);
    window.addEventListener(
      PRIVACY_ANIMATION_CLEAR_EVENT,
      handleAnimationClear,
    );
    return () => {
      window.removeEventListener(PRIVACY_CHANGE_EVENT, handlePrivacyChange);
      window.removeEventListener(
        PRIVACY_ANIMATION_CLEAR_EVENT,
        handleAnimationClear,
      );
    };
  }, []);

  // Persist state changes to localStorage
  const persistState = useCallback((enabled: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY_PRIVACY_ENABLED, String(enabled));
    } catch {
      // localStorage not available
    }
  }, []);

  const enable = useCallback(() => {
    setIsEnabled(true);
    persistState(true);
    if (!isInitialLoadRef.current) {
      setAnimationTrigger("enter");
    }
    emitPrivacyChange(true, true);
  }, [persistState]);

  const disable = useCallback(() => {
    setIsEnabled(false);
    persistState(false);
    if (!isInitialLoadRef.current) {
      setAnimationTrigger("exit");
    }
    emitPrivacyChange(false, true);
  }, [persistState]);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      persistState(next);
      if (!isInitialLoadRef.current) {
        setAnimationTrigger(next ? "enter" : "exit");
      }
      emitPrivacyChange(next, true);
      return next;
    });
  }, [persistState]);

  const clearAnimation = useCallback(() => {
    setAnimationTrigger(null);
    emitAnimationClear();
  }, []);

  // isAnimating is true whenever animationTrigger is set
  const isAnimating = animationTrigger !== null;

  return {
    isEnabled,
    isLoaded,
    animationTrigger,
    isAnimating,
    enable,
    disable,
    toggle,
    clearAnimation,
  };
}
