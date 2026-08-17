/**
 * 视图模型：历史趋势（纯函数）。
 * 数据与总览趋势同源（periodRanges 逐个聚合），这里提供完整周期明细 + 本期按日活跃。
 */
import type { AppData } from "../data/report.js";
import { formatBig, formatPct, formatYen, sparkline } from "./format.js";

export interface HistoryRowVm {
  label: string;
  live: boolean;
  costText: string;
  sessions: number;
  cacheRateText: string;
  nightText: string;
  tokensText: string;
  events: number;
}

export interface HistoryVm {
  rows: HistoryRowVm[];
  daily: { date: string; count: number }[];
  dailySpark: string;
  maxDaily: number;
  liveLabel: string;
}

export function buildHistoryVm(app: AppData): HistoryVm {
  const rows = app.trend.map((p) => ({
    label: p.live ? "LIVE" : p.label,
    live: p.live,
    costText: formatYen(p.cost),
    sessions: p.sessions,
    cacheRateText: formatPct(p.cacheRate),
    nightText: formatPct(p.nightRatio, 0),
    tokensText: formatBig(p.totalTokens),
    events: p.events,
  }));
  const daily = app.stats.dailySeries.slice(-14).map((d) => ({ date: d.date.slice(5), count: d.count }));
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));
  return {
    rows,
    daily,
    dailySpark: sparkline(daily.map((d) => d.count), 24),
    maxDaily,
    liveLabel: "LIVE",
  };
}
