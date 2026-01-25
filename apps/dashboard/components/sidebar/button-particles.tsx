"use client";

import { useRef, useEffect, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  baseOpacity: number;
  color: string;
  fadeOut: boolean;
}

const PURPLE_COLORS = [
  "rgba(168, 85, 247, 0.8)", // purple-400
  "rgba(147, 51, 234, 0.8)", // purple-600
  "rgba(192, 132, 252, 0.7)", // purple-300
  "rgba(124, 58, 237, 0.8)", // purple-700
  "rgba(139, 92, 246, 0.8)", // purple-500
  "rgba(233, 213, 255, 0.6)", // purple-100
];

const INITIAL_PARTICLE_COUNT = 12;
const FINAL_PARTICLE_COUNT = 5;
const FADE_DURATION = 1500; // ms

interface ButtonParticlesProps {
  particleCount?: number;
  isActive?: boolean;
  isFadingOut?: boolean;
}

export function ButtonParticles({
  particleCount = INITIAL_PARTICLE_COUNT,
  isActive = true,
  isFadingOut = false,
}: ButtonParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const fadeStartTimeRef = useRef<number | null>(null);
  const hasFadedRef = useRef(false);

  const initParticles = useCallback(
    (width: number, height: number) => {
      particlesRef.current = Array.from({ length: particleCount }, () => {
        const baseOpacity = Math.random() * 0.5 + 0.3;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,
          size: Math.random() * 2 + 1,
          opacity: baseOpacity,
          baseOpacity,
          color:
            PURPLE_COLORS[Math.floor(Math.random() * PURPLE_COLORS.length)]!,
          fadeOut: false,
        };
      });
    },
    [particleCount],
  );

  // Handle fade out transition
  useEffect(() => {
    if (isFadingOut && !hasFadedRef.current) {
      fadeStartTimeRef.current = Date.now();
      hasFadedRef.current = true;

      // Mark excess particles for fade out
      const particlesToRemove =
        particlesRef.current.length - FINAL_PARTICLE_COUNT;
      if (particlesToRemove > 0) {
        // Randomly select particles to fade out
        const indices = particlesRef.current
          .map((_, i) => i)
          .sort(() => Math.random() - 0.5)
          .slice(0, particlesToRemove);

        indices.forEach((i) => {
          if (particlesRef.current[i]) {
            particlesRef.current[i].fadeOut = true;
          }
        });
      }
    }
  }, [isFadingOut]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      if (particlesRef.current.length === 0) {
        initParticles(rect.width, rect.height);
      }
    };

    resizeCanvas();

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const now = Date.now();
      const fadeProgress = fadeStartTimeRef.current
        ? Math.min(1, (now - fadeStartTimeRef.current) / FADE_DURATION)
        : 0;

      // Remove fully faded particles
      if (fadeProgress >= 1) {
        particlesRef.current = particlesRef.current.filter((p) => !p.fadeOut);
      }

      particlesRef.current.forEach((particle) => {
        // Update position (slower movement)
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off walls with some randomness
        if (particle.x <= 0 || particle.x >= rect.width) {
          particle.vx *= -1;
          particle.vx += (Math.random() - 0.5) * 0.02;
        }
        if (particle.y <= 0 || particle.y >= rect.height) {
          particle.vy *= -1;
          particle.vy += (Math.random() - 0.5) * 0.02;
        }

        // Keep within bounds
        particle.x = Math.max(0, Math.min(rect.width, particle.x));
        particle.y = Math.max(0, Math.min(rect.height, particle.y));

        // Add slight drift (reduced)
        particle.vx += (Math.random() - 0.5) * 0.002;
        particle.vy += (Math.random() - 0.5) * 0.002;

        // Clamp velocity (slower)
        const maxVel = 0.12;
        particle.vx = Math.max(-maxVel, Math.min(maxVel, particle.vx));
        particle.vy = Math.max(-maxVel, Math.min(maxVel, particle.vy));

        // Calculate opacity
        let opacity =
          particle.baseOpacity + Math.sin(now * 0.001 + particle.x) * 0.15;

        // Apply fade out for marked particles
        if (particle.fadeOut) {
          opacity *= 1 - fadeProgress;
        }

        particle.opacity = opacity;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color.replace(
          /[\d.]+\)$/,
          `${Math.max(0, particle.opacity)})`,
        );
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [isActive, initParticles]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
