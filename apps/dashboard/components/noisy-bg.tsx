import { cn } from "@/lib/utils";

interface NoisyBackgroundProps {
  contained?: boolean;
  showDots?: boolean;
}

// Static dots with fixed positions (percentages of viewport)
const STATIC_DOTS = [
  { x: 5, y: 12, size: 1.2 },
  { x: 15, y: 8, size: 0.8 },
  { x: 23, y: 45, size: 1.0 },
  { x: 8, y: 67, size: 1.4 },
  { x: 35, y: 23, size: 0.9 },
  { x: 42, y: 78, size: 1.1 },
  { x: 55, y: 15, size: 0.7 },
  { x: 67, y: 34, size: 1.3 },
  { x: 78, y: 56, size: 1.0 },
  { x: 85, y: 12, size: 0.8 },
  { x: 92, y: 45, size: 1.2 },
  { x: 12, y: 89, size: 0.9 },
  { x: 28, y: 72, size: 1.1 },
  { x: 45, y: 91, size: 0.8 },
  { x: 62, y: 67, size: 1.0 },
  { x: 73, y: 82, size: 1.3 },
  { x: 88, y: 73, size: 0.7 },
  { x: 95, y: 28, size: 1.1 },
  { x: 18, y: 34, size: 0.9 },
  { x: 33, y: 56, size: 1.2 },
  { x: 48, y: 42, size: 0.8 },
  { x: 58, y: 88, size: 1.0 },
  { x: 72, y: 19, size: 1.4 },
  { x: 82, y: 95, size: 0.9 },
  { x: 3, y: 48, size: 1.1 },
  { x: 25, y: 15, size: 0.8 },
  { x: 38, y: 83, size: 1.0 },
  { x: 52, y: 28, size: 1.2 },
  { x: 65, y: 52, size: 0.7 },
  { x: 77, y: 38, size: 1.3 },
  { x: 89, y: 61, size: 0.9 },
  { x: 7, y: 76, size: 1.1 },
  { x: 19, y: 52, size: 0.8 },
  { x: 31, y: 38, size: 1.0 },
  { x: 44, y: 65, size: 1.2 },
  { x: 56, y: 5, size: 0.9 },
  { x: 68, y: 92, size: 1.1 },
  { x: 81, y: 8, size: 0.8 },
  { x: 93, y: 85, size: 1.0 },
  { x: 11, y: 22, size: 1.3 },
  { x: 22, y: 95, size: 0.7 },
  { x: 36, y: 11, size: 1.1 },
  { x: 49, y: 73, size: 0.9 },
  { x: 61, y: 41, size: 1.2 },
  { x: 74, y: 67, size: 0.8 },
  { x: 86, y: 33, size: 1.0 },
  { x: 97, y: 58, size: 1.1 },
  { x: 14, y: 81, size: 0.9 },
  { x: 27, y: 29, size: 1.3 },
  { x: 41, y: 52, size: 0.8 },
];

export function NoisyBackground({
  contained = false,
  showDots = false,
}: NoisyBackgroundProps) {
  const filterId = contained ? "noise-contained" : "noise";

  return (
    <div
      className={cn(
        "inset-0 pointer-events-none overflow-hidden",
        contained ? "absolute z-0" : "fixed -z-10",
      )}
    >
      <svg className="absolute inset-0 h-full w-full">
        <filter id={filterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter={`url(#${filterId})`}
          className="opacity-40 dark:opacity-20"
        />
      </svg>
      {showDots &&
        STATIC_DOTS.map((dot, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-red-500/60"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: `${dot.size * 2}px`,
              height: `${dot.size * 2}px`,
            }}
          />
        ))}
    </div>
  );
}
