import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  compact?: boolean;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      src="/sdm-clickhouse-icon.png"
      alt=""
      aria-hidden="true"
      className={cn("size-10 shrink-0", className)}
      draggable={false}
    />
  );
}

export function BrandLogo({
  className,
  markClassName,
  compact = false,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark
        className={cn(compact ? "size-7" : "size-10", markClassName)}
      />
      <div className="min-w-0">
        {compact ? (
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold tracking-tight text-foreground">
              SDM
            </span>
            <span className="text-[10px] font-medium text-primary/70">
              ClickHouse
            </span>
          </div>
        ) : (
          <>
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-primary/75">
              SDM
            </div>
            <div className="truncate text-base font-semibold tracking-[-0.02em] text-foreground">
              ClickHouse
            </div>
            <div className="truncate text-[0.68rem] text-muted-foreground/75">
              Desktop SQL workbench
            </div>
          </>
        )}
      </div>
    </div>
  );
}
