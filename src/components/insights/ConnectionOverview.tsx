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
  "#62c6ff",
  "#45f0c2",
  "#f5b85c",
  "#ff8e6e",
  "#d682ff",
  "#94f06b",
];

const ENGINE_COLORS = [
  "#ffbf69",
  "#62c6ff",
  "#45f0c2",
  "#ff8e6e",
  "#d682ff",
  "#94f06b",
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

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/8 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur ${tone}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/48">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {value}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 p-2 text-white/72">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-[11px] text-white/56">{detail}</div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-36 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 text-center text-[11px] text-white/46">
      {message}
    </div>
  );
}

function withFill(data: OverviewDatum[], palette: string[]) {
  return data.map((item, index) => ({
    ...item,
    fill: palette[index % palette.length],
  }));
}

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
    const frame = window.requestAnimationFrame(() => {
      setChartsReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
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

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(98,198,255,0.16),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(245,184,92,0.14),transparent_28%),linear-gradient(180deg,rgba(6,10,18,0.98),rgba(8,14,24,0.94))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />

      <div className="relative px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/62">
              Observability
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Cluster Pulse
              </h2>
              {overview ? (
                <span className="rounded-full border border-cyan-200/14 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100/72">
                  {overview.serverVersion}
                </span>
              ) : null}
            </div>
            <p className="max-w-3xl text-[11px] leading-5 text-white/52">
              A live overview of storage footprint, engine composition, active
              query pressure, and the tables creating the most operational heat.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[10px] text-white/58">
              {overview
                ? `Updated ${formatGeneratedAt(overview.generatedAt)}`
                : "Awaiting signal"}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 border-white/10 bg-white/4 px-2.5 text-[11px] text-white/82 hover:bg-white/10 hover:text-white"
              disabled={loading || disabled}
              onClick={onRefresh}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-amber-300/16 bg-amber-200/8 px-3 py-2 text-[11px] text-amber-100/82">
            Insights could not be refreshed: {error}
          </div>
        ) : null}

        {!overview && loading ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-white/8 bg-white/5"
              />
            ))}
          </div>
        ) : null}

        {overview ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="Data Footprint"
                value={formatBytes(overview.totalBytes)}
                detail={`${formatCompact(overview.totalRows)} rows across active parts`}
                icon={HardDrive}
                tone="from-transparent to-transparent"
              />
              <MetricTile
                label="Catalog"
                value={`${overview.tableCount}`}
                detail={`${overview.databaseCount} databases registered`}
                icon={Database}
                tone="from-transparent to-transparent"
              />
              <MetricTile
                label="Live Pressure"
                value={`${overview.activeQueryCount}`}
                detail={`${overview.pendingMutationCount} mutations waiting`}
                icon={Activity}
                tone="from-transparent to-transparent"
              />
              <MetricTile
                label="Part Density"
                value={formatCompact(overview.activePartCount)}
                detail="Active parts currently visible to the cluster"
                icon={Layers3}
                tone="from-transparent to-transparent"
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[26px] border border-white/8 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Storage by database
                    </div>
                    <div className="text-[11px] text-white/46">
                      Disk footprint with row volume layered into the tooltip.
                    </div>
                  </div>
                  <div className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100/68">
                    Top {storageData.length || 0}
                  </div>
                </div>
                {storageData.length > 0 ? (
                  chartsReady ? (
                    <ChartContainer
                      className="h-52 w-full min-h-[208px]"
                      config={{
                        value: { label: "Bytes", color: "#62c6ff" },
                      }}
                    >
                      <AreaChart
                        data={storageData}
                        margin={{ left: 4, right: 8, top: 10 }}
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
                              stopColor="#62c6ff"
                              stopOpacity={0.55}
                            />
                            <stop
                              offset="100%"
                              stopColor="#62c6ff"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          minTickGap={12}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => formatBytes(Number(value))}
                          width={70}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, _name, item) => {
                                const payload = item.payload as OverviewDatum;
                                return (
                                  <div className="flex min-w-40 items-center justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="text-[11px] text-muted-foreground">
                                        Disk
                                      </div>
                                      <div className="text-xs font-medium text-foreground">
                                        {formatBytes(Number(value))}
                                      </div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                      <div className="text-[11px] text-muted-foreground">
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
                          stroke="#62c6ff"
                          strokeWidth={2}
                          fill="url(#storage-fill)"
                        />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-52 animate-pulse rounded-2xl bg-white/4" />
                  )
                ) : (
                  <EmptyChartState message="No active parts yet. Storage charts light up after tables start accumulating data." />
                )}
              </div>

              <div className="grid gap-3">
                <div className="rounded-[26px] border border-white/8 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        Engine mix
                      </div>
                      <div className="text-[11px] text-white/46">
                        Which storage engines dominate this environment.
                      </div>
                    </div>
                    <Server className="h-4 w-4 text-amber-200/60" />
                  </div>
                  {engineData.length > 0 ? (
                    chartsReady ? (
                      <ChartContainer
                        className="h-44 w-full min-h-[176px]"
                        config={{
                          value: { label: "Tables", color: "#ffbf69" },
                        }}
                      >
                        <BarChart
                          data={engineData}
                          layout="vertical"
                          margin={{ left: 8, right: 8, top: 4, bottom: 0 }}
                        >
                          <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                          />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            width={92}
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
                      <div className="h-44 animate-pulse rounded-2xl bg-white/4" />
                    )
                  ) : (
                    <EmptyChartState message="Engine composition is unavailable for this connection." />
                  )}
                </div>

                <div className="rounded-[26px] border border-white/8 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        Live query pressure
                      </div>
                      <div className="text-[11px] text-white/46">
                        Session balance across the users currently consuming the
                        cluster.
                      </div>
                    </div>
                    <Activity className="h-4 w-4 text-cyan-100/54" />
                  </div>
                  {queryData.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-[132px_1fr]">
                      {chartsReady ? (
                        <ChartContainer
                          className="h-36 w-full min-h-[144px]"
                          config={{
                            value: {
                              label: "Active queries",
                              color: "#45f0c2",
                            },
                          }}
                        >
                          <PieChart>
                            <Pie
                              data={queryData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={42}
                              outerRadius={56}
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
                        <div className="h-36 animate-pulse rounded-2xl bg-white/4" />
                      )}
                      <div className="space-y-2">
                        {queryData.map((item) => (
                          <div
                            key={item.name}
                            className="rounded-2xl border border-white/8 bg-black/16 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: item.fill }}
                                />
                                <span className="text-[11px] text-white/72">
                                  {item.name}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-white">
                                {item.value}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyChartState message="No active queries right now. This panel wakes up as sessions begin running." />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[26px] border border-white/8 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Operational signals
                    </div>
                    <div className="text-[11px] text-white/46">
                      Fast read on query concurrency versus background mutation
                      backlog.
                    </div>
                  </div>
                  <Layers3 className="h-4 w-4 text-white/44" />
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-cyan-200/10 bg-cyan-300/6 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/60">
                        Query Flow
                      </span>
                      <span className="text-lg font-semibold text-white">
                        {overview.activeQueryCount}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/26">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-teal-300"
                        style={{
                          width: `${Math.max(
                            queryPressurePercent,
                            overview.activeQueryCount > 0 ? 16 : 0,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200/10 bg-amber-300/6 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-amber-100/60">
                        Mutation Queue
                      </span>
                      <span className="text-lg font-semibold text-white">
                        {overview.pendingMutationCount}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/26">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-300"
                        style={{
                          width: `${Math.max(
                            mutationPressurePercent,
                            overview.pendingMutationCount > 0 ? 16 : 0,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-white/44">
                        Server
                      </div>
                      <div className="mt-2 text-sm font-medium text-white">
                        {overview.serverVersion}
                      </div>
                      <div className="mt-1 text-[11px] text-white/44">
                        Connection is reading system metadata directly from
                        ClickHouse.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/18 p-3">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-white/44">
                        Catalog Surface
                      </div>
                      <div className="mt-2 text-sm font-medium text-white">
                        {overview.databaseCount} DBs · {overview.tableCount}{" "}
                        tables
                      </div>
                      <div className="mt-1 text-[11px] text-white/44">
                        Enough metadata is present to drive the next releases:
                        filters, autocomplete, and saved workspaces.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Tables creating the most part churn
                    </div>
                    <div className="text-[11px] text-white/46">
                      The tables with the heaviest active-part footprint usually
                      deserve the next operational look.
                    </div>
                  </div>
                  <Table2 className="h-4 w-4 text-white/50" />
                </div>
                {hottestTablesData.length > 0 ? (
                  chartsReady ? (
                    <ChartContainer
                      className="h-56 w-full min-h-[224px]"
                      config={{
                        value: { label: "Active parts", color: "#ff8e6e" },
                      }}
                    >
                      <BarChart
                        data={hottestTablesData}
                        layout="vertical"
                        margin={{ left: 12, right: 10, top: 6, bottom: 0 }}
                      >
                        <CartesianGrid
                          horizontal={false}
                          strokeDasharray="3 3"
                        />
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tickLine={false}
                          axisLine={false}
                          width={130}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, _name, item) => {
                                const payload = item.payload as OverviewDatum;
                                return (
                                  <div className="flex min-w-44 items-center justify-between gap-4">
                                    <div className="space-y-1">
                                      <div className="text-[11px] text-muted-foreground">
                                        Active parts
                                      </div>
                                      <div className="text-xs font-medium text-foreground">
                                        {formatCompact(Number(value))}
                                      </div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                      <div className="text-[11px] text-muted-foreground">
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
                    <div className="h-56 animate-pulse rounded-2xl bg-white/4" />
                  )
                ) : (
                  <EmptyChartState message="Part heat is unavailable until the cluster exposes active parts." />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
