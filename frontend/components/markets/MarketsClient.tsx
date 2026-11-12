"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange, RotateCcw, Search } from "lucide-react";
import { ApiClientError, apiClient } from "@/lib/api";
import { downsampleByExtrema } from "@/lib/charts/downsample";
import { MARKET_FULL_RANGE } from "@/lib/constants/referenceConfig";
import {
  formatInteger,
  formatIsoDate,
  formatPercent,
  formatRatio,
  formatUsd,
  getTrendTone,
} from "@/lib/formatters/financial";
import type {
  AssetQualityRow,
  BuyAndHoldRow,
  CrossoverRow,
  DailyAssetPoint,
  MarketPricesResponse,
  MarketSummaryResponse,
} from "@/types/api";
import { ChartContainer } from "@/components/charts/ChartContainer";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import {
  formatAxisDate,
  formatCompactIndexAxis,
  formatCompactUsdAxis,
} from "@/components/charts/chartFormatters";
import { CHART_COLORS } from "@/components/charts/chartTheme";
import { DataQualityBadge } from "@/components/common/DataQualityBadge";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState, MetricGridSkeleton } from "@/components/common/LoadingState";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { ResearchWarningBanner } from "@/components/common/ResearchWarningBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const CHART_MAX_POINTS = 450;

interface DateFilter {
  startDate: string;
  endDate: string;
}

export function MarketsClient() {
  const [draftStart, setDraftStart] = useState<string>(MARKET_FULL_RANGE.startDate);
  const [draftEnd, setDraftEnd] = useState<string>(MARKET_FULL_RANGE.endDate);
  const [appliedFilter, setAppliedFilter] = useState<DateFilter>({
    startDate: MARKET_FULL_RANGE.startDate,
    endDate: MARKET_FULL_RANGE.endDate,
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const [pricesData, setPricesData] = useState<MarketPricesResponse | null>(null);
  const [summaryData, setSummaryData] = useState<MarketSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [priceScale, setPriceScale] = useState<"linear" | "log">("log");
  const [normScale, setNormScale] = useState<"linear" | "log">("log");
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const triggerReload = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadMarkets() {
      setLoading(true);
      setError(null);
      try {
        const [pricesRes, summaryRes] = await Promise.all([
          apiClient.getMarketPrices(
            {
              start_date: appliedFilter.startDate,
              end_date: appliedFilter.endDate,
              initial_capital: MARKET_FULL_RANGE.initialCapital,
            },
            controller.signal
          ),
          apiClient.getMarketSummary(
            {
              start_date: appliedFilter.startDate,
              end_date: appliedFilter.endDate,
            },
            controller.signal
          ),
        ]);
        if (!active || controller.signal.aborted) return;
        setPricesData(pricesRes);
        setSummaryData(summaryRes);
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        if (err instanceof ApiClientError && err.code === "REQUEST_ABORTED") return;
        setError({
          message:
            err instanceof Error
              ? err.message
              : "Failed to fetch market data from FastAPI backend.",
          code: err instanceof ApiClientError ? err.code : undefined,
        });
      } finally {
        if (active && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadMarkets();
    return () => {
      active = false;
      controller.abort();
    };
  }, [appliedFilter.startDate, appliedFilter.endDate, reloadNonce]);

  const applyRange = useCallback(
    (nextStart: string, nextEnd: string) => {
      if (!nextStart || !nextEnd) {
        setValidationError("Both start date and end date are required.");
        return;
      }
      if (nextStart > nextEnd) {
        setValidationError("Start date must be on or before end date.");
        return;
      }
      setValidationError(null);
      setAppliedFilter({ startDate: nextStart, endDate: nextEnd });
    },
    []
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyRange(draftStart, draftEnd);
  };

  const applyPreset = (start: string, end: string) => {
    setDraftStart(start);
    setDraftEnd(end);
    applyRange(start, end);
  };

  const sampledPrices = useMemo<DailyAssetPoint[]>(() => {
    if (!pricesData) return [];
    return downsampleByExtrema(pricesData.prices, CHART_MAX_POINTS, (p) => [
      p.Bitcoin,
      p.Ethereum,
      p.Solana,
    ]);
  }, [pricesData]);

  const sampledNormalized = useMemo<DailyAssetPoint[]>(() => {
    if (!pricesData) return [];
    return downsampleByExtrema(pricesData.normalized_indices, CHART_MAX_POINTS, (p) => [
      p.Bitcoin,
      p.Ethereum,
      p.Solana,
    ]);
  }, [pricesData]);

  const sampledCommonStart = useMemo<DailyAssetPoint[]>(() => {
    if (!pricesData || !pricesData.common_start_date) return [];
    const overlapOnly = pricesData.common_start_indices.filter(
      (pt) => pt.date >= pricesData.common_start_date!
    );
    return downsampleByExtrema(overlapOnly, CHART_MAX_POINTS, (p) => [
      p.Bitcoin,
      p.Ethereum,
      p.Solana,
    ]);
  }, [pricesData]);

  const buyAndHoldColumns: DataTableColumn<BuyAndHoldRow>[] = [
    {
      key: "asset",
      header: "Asset",
      render: (r) => <span className="font-medium text-foreground">{r.asset}</span>,
    },
    {
      key: "entry",
      header: "Entry Date",
      numeric: true,
      render: (r) => formatIsoDate(r.entry_date),
    },
    {
      key: "last",
      header: "Last Price Date",
      numeric: true,
      render: (r) => formatIsoDate(r.last_price_date),
    },
    {
      key: "final_val",
      header: "Final Value (USD)",
      align: "right",
      numeric: true,
      render: (r) => formatUsd(r.final_value_usd),
    },
    {
      key: "profit",
      header: "Profit (USD)",
      align: "right",
      numeric: true,
      render: (r) => (
        <span className={getTrendTone(r.profit_usd) === "positive" ? "text-emerald-400" : "text-rose-400"}>
          {formatUsd(r.profit_usd)}
        </span>
      ),
    },
    {
      key: "return_pct",
      header: "Return (%)",
      align: "right",
      numeric: true,
      render: (r) => (
        <span className={getTrendTone(r.return_pct) === "positive" ? "text-emerald-400" : "text-rose-400"}>
          {formatPercent(r.return_pct)}
        </span>
      ),
    },
  ];

  const crossoverColumns: DataTableColumn<CrossoverRow>[] = [
    {
      key: "date",
      header: "Crossover Date",
      numeric: true,
      render: (r) => r.date,
    },
    {
      key: "pair",
      header: "Asset Pair",
      render: (r) => r.pair,
    },
    {
      key: "leader",
      header: "Leader After Crossover",
      render: (r) => <span className="font-medium text-sky-300">{r.leader_after_crossover}</span>,
    },
    {
      key: "spread",
      header: "Index Spread After Crossover",
      align: "right",
      numeric: true,
      render: (r) => formatRatio(r.index_spread_after_crossover),
    },
  ];

  const qualityColumns: DataTableColumn<AssetQualityRow>[] = [
    {
      key: "asset",
      header: "Asset",
      render: (r) => <span className="font-medium text-foreground">{r.asset}</span>,
    },
    {
      key: "ticker",
      header: "Ticker",
      numeric: true,
      render: (r) => r.ticker,
    },
    {
      key: "first",
      header: "First Available",
      numeric: true,
      render: (r) => formatIsoDate(r.first_available_date),
    },
    {
      key: "last",
      header: "Last Available",
      numeric: true,
      render: (r) => formatIsoDate(r.last_available_date),
    },
    {
      key: "valid",
      header: "Valid Obs",
      align: "right",
      numeric: true,
      render: (r) => formatInteger(r.valid_observations),
    },
    {
      key: "missing",
      header: "Missing Obs",
      align: "right",
      numeric: true,
      render: (r) => (
        <span className={r.missing_observations > 0 ? "text-amber-300" : "text-foreground"}>
          {formatInteger(r.missing_observations)}
        </span>
      ),
    },
    {
      key: "non_pos",
      header: "Non-Positive",
      align: "right",
      numeric: true,
      render: (r) => formatInteger(r.non_positive_prices),
    },
    {
      key: "outliers",
      header: "Moves > 50%",
      align: "right",
      numeric: true,
      render: (r) => formatInteger(r.outliers_over_50pct),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historical Markets & Data Quality"
        description="Daily historical closes, normalized performance, fair three-asset common-start comparisons, crossovers, and canonical dataset quality checks."
        badge={
          summaryData
            ? `${summaryData.date_range.start_date} to ${summaryData.date_range.end_date} (${formatInteger(summaryData.date_range.row_count)} days)`
            : "Canonical Dataset"
        }
        actions={
          summaryData ? (
            <DataQualityBadge
              status={summaryData.data_quality_status === "valid" ? "valid" : "warning"}
              label={
                summaryData.data_quality_status === "valid"
                  ? `Valid · ${summaryData.duplicate_dates} duplicates`
                  : "Review Quality Caveats"
              }
            />
          ) : null
        }
      />

      {/* Date-Range Controls */}
      <Card className="border-border/80 bg-card/90 shadow-none">
        <CardContent className="pt-5">
          <form
            onSubmit={handleFormSubmit}
            className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <label
                  htmlFor="markets-start-date"
                  className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Start Date
                </label>
                <input
                  id="markets-start-date"
                  type="date"
                  min={MARKET_FULL_RANGE.startDate}
                  max={MARKET_FULL_RANGE.endDate}
                  value={draftStart}
                  onChange={(e) => setDraftStart(e.target.value)}
                  className="h-9 rounded-md border border-input bg-secondary/60 px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="markets-end-date"
                  className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  End Date
                </label>
                <input
                  id="markets-end-date"
                  type="date"
                  min={MARKET_FULL_RANGE.startDate}
                  max={MARKET_FULL_RANGE.endDate}
                  value={draftEnd}
                  onChange={(e) => setDraftEnd(e.target.value)}
                  className="h-9 rounded-md border border-input bg-secondary/60 px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
                  <Search className="h-3.5 w-3.5" />
                  Apply Range
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() =>
                    applyPreset(MARKET_FULL_RANGE.startDate, MARKET_FULL_RANGE.endDate)
                  }
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" />
                Presets:
              </span>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() =>
                  applyPreset(MARKET_FULL_RANGE.startDate, MARKET_FULL_RANGE.endDate)
                }
              >
                Full History (2016–2026)
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => applyPreset("2020-04-10", MARKET_FULL_RANGE.endDate)}
              >
                Common Start (2020–2026)
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => applyPreset("2025-01-01", MARKET_FULL_RANGE.endDate)}
              >
                Test Window (2025–2026)
              </Button>
            </div>
          </form>

          {validationError ? (
            <p className="mt-3 text-xs text-rose-400" role="alert">
              {validationError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <ErrorState
          title="Market data request failed"
          code={error.code}
          message={error.message}
          onRetry={triggerReload}
        />
      ) : null}

      {loading && !pricesData ? (
        <div className="space-y-4">
          <LoadingState
            title="Loading historical market series"
            description="Fetching daily closes, normalized indices, crossovers, and quality checks from FastAPI."
          />
          <MetricGridSkeleton count={4} />
        </div>
      ) : null}

      {/* Latest Closing Prices & Common Start */}
      <section aria-label="Latest closing prices" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Bitcoin Latest Close"
          value={summaryData ? formatUsd(summaryData.latest_closes.Bitcoin) : null}
          sublabel={summaryData ? `BTC-USD · ${summaryData.latest_closes.as_of_date}` : "Selected range end"}
          loading={loading && !summaryData}
        />
        <MetricCard
          label="Ethereum Latest Close"
          value={summaryData ? formatUsd(summaryData.latest_closes.Ethereum) : null}
          sublabel={summaryData ? `ETH-USD · ${summaryData.latest_closes.as_of_date}` : "Selected range end"}
          loading={loading && !summaryData}
        />
        <MetricCard
          label="Solana Latest Close"
          value={summaryData ? formatUsd(summaryData.latest_closes.Solana) : null}
          sublabel={
            summaryData
              ? summaryData.latest_closes.Solana === null
                ? "Unavailable before 2020-04-10"
                : `SOL-USD · ${summaryData.latest_closes.as_of_date}`
              : "Available from 2020-04-10"
          }
          loading={loading && !summaryData}
        />
        <MetricCard
          label="Common-Start Date"
          value={pricesData ? formatIsoDate(pricesData.common_start_date) : null}
          sublabel={
            pricesData?.common_start_date
              ? "First date BTC, ETH, and SOL all exist"
              : "No 3-asset overlap in selected range"
          }
          loading={loading && !pricesData}
        />
      </section>

      {/* Historical USD Prices Chart */}
      <ChartContainer
        title="1. Historical Closing Prices (USD)"
        description="Daily USD closing prices. Missing pre-launch Solana observations (before 2020-04-10) remain null with connectNulls={false}."
        loading={loading && !pricesData}
        error={error?.message ?? null}
        onRetry={triggerReload}
        isEmpty={!loading && !error && sampledPrices.length === 0}
        heightClassName="min-h-[340px]"
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/60 p-0.5">
            <Button
              type="button"
              size="xs"
              variant={priceScale === "log" ? "default" : "ghost"}
              onClick={() => setPriceScale("log")}
            >
              Log
            </Button>
            <Button
              type="button"
              size="xs"
              variant={priceScale === "linear" ? "default" : "ghost"}
              onClick={() => setPriceScale("linear")}
            >
              Linear
            </Button>
          </div>
        }
        footnote={
          pricesData
            ? `Rendered ${formatInteger(sampledPrices.length)} extrema-preserving points from ${formatInteger(pricesData.date_range.row_count)} backend daily rows.`
            : undefined
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.bitcoin }} />
              <span>Bitcoin</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.ethereum }} />
              <span>Ethereum</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.solana }} />
              <span>Solana (from 2020-04-10)</span>
            </span>
          </div>
          <ClientChartFrame height={320}>
            <LineChart data={sampledPrices} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                stroke={CHART_COLORS.axisText}
                fontSize={11}
                minTickGap={36}
              />
              <YAxis
                scale={priceScale}
                domain={priceScale === "log" ? ["auto", "auto"] : [0, "auto"]}
                tickFormatter={formatCompactUsdAxis}
                stroke={CHART_COLORS.axisText}
                fontSize={11}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: CHART_COLORS.tooltipBg,
                  borderColor: CHART_COLORS.tooltipBorder,
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#e2e8f0", fontFamily: "var(--font-geist-mono)" }}
                formatter={(value) => [typeof value === "number" ? formatUsd(value) : "—"]}
              />
              <Line
                type="monotone"
                dataKey="Bitcoin"
                stroke={CHART_COLORS.bitcoin}
                strokeWidth={1.75}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="Ethereum"
                stroke={CHART_COLORS.ethereum}
                strokeWidth={1.75}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="Solana"
                stroke={CHART_COLORS.solana}
                strokeWidth={1.75}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ClientChartFrame>
        </div>
      </ChartContainer>

      {/* Normalized Performance (First Observation = 100) */}
      <ChartContainer
        title="2. Normalized Performance (100 = Each Asset's First Observation)"
        description="Each asset is indexed to 100 on its own first valid date in the selected range. Use the Common-Start chart below for a fair three-way overlap comparison."
        loading={loading && !pricesData}
        error={error?.message ?? null}
        onRetry={triggerReload}
        isEmpty={!loading && !error && sampledNormalized.length === 0}
        heightClassName="min-h-[320px]"
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/60 p-0.5">
            <Button
              type="button"
              size="xs"
              variant={normScale === "log" ? "default" : "ghost"}
              onClick={() => setNormScale("log")}
            >
              Log
            </Button>
            <Button
              type="button"
              size="xs"
              variant={normScale === "linear" ? "default" : "ghost"}
              onClick={() => setNormScale("linear")}
            >
              Linear
            </Button>
          </div>
        }
      >
        <ClientChartFrame height={300}>
          <LineChart data={sampledNormalized} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              stroke={CHART_COLORS.axisText}
              fontSize={11}
              minTickGap={36}
            />
            <YAxis
              scale={normScale}
              domain={normScale === "log" ? ["auto", "auto"] : [0, "auto"]}
              tickFormatter={formatCompactIndexAxis}
              stroke={CHART_COLORS.axisText}
              fontSize={11}
              width={56}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.tooltipBg,
                borderColor: CHART_COLORS.tooltipBorder,
                borderRadius: "0.5rem",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#e2e8f0", fontFamily: "var(--font-geist-mono)" }}
              formatter={(value) => [
                typeof value === "number" ? formatRatio(value, 2) : "—",
              ]}
            />
            <Line
              type="monotone"
              dataKey="Bitcoin"
              stroke={CHART_COLORS.bitcoin}
              strokeWidth={1.75}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Ethereum"
              stroke={CHART_COLORS.ethereum}
              strokeWidth={1.75}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Solana"
              stroke={CHART_COLORS.solana}
              strokeWidth={1.75}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ClientChartFrame>
      </ChartContainer>

      {/* Common-Start Comparison (2020-04-10 = 100) */}
      <ChartContainer
        title="3. Fair Three-Way Common-Start Comparison (100 = Overlap Start)"
        description={
          pricesData?.common_start_date
            ? `All three assets indexed to 100 on ${pricesData.common_start_date}, the first date Bitcoin, Ethereum, and Solana all have valid observations.`
            : "Compares Bitcoin, Ethereum, and Solana from their first overlapping observation date."
        }
        loading={loading && !pricesData}
        error={error?.message ?? null}
        onRetry={triggerReload}
        isEmpty={!loading && !error && sampledCommonStart.length === 0}
        emptyTitle="No three-asset overlap in selected date range"
        emptyDescription="Solana observations begin on 2020-04-10. Expand the end date to 2020-04-10 or later for a common-start comparison."
        heightClassName="min-h-[320px]"
      >
        <ClientChartFrame height={300}>
          <LineChart data={sampledCommonStart} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              stroke={CHART_COLORS.axisText}
              fontSize={11}
              minTickGap={36}
            />
            <YAxis
              tickFormatter={formatCompactIndexAxis}
              stroke={CHART_COLORS.axisText}
              fontSize={11}
              width={56}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: CHART_COLORS.tooltipBg,
                borderColor: CHART_COLORS.tooltipBorder,
                borderRadius: "0.5rem",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#e2e8f0", fontFamily: "var(--font-geist-mono)" }}
              formatter={(value) => [
                typeof value === "number" ? formatRatio(value, 2) : "—",
              ]}
            />
            <Line
              type="monotone"
              dataKey="Bitcoin"
              stroke={CHART_COLORS.bitcoin}
              strokeWidth={1.75}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Ethereum"
              stroke={CHART_COLORS.ethereum}
              strokeWidth={1.75}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="Solana"
              stroke={CHART_COLORS.solana}
              strokeWidth={1.75}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ClientChartFrame>
      </ChartContainer>

      {/* Buy-and-Hold Summary Table */}
      <section className="space-y-3" aria-label="Buy-and-hold summary">
        <h2 className="text-sm font-medium text-foreground">
          4. Buy-and-Hold Summary (${formatInteger(MARKET_FULL_RANGE.initialCapital)} Initial Capital)
        </h2>
        <DataTable
          columns={buyAndHoldColumns}
          rows={pricesData?.buy_and_hold ?? []}
          getRowKey={(r) => r.asset}
          loading={loading && !pricesData}
          emptyTitle="No buy-and-hold benchmarks"
          emptyDescription="Apply a valid date range to view asset buy-and-hold results."
          caption="Each asset begins on its own first valid price date within the selected window (Solana enters no earlier than 2020-04-10)."
        />
      </section>

      {/* Paginated Relative-Performance Crossovers Table */}
      <section className="space-y-3" aria-label="Relative-performance crossovers">
        <h2 className="text-sm font-medium text-foreground">
          5. Relative-Performance Crossover Dates
        </h2>
        <DataTable
          columns={crossoverColumns}
          rows={pricesData?.crossovers ?? []}
          getRowKey={(r, idx) => `${r.date}-${r.pair}-${idx}`}
          loading={loading && !pricesData}
          pageSize={12}
          emptyTitle="No crossovers in selected range"
          emptyDescription="No relative-performance index crossovers occurred during this date range."
        />
      </section>

      {/* Per-Asset Data Quality Audit Table */}
      <section className="space-y-3" aria-label="Per-asset data quality audit">
        <h2 className="text-sm font-medium text-foreground">
          6. Per-Asset Data Quality &amp; Availability Audit
        </h2>
        <DataTable
          columns={qualityColumns}
          rows={summaryData?.asset_quality ?? []}
          getRowKey={(r) => r.asset}
          loading={loading && !summaryData}
          emptyTitle="No data quality audit available"
          emptyDescription="Data quality metrics will appear once /api/markets/summary loads."
          caption={`Duplicate date rows in source: ${summaryData?.duplicate_dates ?? "—"}. No missing prices have been forward-filled or fabricated.`}
        />
      </section>

      {/* Provenance & Missing Data Disclosures */}
      <ResearchWarningBanner
        title="Dataset Provenance & Missing-Data Caveats"
        items={
          summaryData?.caveats ?? [
            "Solana historical data begins on 2020-04-10; 1,248 earlier observations remain null and are never forward-filled or fabricated.",
            "Ethereum history prior to 2017-11-09 in the bundled CSV reflects a reconciled series noted as provisional in DATA_SOURCES.md.",
          ]
        }
      />
    </div>
  );
}

