"use client";

import { useEffect, useRef } from "react";
import { DotLottie } from "@lottiefiles/dotlottie-web";

interface DotLottiePlayerProps {
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  className?: string;
  width?: number;
  height?: number;
}

export function DotLottiePlayer({
  src,
  loop = true,
  autoplay = true,
  speed = 1,
  className,
  width = 120,
  height = 120,
}: DotLottiePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotLottieRef = useRef<DotLottie | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    dotLottieRef.current = new DotLottie({
      canvas,
      src,
      loop,
      autoplay,
      speed,
    });

    return () => {
      dotLottieRef.current?.destroy();
      dotLottieRef.current = null;
    };
  }, [src, loop, autoplay, speed]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
    />
  );
}
