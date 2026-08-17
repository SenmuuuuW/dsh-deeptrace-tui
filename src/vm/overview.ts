/**
 * 视图模型：总览（纯函数，无 Ink 依赖，可直接单测）。
 */
import {
  cacheHitRate,
  costDeltaPct,
  type Insight,
  type InsightLevel,
  type NoteKind,
  type WhaleMood,
} from "../core/index.js";
import type { AppData } from "../data/report.js";
import { formatBig, formatDelta, formatPct, formatYen, sparkline } from "./format.js";

export interface FindingVm {
  rank: number;
  level: InsightLevel;
  title: string;
  detail: string;
  action: string;
}

export interface TrendRowVm {
  label: string;
  /** 数值列（对齐后）。 */
  value: string;
  spark: string;
  live: boolean;
}

export interface TrendSectionVm {
  title: string;
  rows: TrendRowVm[];
}

export interface OverviewVm {
  periodLabel: string;
  periodKey: string;
  live: boolean;
  costText: string;
  costDelta: string;
  sessions: number;
  turns: number;
  tokensText: string;
  cacheRateText: string;
  nightText: string;
  findings: FindingVm[];
  trend: TrendSectionVm[];
  whaleMood: WhaleMood;
  whaleKinds: NoteKind[];
}

/** 洞察 → 发现列表（最多 6 条）。 */
export function findingsOf(insights: readonly Insight[]): FindingVm[] {
  return insights.slice(0, 6).map((i, idx) => ({
    rank: idx + 1,
    level: i.level,
    title: i.title,
    detail: i.detail,
    action: i.action,
  }));
}

/** 趋势区：成本 / 会话 / 缓存 / 夜间 四组。 */
export function trendSections(app: AppData): TrendSectionVm[] {
  const t = app.trend;
  const section = (title: string, fmt: (p: (typeof t)[number]) => string, num: (p: (typeof t)[number]) => number): TrendSectionVm => {
    const rows = t.map((p) => ({ label: p.live ? "LIVE" : p.label, value: fmt(p), num: num(p), live: p.live }));
    const w = Math.max(1, ...rows.map((r) => r.value.length));
    const spark = sparkline(rows.map((r) => r.num), 8);
    return {
      title,
      rows: rows.map((r) => ({ label: r.label, value: r.value.padStart(w), spark, live: r.live })),
    };
  };
  return [
    section("成本", (p) => formatYen(p.cost), (p) => p.cost),
    section("会话", (p) => String(p.sessions), (p) => p.sessions),
    section("Cache", (p) => formatPct(p.cacheRate), (p) => p.cacheRate),
    section("夜间", (p) => formatPct(p.nightRatio, 0), (p) => p.nightRatio),
  ];
}

export function buildOverviewVm(app: AppData): OverviewVm {
  const stats = app.stats;
  const t = stats.tokens;
  const delta = costDeltaPct({ stats, prev: app.prev ?? undefined, cost: app.cost });
  return {
    periodLabel: app.periodLabel,
    periodKey: app.periodKey,
    live: app.live,
    costText: formatYen(app.cost.total),
    costDelta: formatDelta(delta),
    sessions: stats.sessions,
    turns: stats.turns,
    tokensText: formatBig(t.input + t.output + t.cacheRead + t.reasoning),
    cacheRateText: formatPct(cacheHitRate(stats)),
    nightText: formatPct((stats.totalEvents === 0 ? 0 : (stats.hourHistogram.slice(0, 6).reduce((a, b) => a + b, 0) / stats.totalEvents) * 100), 0),
    findings: findingsOf(app.insights),
    trend: trendSections(app),
    whaleMood: app.whale.mood,
    whaleKinds: app.whale.kinds,
  };
}
