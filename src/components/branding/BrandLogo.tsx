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
    <svg
      viewBox="0 0 80 80"
      aria-hidden="true"
      className={cn("size-10 shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="72" height="72" rx="18" fill="#0E1720" />
      <rect
        x="7.5"
        y="7.5"
        width="65"
        height="65"
        rx="14.5"
        stroke="#E6F7FF"
        strokeOpacity="0.1"
      />
      <ellipse
        cx="31.5"
        cy="50.5"
        rx="14.5"
        ry="3"
        fill="#E6F7FF"
        opacity="0.1"
      />
      <path
        d="M21 49V31C21 28.7909 22.7909 27 25 27H27C29.2091 27 31 28.7909 31 31V49C31 51.2091 29.2091 53 27 53H25C22.7909 53 21 51.2091 21 49Z"
        fill="#21B6E8"
      />
      <path
        d="M35 57V23C35 20.7909 36.7909 19 39 19H41C43.2091 19 45 20.7909 45 23V57C45 59.2091 43.2091 61 41 61H39C36.7909 61 35 59.2091 35 57Z"
        fill="#EAF8FF"
      />
      <path
        d="M49 43V35C49 32.7909 50.7909 31 53 31H55C57.2091 31 59 32.7909 59 35V43C59 45.2091 57.2091 47 55 47H53C50.7909 47 49 45.2091 49 43Z"
        fill="#34D399"
      />
      <path
        d="M19 61H61"
        stroke="#E6F7FF"
        strokeLinecap="round"
        strokeWidth="4"
        opacity="0.22"
      />
      <circle cx="61" cy="26" r="5.5" fill="#F5B84B" />
      <circle cx="61" cy="26" r="2.25" fill="#0E1720" />
    </svg>
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
