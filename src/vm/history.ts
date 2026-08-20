/**
 * 视图模型：历史趋势 v2（纯函数）。
 * 单指标切换（c/s/t/h）：一次只展示一个指标 × 5 周期 + 比例条形，
 * 细节才允许完整趋势（Overview 只给方向感）。
 */
import type { AppData } from "../data/report.js";
import { formatBig, formatPct, formatYen, ratioBar, sparkline } from "./format.js";

export type HistoryMetric = "cost" | "sessions" | "tokens" | "cache";

export const HISTORY_METRICS: { key: HistoryMetric; label: string; keyHint: string }[] = [
  { key: "cost", label: "成本", keyHint: "c" },
  { key: "sessions", label: "会话", keyHint: "s" },
  { key: "tokens", label: "Tokens", keyHint: "t" },
  { key: "cache", label: "Cache", keyHint: "h" },
];

export interface HistoryBarRow {
  label: string;
  valueText: string;
  /** 比例条形（█），宽度按该周期占最大值的比例。 */
  bar: string;
  live: boolean;
}

export interface HistoryVm {
  metric: HistoryMetric;
  rows: HistoryBarRow[];
  daily: { date: string; count: number }[];
  dailySpark: string;
  maxDaily: number;
}

export function metricValue(p: { cost: number; sessions: number; totalTokens: number; cacheRate: number }, metric: HistoryMetric): number {
  if (metric === "cost") return p.cost;
  if (metric === "sessions") return p.sessions;
  if (metric === "tokens") return p.totalTokens;
  return p.cacheRate;
}

export function metricText(p: { cost: number; sessions: number; totalTokens: number; cacheRate: number }, metric: HistoryMetric): string {
  if (metric === "cost") return formatYen(p.cost);
  if (metric === "sessions") return String(p.sessions);
  if (metric === "tokens") return formatBig(p.totalTokens);
  return formatPct(p.cacheRate);
}

/** 单指标 × 5 周期 → 值 + 比例条形（LIVE 行高亮）。 */
export function historyRows(app: AppData, metric: HistoryMetric, barWidth = 12, ascii = false): HistoryBarRow[] {
  const t = app.trend;
  const nums = t.map((p) => metricValue(p, metric));
  const max = Math.max(0, ...nums);
  const w = Math.max(...t.map((p) => metricText(p, metric).length), 6);
  return t.map((p, i) => ({
    label: p.live ? "LIVE" : p.label,
    valueText: metricText(p, metric).padStart(w),
    bar: ratioBar(nums[i], max, barWidth, ascii),
    live: p.live,
  }));
}

export function buildHistoryVm(app: AppData, metric: HistoryMetric, ascii = false): HistoryVm {
  const daily = app.stats.dailySeries.slice(-14).map((d) => ({ date: d.date.slice(5), count: d.count }));
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));
  return {
    metric,
    rows: historyRows(app, metric, 12, ascii),
    daily,
    dailySpark: sparkline(daily.map((d) => d.count), 24, ascii),
    maxDaily,
  };
}
