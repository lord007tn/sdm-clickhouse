import { useId } from "react";
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
  const id = useId();
  const bgId = `${id}-bg`;
  const beamId = `${id}-beam`;
  const leftId = `${id}-left`;
  const midId = `${id}-mid`;
  const rightId = `${id}-right`;

  return (
    <svg
      viewBox="0 0 80 80"
      aria-hidden="true"
      className={cn("size-10 shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bgId} x1="8" y1="6" x2="71" y2="73">
          <stop stopColor="#16344C" />
          <stop offset="1" stopColor="#081521" />
        </linearGradient>
        <linearGradient id={beamId} x1="20" y1="16" x2="58" y2="56">
          <stop stopColor="#79D8FF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#2FA6DE" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id={leftId} x1="17" y1="20" x2="33" y2="52">
          <stop stopColor="#8DE3FF" />
          <stop offset="1" stopColor="#2FA6DE" />
        </linearGradient>
        <linearGradient id={midId} x1="31" y1="16" x2="46" y2="58">
          <stop stopColor="#C7F4FF" />
          <stop offset="1" stopColor="#4FC4F4" />
        </linearGradient>
        <linearGradient id={rightId} x1="45" y1="28" x2="62" y2="52">
          <stop stopColor="#F5C174" />
          <stop offset="1" stopColor="#CC8444" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="72" height="72" rx="18" fill={`url(#${bgId})`} />
      <rect
        x="6.5"
        y="6.5"
        width="67"
        height="67"
        rx="15.5"
        stroke="rgba(198, 234, 255, 0.14)"
      />
      <ellipse
        cx="25"
        cy="18"
        rx="25"
        ry="15"
        fill={`url(#${beamId})`}
        opacity="0.28"
      />
      <path
        d="M17 54.5V38.7237C17 37.659 17.4529 36.6446 18.2467 35.9338L23.2467 31.4563C24.1509 30.6468 25.3219 30.1992 26.5361 30.1992H29C30.6569 30.1992 32 31.5423 32 33.1992V52C32 54.7614 29.7614 57 27 57H19.5C18.1193 57 17 55.8807 17 54.5Z"
        fill={`url(#${leftId})`}
      />
      <path
        d="M30 58.5V33.2997C30 32.3474 30.4027 31.4394 31.1082 30.8072L35.1082 27.2234C36.0188 26.4075 37.1986 25.957 38.421 25.957H41C42.6569 25.957 44 27.3002 44 28.957V55C44 58.3137 41.3137 61 38 61H31.5C30.6716 61 30 60.3284 30 59.5Z"
        fill={`url(#${midId})`}
      />
      <path
        d="M44 52V40.7601C44 39.7177 44.4233 38.72 45.173 37.999L50.173 33.1883C50.9194 32.4705 51.915 32.0703 52.9505 32.0703H56C57.6569 32.0703 59 33.4135 59 35.0703V49C59 51.7614 56.7614 54 54 54H46C44.8954 54 44 53.1046 44 52Z"
        fill={`url(#${rightId})`}
      />
      <path
        d="M18 58C24.854 52.3493 32.3484 49.5239 40.483 49.5239C46.8686 49.5239 53.3743 51.3262 60 54.9307"
        stroke={`url(#${beamId})`}
        strokeLinecap="round"
        strokeWidth="3.5"
        opacity="0.62"
      />
      <circle cx="56" cy="31.5" r="4.25" fill="#E2A45E" />
      <circle cx="56" cy="31.5" r="2.3" fill="#FFF4E6" />
    </svg>
  );
}

export function BrandLogo({
  className,
  markClassName,
  compact = false,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={markClassName} />
      <div className="min-w-0">
        <div className="text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-primary/75">
          SDM
        </div>
        <div
          className={cn(
            "truncate text-base font-semibold tracking-[-0.02em] text-foreground",
            compact && "text-sm",
          )}
        >
          ClickHouse
        </div>
        {!compact ? (
          <div className="truncate text-[0.68rem] text-muted-foreground/75">
            Focused desktop analytics workbench
          </div>
        ) : null}
      </div>
    </div>
  );
}
