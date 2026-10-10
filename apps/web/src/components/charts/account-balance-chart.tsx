"use client";

import { useMemo, useState } from "react";
import {
  accountBalanceCurve,
  type BalancePoint,
  type DrawdownMode,
  type EquityPoint,
} from "@luxalgo/journal-core";
import { fmtAmount, fmtChartDate, fmtFullDate } from "@/lib/utils";
import { usePrivacy } from "../privacy";
import { normalizeCumulativePoints, type EquityPointDatum } from "./equity-area";
import { EChart } from "./echart";
import type { EChartsOption } from "echarts";

export interface AccountBalanceChartProps {
  data: EquityPointDatum[];
  initialBalance?: number;
  maxDrawdown?: number | null;
  currency?: string;
  from?: string | null;
  to?: string | null;
  height?: number;
  defaultMode?: DrawdownMode;
}

export function AccountBalanceChart({
  data,
  initialBalance = 50000,
  maxDrawdown = 2000,
  currency = "USD",
  from,
  to,
  height = 280,
  defaultMode = "dynamic",
}: AccountBalanceChartProps) {
  const [mode, setMode] = useState<DrawdownMode>(defaultMode);
  const privacy = usePrivacy();

  // Normalize equity points across the selected range
  const normalizedData = useMemo(
    () => normalizeCumulativePoints(data, from, to),
    [data, from, to],
  );

  // Fallback to 5% initial balance if maxDrawdown is missing or <= 0
  const effectiveMaxDrawdown =
    maxDrawdown && maxDrawdown > 0
      ? maxDrawdown
      : initialBalance > 0
        ? Math.round(initialBalance * 0.05)
        : 2000;

  // Compute Account Balance curve & Trailing Drawdown floor
  const points: BalancePoint[] = useMemo(() => {
    if (!normalizedData || normalizedData.length === 0) return [];
    const corePoints: EquityPoint[] = normalizedData.map((d) => ({
      t: d.t,
      cumNetPnl: d.cumNetPnl,
    }));
    return accountBalanceCurve(corePoints, {
      initialBalance,
      maxDrawdown: effectiveMaxDrawdown,
      mode,
      lockAtInitial: true,
    });
  }, [normalizedData, initialBalance, effectiveMaxDrawdown, mode]);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const currentFloor = latest?.minBalance ?? Math.max(0, initialBalance - effectiveMaxDrawdown);
  const currentCushion = latest?.cushion ?? effectiveMaxDrawdown;
  const cushionPct =
    effectiveMaxDrawdown > 0 ? Math.max(0, currentCushion / effectiveMaxDrawdown) : 1;

  // Standard TradeJournal profit (--profit #0ca30c) and loss (--loss #d03b3b) tokens
  const PROFIT_COLOR = "#0ca30c";
  const LOSS_COLOR = "#d03b3b";

  // Build the ECharts option matching the Lucid Trading visual pattern
  const option: EChartsOption = useMemo(() => {
    if (!points || points.length === 0) return {};

    const dates = points.map((p) => p.t);
    const balanceSeries = points.map((p) => p.balance);
    const minBalanceSeries = points.map((p) => p.minBalance);

    // Compute nice Y-axis bounds in multiples of 500
    const allVals = [...balanceSeries, ...minBalanceSeries];
    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    let yMin = Math.floor(rawMin / 500) * 500;
    let yMax = Math.ceil(rawMax / 500) * 500;

    if (yMax <= yMin) {
      yMin -= 500;
      yMax += 500;
    } else if (yMax - yMin < 1000) {
      yMax += 500;
    }

    const span = yMax - yMin;
    const interval = span <= 4000 ? 500 : Math.ceil(span / 6 / 500) * 500;

    return {
      animation: false,
      backgroundColor: "transparent",
      grid: {
        left: 8,
        right: 64,
        top: 20,
        bottom: 24,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(18, 18, 22, 0.72)",
        borderColor: "rgba(255, 255, 255, 0.10)",
        borderWidth: 1,
        padding: [10, 14],
        extraCssText:
          "box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-radius: 12px;",
        axisPointer: {
          type: "line",
          lineStyle: {
            color: "rgba(255, 255, 255, 0.12)",
            type: "dashed",
            width: 1,
          },
        },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const firstParam = params[0] as { dataIndex: number };
          const idx = firstParam.dataIndex;
          const pt = points[idx];
          if (!pt) return "";

          const formattedDate = fmtFullDate(pt.t);
          const balText = privacy ? "••••" : fmtAmount(pt.balance, currency);
          const minText = privacy ? "••••" : fmtAmount(pt.minBalance, currency);
          const cushionText = privacy ? "••••" : fmtAmount(pt.cushion, currency);
          const cushionColor =
            pt.cushion >= effectiveMaxDrawdown * 0.5
              ? PROFIT_COLOR
              : pt.cushion > 0
                ? "#f59e0b"
                : LOSS_COLOR;

          return `
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #f4f4f5; min-width: 210px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.10); padding-bottom: 5px; margin-bottom: 8px; font-size: 10px; color: #a1a1aa; font-weight: 500; letter-spacing: 0.04em;">
                <span>${formattedDate}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 6px;">
                <span style="display: flex; align-items: center; gap: 6px; color: #a1a1aa; font-size: 11px;">
                  <span style="width: 8px; height: 8px; border-radius: 2px; background: ${PROFIT_COLOR}; display: inline-block;"></span>
                  <span>Account Balance</span>
                </span>
                <span style="font-weight: 700; font-size: 12px; font-variant-numeric: tabular-nums; color: #ffffff;">${balText}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 6px;">
                <span style="display: flex; align-items: center; gap: 6px; color: #a1a1aa; font-size: 11px;">
                  <span style="width: 8px; height: 8px; border-radius: 2px; background: ${LOSS_COLOR}; display: inline-block;"></span>
                  <span>Minimum Balance</span>
                </span>
                <span style="font-weight: 700; font-size: 12px; font-variant-numeric: tabular-nums; color: #ffffff;">${minText}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 6px; margin-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.10);">
                <span style="color: #a1a1aa; font-size: 11px;">Safety Cushion</span>
                <span style="font-weight: 700; font-size: 12px; font-variant-numeric: tabular-nums; color: ${cushionColor};">${cushionText}</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: false,
        axisLine: {
          lineStyle: { color: "rgba(255, 255, 255, 0.12)" },
        },
        axisTick: { show: false },
        axisLabel: {
          color: "rgba(255, 255, 255, 0.45)",
          fontSize: 11,
          formatter: (value: string) => fmtChartDate(value),
          interval: Math.max(0, Math.floor(dates.length / 8)),
        },
      },
      yAxis: {
        type: "value",
        position: "right",
        min: yMin,
        max: yMax,
        interval,
        splitLine: {
          lineStyle: {
            color: "rgba(255, 255, 255, 0.04)",
            type: "solid",
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "rgba(255, 255, 255, 0.45)",
          fontSize: 11,
          formatter: (value: number) => {
            if (privacy) return "••••";
            return `$${Math.round(value).toLocaleString("en-US")}`;
          },
        },
      },
      series: [
        {
          name: "Account Balance",
          type: "line",
          smooth: 0.25,
          showSymbol: false,
          symbol: "circle",
          symbolSize: 8,
          itemStyle: {
            color: PROFIT_COLOR,
          },
          lineStyle: {
            color: PROFIT_COLOR,
            width: 2.2,
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(12, 163, 12, 0.28)" },
                { offset: 0.8, color: "rgba(12, 163, 12, 0.04)" },
                { offset: 1, color: "rgba(12, 163, 12, 0.0)" },
              ],
            },
          },
          emphasis: {
            scale: true,
            itemStyle: {
              color: PROFIT_COLOR,
              borderColor: "#ffffff",
              borderWidth: 2,
              shadowBlur: 8,
              shadowColor: "rgba(12, 163, 12, 0.6)",
            },
          },
          data: balanceSeries,
        },
        {
          name: "Minimum Balance",
          type: "line",
          smooth: 0.1,
          showSymbol: false,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: {
            color: LOSS_COLOR,
          },
          lineStyle: {
            color: LOSS_COLOR,
            width: 1.8,
            type: "dashed",
          },
          emphasis: {
            scale: true,
            itemStyle: {
              color: LOSS_COLOR,
              borderColor: LOSS_COLOR,
              borderWidth: 1,
            },
          },
          data: minBalanceSeries,
        },
      ],
    };
  }, [points, privacy, currency, effectiveMaxDrawdown]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Sub-header with legend and mode selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2.5 text-xs">
        {/* Inline indicators with standard colors */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-[1.5px] bg-[#0ca30c]" />
            Balance
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-[1.5px] bg-[#d03b3b]" />
            Minimum
          </span>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setMode("dynamic")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer select-none ${
              mode === "dynamic"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Trails running peak balance continuously and locks at initial balance"
          >
            Dynamic
          </button>
          <button
            type="button"
            onClick={() => setMode("eod")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer select-none ${
              mode === "eod"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Trails high-water mark calculated at End of Day"
          >
            EOD
          </button>
          <button
            type="button"
            onClick={() => setMode("static")}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer select-none ${
              mode === "static"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Fixed minimum threshold at (Initial Balance - Max Drawdown)"
          >
            Static
          </button>
        </div>
      </div>

      {/* Lucid-style EChart Frame */}
      <div className="flex-1 min-h-[220px]">
        {points.length > 0 ? (
          <EChart option={option} height={height} />
        ) : (
          <div
            style={{ height }}
            className="flex items-center justify-center text-xs text-muted-foreground"
          >
            No balance data in range
          </div>
        )}
      </div>
    </div>
  );
}
