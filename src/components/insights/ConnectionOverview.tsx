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

const STORAGE_COLORS = [
  "#79D8FF",
  "#4FC4F4",
  "#7DDAB7",
  "#F0B56D",
  "#90A7FF",
  "#4D8CBC",
];

const ENGINE_COLORS = [
  "#F0B56D",
  "#79D8FF",
  "#7DDAB7",
  "#C996FF",
  "#5FB9D8",
  "#9ECF7A",
];

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatGeneratedAt(value?: string | null) {
  if (!value) return "just now";
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "just now";
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

/* ────────────────────────── Sub-components ─────────────────────────── */

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
            {value}
          </div>
        </div>
        <div className="flex-shrink-0 rounded-lg border border-border/50 bg-muted/30 p-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/80">
        {detail}
      </div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 text-center text-[10px] text-muted-foreground/60">
      {message}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  badge,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  icon?: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-foreground">{title}</div>
          <div className="text-[10px] leading-relaxed text-muted-foreground/80">
            {subtitle}
          </div>
        </div>
        {badge ??
          (Icon ? (
            <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
          ) : null)}
      </div>
      {children}
    </div>
  );
}

function withFill(data: OverviewDatum[], palette: string[]) {
  return data.map((item, index) => ({
    ...item,
    fill: palette[index % palette.length],
  }));
}

/* ────────────────────────── Main component ─────────────────────────── */

export function ConnectionOverview({
  overview,
  loading,
  error,
  disabled = false,
  onRefresh,
}: ConnectionOverviewProps) {
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(false);
    if (!overview) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setChartsReady(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [overview]);

  const storageData = withFill(
    overview?.storageByDatabase ?? [],
    STORAGE_COLORS,
  );
  const engineData = withFill(overview?.tablesByEngine ?? [], ENGINE_COLORS);
  const queryData = withFill(
    overview?.activeQueriesByUser ?? [],
    STORAGE_COLORS.slice().reverse(),
  );
  const hottestTablesData = withFill(
    overview?.hottestTablesByParts ?? [],
    ENGINE_COLORS.slice().reverse(),
  );

  const queryPressureTotal =
    (overview?.activeQueryCount ?? 0) + (overview?.pendingMutationCount ?? 0);
  const queryPressurePercent =
    queryPressureTotal > 0
      ? ((overview?.activeQueryCount ?? 0) / queryPressureTotal) * 100
      : 0;
  const mutationPressurePercent =
    queryPressureTotal > 0
      ? ((overview?.pendingMutationCount ?? 0) / queryPressureTotal) * 100
      : 0;

  const chartSkeleton = (h: string) => (
    <div className={`${h} animate-pulse rounded-xl bg-muted/20`} />
  );

  return (
    <section className="space-y-3">
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Signals without stealing the editor
          </h2>
          <p className="text-[10px] text-muted-foreground/70">
            Storage footprint, engine mix, live pressure, and hottest tables at
            a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border/50 bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground/60">
            {overview
              ? `Updated ${formatGeneratedAt(overview.generatedAt)}`
              : "Awaiting signal"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1.5 border-border/50 px-2 text-[10px]"
            disabled={loading || disabled}
            onClick={onRefresh}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-[10px] text-accent/90">
          Insights could not be refreshed: {error}
        </div>
      ) : null}

      {!overview && loading ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border/50 bg-muted/20"
            />
          ))}
        </div>
      ) : null}

      {overview ? (
        <>
          {/* ── Metric tiles — 2 cols on small, 4 on lg ── */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MetricTile
              label="Data Footprint"
              value={formatBytes(overview.totalBytes)}
              detail={`${formatCompact(overview.totalRows)} rows across active parts`}
              icon={HardDrive}
            />
            <MetricTile
              label="Catalog"
              value={`${overview.tableCount}`}
              detail={`${overview.databaseCount} databases registered`}
              icon={Database}
            />
            <MetricTile
              label="Live Pressure"
              value={`${overview.activeQueryCount}`}
              detail={`${overview.pendingMutationCount} mutations waiting`}
              icon={Activity}
            />
            <MetricTile
              label="Part Density"
              value={formatCompact(overview.activePartCount)}
              detail="Active parts visible to cluster"
              icon={Layers3}
            />
          </div>

          {/* ── Charts row 1: Storage (wide) + Engine (narrow) ── */}
          <div className="grid gap-2 lg:grid-cols-[1.3fr_0.7fr]">
            <ChartCard
              title="Storage by database"
              subtitle="Disk footprint with row volume in tooltip."
              badge={
                <span className="flex-shrink-0 rounded-full bg-primary/12 px-1.5 py-0.5 text-[9px] text-primary">
                  Top {storageData.length || 0}
                </span>
              }
            >
              {storageData.length > 0 ? (
                chartsReady ? (
                  <ChartContainer
                    className="aspect-[2.2/1] w-full"
                    config={{ value: { label: "Bytes", color: "#79D8FF" } }}
                  >
                    <AreaChart
                      data={storageData}
                      margin={{ left: 0, right: 4, top: 8, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="storage-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#79D8FF"
                            stopOpacity={0.5}
                          />
                          <stop
                            offset="100%"
                            stopColor="#79D8FF"
                            stopOpacity={0.04}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={12}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatBytes(Number(v))}
                        width={56}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, item) => {
                              const payload = item.payload as OverviewDatum;
                              return (
                                <div className="flex min-w-32 items-center justify-between gap-3">
                                  <div className="space-y-0.5">
                                    <div className="text-[10px] text-muted-foreground">
                                      Disk
                                    </div>
                                    <div className="text-xs font-medium text-foreground">
                                      {formatBytes(Number(value))}
                                    </div>
                                  </div>
                                  <div className="space-y-0.5 text-right">
                                    <div className="text-[10px] text-muted-foreground">
                                      Rows
                                    </div>
                                    <div className="text-xs font-medium text-foreground">
                                      {formatCompact(
                                        payload.secondaryValue ?? 0,
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          />
                        }
                      />
                      <Area
                        dataKey="value"
                        type="monotone"
                        stroke="#79D8FF"
                        strokeWidth={2}
                        fill="url(#storage-fill)"
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  chartSkeleton("h-40")
                )
              ) : (
                <EmptyChartState message="No storage data yet." />
              )}
            </ChartCard>

            <ChartCard
              title="Engine mix"
              subtitle="Storage engine distribution."
              icon={Server}
            >
              {engineData.length > 0 ? (
                chartsReady ? (
                  <ChartContainer
                    className="aspect-[1.2/1] w-full"
                    config={{ value: { label: "Tables", color: "#F0B56D" } }}
                  >
                    <BarChart
                      data={engineData}
                      layout="vertical"
                      margin={{ left: 4, right: 4, top: 2, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={80}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar dataKey="value" radius={[999, 999, 999, 999]}>
                        {engineData.map((item) => (
                          <Cell key={item.name} fill={item.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  chartSkeleton("h-36")
                )
              ) : (
                <EmptyChartState message="Engine data unavailable." />
              )}
            </ChartCard>
          </div>

          {/* ── Charts row 2: Operational signals + Hottest tables ── */}
          <div className="grid gap-2 lg:grid-cols-2">
            {/* Operational signals */}
            <ChartCard
              title="Operational signals"
              subtitle="Query concurrency vs mutation backlog."
              icon={Layers3}
            >
              <div className="space-y-2">
                <div className="rounded-lg border border-primary/20 bg-primary/8 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-primary/80">
                      Query Flow
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {overview.activeQueryCount}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-[#3DAFD9]"
                      style={{
                        width: `${Math.max(queryPressurePercent, overview.activeQueryCount > 0 ? 16 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-accent/20 bg-accent/10 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-accent/80">
                      Mutation Queue
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {overview.pendingMutationCount}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-[#CC8444]"
                      style={{
                        width: `${Math.max(mutationPressurePercent, overview.pendingMutationCount > 0 ? 16 : 0)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Query pressure pie + legend */}
                {queryData.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
                    {chartsReady ? (
                      <ChartContainer
                        className="aspect-square w-full"
                        config={{
                          value: { label: "Active queries", color: "#45f0c2" },
                        }}
                      >
                        <PieChart>
                          <Pie
                            data={queryData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="55%"
                            outerRadius="85%"
                            paddingAngle={3}
                          >
                            {queryData.map((item) => (
                              <Cell key={item.name} fill={item.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip
                            content={<ChartTooltipContent hideLabel />}
                          />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      chartSkeleton("h-24")
                    )}
                    <div className="flex flex-col justify-center gap-1">
                      {queryData.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between gap-2 rounded-md bg-muted/15 px-2 py-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: item.fill }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-foreground">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/40 bg-muted/10 p-2">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">
                      Server
                    </div>
                    <div className="mt-1 text-xs font-medium text-foreground">
                      {overview.serverVersion}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-muted/10 p-2">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">
                      Catalog
                    </div>
                    <div className="mt-1 text-xs font-medium text-foreground">
                      {overview.databaseCount} DBs · {overview.tableCount}{" "}
                      tables
                    </div>
                  </div>
                </div>
              </div>
            </ChartCard>

            {/* Hottest tables */}
            <ChartCard
              title="Hottest tables by parts"
              subtitle="Tables with the heaviest active-part footprint."
              icon={Table2}
            >
              {hottestTablesData.length > 0 ? (
                chartsReady ? (
                  <ChartContainer
                    className="aspect-[1.6/1] w-full"
                    config={{
                      value: { label: "Active parts", color: "#ff8e6e" },
                    }}
                  >
                    <BarChart
                      data={hottestTablesData}
                      layout="vertical"
                      margin={{ left: 4, right: 8, top: 4, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={110}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, item) => {
                              const payload = item.payload as OverviewDatum;
                              return (
                                <div className="flex min-w-36 items-center justify-between gap-3">
                                  <div className="space-y-0.5">
                                    <div className="text-[10px] text-muted-foreground">
                                      Parts
                                    </div>
                                    <div className="text-xs font-medium text-foreground">
                                      {formatCompact(Number(value))}
                                    </div>
                                  </div>
                                  <div className="space-y-0.5 text-right">
                                    <div className="text-[10px] text-muted-foreground">
                                      Rows
                                    </div>
                                    <div className="text-xs font-medium text-foreground">
                                      {formatCompact(
                                        payload.secondaryValue ?? 0,
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          />
                        }
                      />
                      <Bar dataKey="value" radius={[999, 999, 999, 999]}>
                        {hottestTablesData.map((item) => (
                          <Cell key={item.name} fill={item.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  chartSkeleton("h-44")
                )
              ) : (
                <EmptyChartState message="Part data unavailable until the cluster exposes active parts." />
              )}
            </ChartCard>
          </div>
        </>
      ) : null}
    </section>
  );
}
