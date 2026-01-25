"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PrivacyAnimationTrigger } from "@/hooks/use-privacy-feature";
import { PrivacyParticles3D } from "./privacy-particles-3d";
import { ButtonParticles } from "./button-particles";

interface AnimatedPrivacyButtonProps {
  isEnabled: boolean;
  animationTrigger: PrivacyAnimationTrigger;
  onClick: () => void;
  onAnimationComplete?: () => void;
}

const BUTTON_EXIT_DURATION = 0.3;
const PARTICLE_DELAY = 60;

const buttonVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: {
    opacity: 0,
    scale: 1,
    filter: "blur(3px)",
    transition: {
      duration: BUTTON_EXIT_DURATION,
      ease: "easeOut",
    },
  },
};

export function AnimatedPrivacyButton({
  isEnabled,
  animationTrigger,
  onClick,
  onAnimationComplete,
}: AnimatedPrivacyButtonProps) {
  const [showShine, setShowShine] = useState(false);
  const [showButton, setShowButton] = useState(isEnabled);
  const [isExiting, setIsExiting] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 100, y: 200 });
  const [particleMode, setParticleMode] =
    useState<PrivacyAnimationTrigger>(null);
  const [particlesFadingOut, setParticlesFadingOut] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    if (buttonRef.current && showButton) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  }, [showButton]);

  const handleParticlesComplete = useCallback(() => {
    setParticleMode(null);
    setIsExiting(false);
    onAnimationCompleteRef.current?.();
  }, []);

  useEffect(() => {
    if (animationTrigger === "enter") {
      setShowButton(true);
      setIsExiting(false);
      setParticleMode("enter");
      setParticlesFadingOut(false);

      const shineTimer = setTimeout(() => setShowShine(true), 1400);
      const endTimer = setTimeout(() => {
        setShowShine(false);
        setParticleMode(null);
        setParticlesFadingOut(true);
        onAnimationCompleteRef.current?.();
      }, 1700);

      return () => {
        clearTimeout(shineTimer);
        clearTimeout(endTimer);
      };
    } else if (animationTrigger === "exit") {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setButtonPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }

      setIsExiting(true);

      const particleTimer = setTimeout(() => {
        setParticleMode("exit");
      }, PARTICLE_DELAY);

      const hideTimer = setTimeout(() => {
        setShowButton(false);
      }, BUTTON_EXIT_DURATION * 1000);

      return () => {
        clearTimeout(particleTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [animationTrigger]);

  useEffect(() => {
    if (particleMode === null && animationTrigger === null && !isExiting) {
      setShowButton(isEnabled);
    }
  }, [isEnabled, particleMode, animationTrigger, isExiting]);

  return (
    <div className="relative">
      <PrivacyParticles3D
        mode={particleMode}
        particleCount={100}
        buttonX={buttonPosition.x}
        buttonY={buttonPosition.y}
        onComplete={handleParticlesComplete}
      />

      <AnimatePresence mode="wait">
        {showButton && (
          <motion.button
            ref={buttonRef}
            type="button"
            onClick={isExiting ? undefined : onClick}
            disabled={isExiting}
            variants={buttonVariants}
            initial={animationTrigger === "enter" ? "initial" : false}
            animate={isExiting ? "exit" : "visible"}
            transition={{
              duration: BUTTON_EXIT_DURATION,
              delay: animationTrigger === "enter" ? 0.35 : 0,
              ease: "easeOut",
            }}
            className={cn(
              "relative flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm w-full",
              "bg-purple-600 dark:bg-purple-700 text-white",
              "hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors",
              "overflow-hidden",
              "will-change-[transform,opacity,filter]",
              isExiting
                ? "pointer-events-none cursor-default"
                : "cursor-pointer",
            )}
            style={{
              transformOrigin: "center center",
            }}
          >
            <ButtonParticles
              particleCount={12}
              isActive={!isExiting}
              isFadingOut={particlesFadingOut}
            />
            <Shield className="w-4 h-4 relative z-10" />
            <span className="lowercase relative z-10 font-semibold">
              privacy
            </span>

            {showShine && (
              <span className="absolute inset-0 animate-shine pointer-events-none" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AnimatedPrivacyButtonWrapperProps {
  isEnabled: boolean;
  animationTrigger: PrivacyAnimationTrigger;
  onClick: () => void;
  onAnimationComplete?: () => void;
}

export function AnimatedPrivacyButtonWrapper({
  isEnabled,
  animationTrigger,
  onClick,
  onAnimationComplete,
}: AnimatedPrivacyButtonWrapperProps) {
  const [shouldRender, setShouldRender] = useState(isEnabled);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const isWaitingForAnimationRef = useRef(false);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    if (isEnabled || animationTrigger === "enter") {
      setShouldRender(true);
      setIsCollapsing(false);
      isWaitingForAnimationRef.current = false;
    } else if (animationTrigger === "exit") {
      const collapseTimer = setTimeout(
        () => setIsCollapsing(true),
        BUTTON_EXIT_DURATION * 1000 * 0.5,
      );

      isWaitingForAnimationRef.current = true;

      return () => clearTimeout(collapseTimer);
    }
  }, [isEnabled, animationTrigger]);

  const handleAnimationComplete = useCallback(() => {
    if (isWaitingForAnimationRef.current) {
      setShouldRender(false);
      setIsCollapsing(false);
      isWaitingForAnimationRef.current = false;
    }
    onAnimationCompleteRef.current?.();
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className="relative overflow-visible"
      style={{
        height: isCollapsing ? 0 : "auto",
        marginBottom: isCollapsing ? 0 : 8,
        transition: "height 0.3s ease-out, margin-bottom 0.3s ease-out",
      }}
    >
      <AnimatedPrivacyButton
        isEnabled={isEnabled}
        animationTrigger={animationTrigger}
        onClick={onClick}
        onAnimationComplete={handleAnimationComplete}
      />
    </div>
  );
}
