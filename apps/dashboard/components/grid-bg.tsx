import { cn } from "@/lib/utils";

interface GridBackgroundProps {
  className?: string;
  outerGridSize?: number;
  innerGridSize?: number;
  outerOpacity?: number;
  innerOpacity?: number;
  contained?: boolean;
}

export function GridBackground({
  className,
  outerGridSize = 100,
  innerGridSize = 20,
  outerOpacity = 0.04,
  innerOpacity = 0.02,
  contained = false,
}: GridBackgroundProps) {
  return (
    <div
      className={cn(
        "inset-0 text-neutral-900 dark:text-neutral-100",
        contained ? "absolute z-0" : "fixed -z-20",
        className,
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: `${outerGridSize}px ${outerGridSize}px`,
          opacity: outerOpacity,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: `${innerGridSize}px ${innerGridSize}px`,
          opacity: innerOpacity,
        }}
      />
    </div>
  );
}
