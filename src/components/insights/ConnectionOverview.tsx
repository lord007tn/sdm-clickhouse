import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  HardDrive,
  Layers3,
  Loader2,
  RefreshCw,
  Server,
  Table2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import type { ClickHouseOverview, OverviewDatum } from "@/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

type ConnectionOverviewProps = {
  overview: ClickHouseOverview | null;
  loading: boolean;
  error: string | null;
  disabled?: boolean;
  onRefresh: () => void;
};

/* ─── Palette ─── */
const C = {
  cyan: "#5CC8E8",
  teal: "#4DB8A4",
  amber: "#E8A94C",
  coral: "#E87C5C",
  violet: "#A48CE0",
  lime: "#8BBF5E",
};
const STORAGE_PALETTE = [C.cyan, C.teal, C.amber, C.coral, C.violet, C.lime];
const ENGINE_PALETTE = [C.amber, C.cyan, C.teal, C.violet, C.lime, C.coral];

function fmt(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function fmtBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let s = value;
  let i = 0;
  while (s >= 1024 && i < u.length - 1) {
    s /= 1024;
    i++;
  }
  return `${s.toFixed(s >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function fmtAgo(value?: string | null) {
  if (!value) return "just now";
  const d = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(d) || d < 0) return "just now";
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/* ─── Building blocks ─── */

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Activity;
  accent?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-card/50 px-3 py-2.5">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={accent ? { background: `linear-gradient(135deg, ${accent}, transparent 60%)` } : undefined}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
            {label}
          </span>
          <div className="mt-1 text-lg font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </div>
          <span className="text-[9px] text-muted-foreground/50">{sub}</span>
        </div>
        <div className="rounded-md border border-border/40 bg-background/40 p-1.5">
          <Icon className="h-3 w-3 text-muted-foreground/50" />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  tag,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  tag?: React.ReactNode;
  icon?: typeof Activity;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col rounded-lg border border-border/50 bg-card/40 ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon className="h-3 w-3 text-muted-foreground/50" /> : null}
          <span className="text-[11px] font-medium text-foreground/90">{title}</span>
        </div>
        {tag}
      </div>
      <div className="flex-1 p-3">{children}</div>
    </div>
  );
}

function PressureBar({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60">{label}</span>
        <span className="text-xs font-bold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border/30">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(percent, value > 0 ? 12 : 0)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function withFill(data: OverviewDatum[], palette: string[]) {
  return data.map((item, i) => ({ ...item, fill: palette[i % palette.length] }));
}

/* ─── Main ─── */

export function ConnectionOverview({
  overview,
  loading,
  error,
  disabled = false,
  onRefresh,
}: ConnectionOverviewProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!overview) return;
    let f2 = 0;
    const f1 = requestAnimationFrame(() => {
      f2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(f1);
      cancelAnimationFrame(f2);
    };
  }, [overview]);

  const storageData = withFill(overview?.storageByDatabase ?? [], STORAGE_PALETTE);
  const engineData = withFill(overview?.tablesByEngine ?? [], ENGINE_PALETTE);
  const queryData = withFill(overview?.activeQueriesByUser ?? [], [...STORAGE_PALETTE].reverse());
  const hottestData = withFill(overview?.hottestTablesByParts ?? [], [...ENGINE_PALETTE].reverse());

  const pTotal = (overview?.activeQueryCount ?? 0) + (overview?.pendingMutationCount ?? 0);
  const qPct = pTotal > 0 ? ((overview?.activeQueryCount ?? 0) / pTotal) * 100 : 0;
  const mPct = pTotal > 0 ? ((overview?.pendingMutationCount ?? 0) / pTotal) * 100 : 0;

  const skel = (cls: string) => <div className={`animate-pulse rounded-lg bg-muted/15 ${cls}`} />;

  return (
    <section className="space-y-2.5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Signals without stealing the editor
          </h2>
          <p className="text-[9px] text-muted-foreground/50">
            Storage · engines · pressure · hottest tables
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-border/40 px-1.5 py-0.5 text-[9px] tabular-nums text-muted-foreground/40">
            {overview ? fmtAgo(overview.generatedAt) : "---"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-foreground"
            disabled={loading || disabled}
            onClick={onRefresh}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[9px] text-amber-400/80">
          {error}
        </div>
      ) : null}

      {!overview && loading ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border/40 bg-muted/10" />
          ))}
        </div>
      ) : null}

      {overview ? (
        <>
          {/* ── 4 stat tiles ── */}
          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
            <Stat label="Footprint" value={fmtBytes(overview.totalBytes)} sub={`${fmt(overview.totalRows)} rows`} icon={HardDrive} accent={C.cyan} />
            <Stat label="Catalog" value={`${overview.tableCount}`} sub={`${overview.databaseCount} databases`} icon={Database} accent={C.teal} />
            <Stat label="Pressure" value={`${overview.activeQueryCount}`} sub={`${overview.pendingMutationCount} mutations`} icon={Activity} accent={C.amber} />
            <Stat label="Parts" value={fmt(overview.activePartCount)} sub="active parts" icon={Layers3} accent={C.violet} />
          </div>

          {/* ── Storage chart — full width ── */}
          <Panel
            title="Storage by database"
            icon={HardDrive}
            tag={
              <span className="rounded-full bg-[#5CC8E8]/10 px-1.5 py-0.5 text-[8px] font-medium text-[#5CC8E8]">
                {storageData.length} DBs
              </span>
            }
          >
            {storageData.length > 0 ? (
              ready ? (
                <ChartContainer className="h-36 w-full" config={{ value: { label: "Bytes", color: C.cyan } }}>
                  <AreaChart data={storageData} margin={{ left: 0, right: 4, top: 6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.cyan} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.cyan} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(218 16% 20%)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={6} style={{ fontSize: 9 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => fmtBytes(Number(v))} width={50} style={{ fontSize: 9 }} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, item) => {
                            const p = item.payload as OverviewDatum;
                            return (
                              <div className="flex min-w-28 items-center justify-between gap-3 text-[10px]">
                                <span>{fmtBytes(Number(value))}</span>
                                <span className="text-muted-foreground">{fmt(p.secondaryValue ?? 0)} rows</span>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Area dataKey="value" type="monotone" stroke={C.cyan} strokeWidth={1.5} fill="url(#sf)" />
                  </AreaChart>
                </ChartContainer>
              ) : skel("h-36")
            ) : (
              <div className="flex h-28 items-center justify-center text-[9px] text-muted-foreground/40">No storage data</div>
            )}
          </Panel>

          {/* ── 2×2 grid: Engine mix · Pressure · Query users · Hottest tables ── */}
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {/* Engine mix */}
            <Panel title="Engine mix" icon={Server}>
              {engineData.length > 0 ? (
                ready ? (
                  <ChartContainer className="h-28 w-full" config={{ value: { label: "Tables", color: C.amber } }}>
                    <BarChart data={engineData} layout="vertical" margin={{ left: 2, right: 4, top: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(218 16% 20%)" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={72} style={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Bar dataKey="value" radius={[999, 999, 999, 999]}>
                        {engineData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : skel("h-28")
              ) : (
                <div className="flex h-20 items-center justify-center text-[9px] text-muted-foreground/40">No engine data</div>
              )}
            </Panel>

            {/* Operational pressure */}
            <Panel title="Operational pressure" icon={Activity}>
              <div className="space-y-2.5">
                <PressureBar label="Query flow" value={overview.activeQueryCount} percent={qPct} color={C.cyan} />
                <PressureBar label="Mutation queue" value={overview.pendingMutationCount} percent={mPct} color={C.amber} />
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <div className="rounded-md border border-border/30 bg-background/30 px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground/40">Server</div>
                    <div className="mt-0.5 text-[11px] font-medium tabular-nums text-foreground">{overview.serverVersion}</div>
                  </div>
                  <div className="rounded-md border border-border/30 bg-background/30 px-2 py-1.5">
                    <div className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground/40">Surface</div>
                    <div className="mt-0.5 text-[11px] font-medium tabular-nums text-foreground">{overview.databaseCount} DB · {overview.tableCount} tbl</div>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Query users donut */}
            <Panel title="Active sessions" icon={Activity}>
              {queryData.length > 0 ? (
                <div className="flex items-center gap-3">
                  {ready ? (
                    <ChartContainer className="h-24 w-24 flex-shrink-0" config={{ value: { label: "Queries", color: C.teal } }}>
                      <PieChart>
                        <Pie data={queryData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="88%" paddingAngle={4}>
                          {queryData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      </PieChart>
                    </ChartContainer>
                  ) : skel("h-24 w-24")}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {queryData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
                          <span className="truncate text-[9px] text-muted-foreground/60">{d.name}</span>
                        </div>
                        <span className="text-[10px] font-semibold tabular-nums text-foreground">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center text-[9px] text-muted-foreground/40">No active queries</div>
              )}
            </Panel>

            {/* Hottest tables */}
            <Panel title="Hottest tables" icon={Table2}>
              {hottestData.length > 0 ? (
                ready ? (
                  <ChartContainer className="h-28 w-full" config={{ value: { label: "Parts", color: C.coral } }}>
                    <BarChart data={hottestData} layout="vertical" margin={{ left: 2, right: 6, top: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(218 16% 20%)" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} style={{ fontSize: 9 }} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, item) => {
                              const p = item.payload as OverviewDatum;
                              return (
                                <div className="flex min-w-28 items-center justify-between gap-3 text-[10px]">
                                  <span>{fmt(Number(value))} parts</span>
                                  <span className="text-muted-foreground">{fmt(p.secondaryValue ?? 0)} rows</span>
                                </div>
                              );
                            }}
                          />
                        }
                      />
                      <Bar dataKey="value" radius={[999, 999, 999, 999]}>
                        {hottestData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : skel("h-28")
              ) : (
                <div className="flex h-20 items-center justify-center text-[9px] text-muted-foreground/40">No part data</div>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </section>
  );
}
