/**
 * 视图模型：总览 v2（纯函数，无 Ink 依赖）。
 *
 * 信息架构（CALM / DENSE / 三层级）：
 * 1. KPI —— 固定四指标（成本/会话/Tokens/Cache），数字大、label 弱；
 * 2. 需要关注 —— Top N（critical/warning > tip，info 不占位），只给方向；
 * 3. 趋势 —— 4 行压缩（label + sparkline + 当前值），细节进 History。
 *
 * 不改任何统计/洞察语义：insights/trend 数据原样来自 core，这里只做
 * 展示层排序、截断与格式化。
 */
import {
  cacheHitRate,
  costDeltaPct,
  type Insight,
  type InsightLevel,
  type WhaleMood,
} from "../core/index.js";
import type { AppData } from "../data/report.js";
import { formatBig, formatDelta, formatPct, formatYen, sparkline } from "./format.js";

/** 需要关注的展示项（Top N，异常优先）。 */
export interface AttentionVm {
  rank: number;
  id: string;
  /** 短英文标签（TOOL HEALTH / RETRY / RISK …）。 */
  tag: string;
  level: InsightLevel;
  title: string;
}

/** 洞察 id → 短标签（展示层映射，非统计逻辑）。 */
const TAG_OF: Record<string, string> = {
  "tool-health": "TOOL HEALTH",
  "retry-storm": "RETRY",
  "danger-red": "DANGER",
  "danger-amber": "RISK",
  "secret-hit": "SECRET",
  "cost-trend": "COST",
  "night-cost": "NIGHT",
  "cache-drop": "CACHE",
  "cache-good": "CACHE",
  "session-fragmentation": "FRAGMENT",
};

const LEVEL_WEIGHT: Record<InsightLevel, number> = { critical: 3, warning: 2, tip: 1, info: 0 };

/**
 * 需要关注 Top N：过滤 info（正常信息不抢位置），critical > warning > tip，
 * 同级保持 core 原始顺序（不重排洞察语义）。
 */
export function attentionOf(insights: readonly Insight[], max = 3): AttentionVm[] {
  return insights
    .filter((i) => LEVEL_WEIGHT[i.level] > 0)
    .sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level])
    .slice(0, max)
    .map((i, idx) => ({
      rank: idx + 1,
      id: i.id,
      tag: TAG_OF[i.id] ?? "NOTICE",
      level: i.level,
      title: i.title,
    }));
}

/** KPI 四指标（数字优先，label 弱化）。 */
export interface KpiVm {
  costText: string;
  /** 同比（弱 secondary）：▼ 93% / ▲ 75% / — */
  costDelta: string;
  sessions: number;
  tokensText: string;
  cacheRateText: string;
}

export interface TrendLineVm {
  title: string;
  spark: string;
  value: string;
  live: boolean;
}

export interface OverviewVm {
  periodLabel: string;
  /** 短周期标识（周报 → W34）。 */
  periodShort: string;
  live: boolean;
  kpi: KpiVm;
  attention: AttentionVm[];
  trend: TrendLineVm[];
  whaleMood: WhaleMood;
  /** 鲸评短版（2 行）/ 完整版（Enter 展开）。 */
  whaleNoteShort: { text: string; kind: string }[];
  whaleNoteFull: { text: string; kind: string }[];
}

/** 周期短标识：wk-2026-W34 → W34；其余 → 起止日期。 */
export function periodShortOf(app: AppData): string {
  const key = app.periodKey;
  const m = /W\d{2}/.exec(key);
  if (m !== null) return m[0];
  const d = (ms: number) => `${String(new Date(ms).getMonth() + 1).padStart(2, "0")}-${String(new Date(ms).getDate()).padStart(2, "0")}`;
  return `${d(app.stats.period.from)} ~ ${d(app.stats.period.to)}`;
}

/** 趋势压缩：4 行（成本/会话/Cache/夜间），只给方向感。 */
export function trendLines(app: AppData, ascii = false): TrendLineVm[] {
  const t = app.trend;
  const line = (
    title: string,
    fmt: (p: (typeof t)[number]) => string,
    num: (p: (typeof t)[number]) => number,
  ): TrendLineVm => ({
    title,
    spark: sparkline(t.map(num), 8, ascii),
    value: fmt(t[t.length - 1]),
    live: t[t.length - 1]?.live ?? false,
  });
  return [
    line("成本", (p) => formatYen(p.cost), (p) => p.cost),
    line("会话", (p) => String(p.sessions), (p) => p.sessions),
    line("Cache", (p) => formatPct(p.cacheRate), (p) => p.cacheRate),
    line("夜间", (p) => formatPct(p.nightRatio, 0), (p) => p.nightRatio),
  ];
}

/** 鲸评短版：开场白 + 第一条正文（≤2 行）；完整版 = 全部。 */
export function whaleNoteSplit(app: AppData): { short: { text: string; kind: string }[]; full: { text: string; kind: string }[] } {
  const lines = app.whale.lines;
  const opener = lines.find((l) => l.kind === "opener");
  const body = lines.find((l) => l.kind === "body");
  const short = [opener, body].filter((l): l is NonNullable<typeof l> => l !== undefined).slice(0, 2);
  return { short, full: lines };
}

export function buildOverviewVm(app: AppData, attentionMax = 3, ascii = false): OverviewVm {
  const stats = app.stats;
  const t = stats.tokens;
  const delta = costDeltaPct({ stats, prev: app.prev ?? undefined, cost: app.cost });
  const note = whaleNoteSplit(app);
  return {
    periodLabel: app.periodLabel,
    periodShort: periodShortOf(app),
    live: app.live,
    kpi: {
      costText: formatYen(app.cost.total),
      costDelta: formatDelta(delta, ascii),
      sessions: stats.sessions,
      tokensText: formatBig(t.input + t.output + t.cacheRead + t.reasoning),
      cacheRateText: formatPct(cacheHitRate(stats)),
    },
    attention: attentionOf(app.insights, attentionMax),
    trend: trendLines(app, ascii),
    whaleMood: app.whale.mood,
    whaleNoteShort: note.short,
    whaleNoteFull: note.full,
  };
}
