import { cn } from "@/lib/utils";

interface MapSkeletonProps {
  className?: string;
}

export function MapSkeleton({ className }: MapSkeletonProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border bg-muted/30",
        className
      )}
      aria-label="جاري تحميل الخريطة"
    >
      {/* Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border) / 0.45) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.45) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Fake pins */}
      <div className="absolute inset-0">
        {[
          { top: "18%", left: "22%" },
          { top: "32%", left: "55%" },
          { top: "60%", left: "38%" },
          { top: "52%", left: "72%" },
          { top: "72%", left: "20%" },
          { top: "26%", left: "78%" },
        ].map((p, i) => (
          <div
            key={i}
            className="absolute h-3 w-3 rounded-full bg-primary/70 shadow-sm animate-pulse"
            style={{ top: p.top, left: p.left }}
          />
        ))}
      </div>

      {/* Fake top controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-9 w-24 rounded-md border border-border bg-background/70 backdrop-blur-sm"
          />
        ))}
      </div>

      {/* Fake bottom bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10 h-12 rounded-lg border border-border bg-background/70 backdrop-blur-sm" />

      {/* Center spinner */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
        </div>
      </div>
    </div>
  );
}
