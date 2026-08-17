/**
 * 报告控制器：把 SessionStore 的原始事件变成 TUI 的完整视图数据。
 *
 * 全部统计/洞察/计价/协作/周期语义来自 dsh-whale-report/core
 * （与 Web 版同一实现）。本模块只做编排：
 *   存档 → aggregate / computeCost / computeInsights / computeCollaborationInsights
 *        → buildWhaleNote / triggerNotes / whaleMood → AppData
 */
import {
  aggregateBuckets,
  cacheHitRate,
  computeCost,
  computeCollaborationInsights,
  computeInsights,
  getPrices,
  modelCost,
  modelTier,
  nightOwlIndex,
  OPENCODE_GO_PRICES,
  periodKey,
  presetRange,
  PRESET_LABELS,
  triggerNotes,
  whaleMood,
  buildWhaleNote,
  type CollaborationInsight,
  type CostBreakdown,
  type Insight,
  type NoteKind,
  type ReportPreset,
  type ReportStats,
  type WhaleMood,
} from "../core/index.js";
import type { SessionStore } from "./store.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PeriodTrendPoint {
  label: string;
  from: number;
  to: number;
  live: boolean;
  cost: number;
  sessions: number;
  cacheRate: number;
  nightRatio: number;
  events: number;
  totalTokens: number;
}

/** 上一周期对比基线（洞察引擎需要的最小字段）。 */
export interface PrevPeriod {
  cost: number;
  sessions: number;
  cacheHitRate: number;
  nightRatio: number;
}

export interface AppData {
  preset: ReportPreset;
  periodLabel: string;
  periodKey: string;
  live: boolean;
  stats: ReportStats;
  cost: CostBreakdown;
  prev: PrevPeriod | null;
  insights: Insight[];
  collab: CollaborationInsight[];
  trend: PeriodTrendPoint[];
  whale: { mood: WhaleMood; kinds: NoteKind[]; lines: ReturnType<typeof buildWhaleNote>; n: number };
  generatedAt: number;
  archive: { files: number; events: number; sessions: number; loadMs: number };
}

export type BuildPhase = "archive" | "aggregate" | "cost" | "trend" | "done";

export interface BuildProgress {
  phase: BuildPhase;
  message: string;
  /** 存档读取进度（可选）。 */
  done?: number;
  total?: number;
}

/** 会话钻取费用填充（与 Web 版 generateReportData 相同口径的编排代码）。 */
export async function fillSessionCosts(stats: ReportStats): Promise<void> {
  const { prices } = await getPrices();
  for (const detail of stats.sessionsDetail) {
    let total = 0;
    for (const [model, usage] of Object.entries(detail.modelTokens)) {
      const provider = model.includes("/") ? model.slice(0, model.indexOf("/")) : "deepseek";
      const priceSet = provider === "opencode-go" ? OPENCODE_GO_PRICES : prices;
      total += modelCost(usage, priceSet[modelTier(model)]);
    }
    detail.cost = total;
  }
  stats.sessionsDetail.sort((a, b) => b.cost - a.cost);
  stats.sessionsDetail = stats.sessionsDetail.slice(0, 20);
}

/** 周期范围序列：最近 n 个完整周期 + 当前（live）周期。 */
export function periodRanges(preset: ReportPreset, now: number, n = 4): { from: number; to: number; live: boolean }[] {
  const ranges: { from: number; to: number; live: boolean }[] = [];
  const current = presetRange(preset, now);
  ranges.push({ from: current.from, to: current.to, live: true });
  let cursor = current.from;
  for (let i = 0; i < n; i++) {
    if (preset === "24h") {
      const to = cursor;
      const from = to - DAY_MS;
      ranges.unshift({ from, to, live: false });
      cursor = from;
    } else {
      const d = new Date(cursor);
      switch (preset) {
        case "daily":
          d.setDate(d.getDate() - 1);
          break;
        case "weekly":
          d.setDate(d.getDate() - 7);
          break;
        case "monthly":
          d.setMonth(d.getMonth() - 1);
          break;
        case "yearly":
          d.setFullYear(d.getFullYear() - 1);
          break;
        case "custom":
          d.setDate(d.getDate() - 7);
          break;
      }
      const from = d.getTime();
      ranges.unshift({ from, to: cursor, live: false });
      cursor = from;
    }
  }
  return ranges;
}

/** 周期短标签（趋势图用；周标签按本地时区算 ISO 周，与用户感知一致）。 */
export function trendLabel(range: { from: number; to: number }, preset: ReportPreset): string {
  if (preset === "yearly") return new Date(range.from).getFullYear().toString();
  if (preset === "monthly") {
    const d = new Date(range.from);
    return `${d.getMonth() + 1}月`;
  }
  if (preset === "daily") {
    const d = new Date(range.from);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (preset === "weekly") {
    const d = new Date(range.from);
    const dayNum = d.getDay() === 0 ? 7 : d.getDay();
    const thursday = new Date(d);
    thursday.setDate(d.getDate() + 4 - dayNum);
    const yearStart = new Date(thursday.getFullYear(), 0, 1);
    const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `W${String(week).padStart(2, "0")}`;
  }
  const d = new Date(range.from);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 区间统计：分桶视图 → aggregateBuckets（与 Web 版 collectEvents 同一条路径）。
 * 候选过滤与 Web 一致：只统计 created_at 早于区间结束的会话。
 */
function statsForRange(store: SessionStore, from: number, to: number): ReportStats {
  const headers = store.headersList();
  const headerById = new Map(headers.map((h) => [h.id, h]));
  const views = store.viewsList().filter((v) => {
    const header = headerById.get(v.sessionId);
    // 无头文件（未知 session）按区间内处理；其余按 created_at < to 过滤。
    return header === undefined ? true : header.createdAt < to;
  });
  return aggregateBuckets(views, { from, to }, headers);
}

/** 构建完整视图数据（编排层；所有算法来自 core）。 */
export async function buildReport(
  store: SessionStore,
  preset: ReportPreset,
  now = Date.now(),
  onProgress?: (p: BuildProgress) => void,
): Promise<AppData> {
  const startedAt = Date.now();

  if (!store.isLoaded) {
    onProgress?.({ phase: "archive", message: "读取会话存档…" });
    await store.load(({ done, total }) =>
      onProgress?.({ phase: "archive", message: "读取会话存档…", done, total }),
    );
  }

  onProgress?.({ phase: "aggregate", message: "聚合本期数据…" });
  const range = presetRange(preset, now);
  const stats = statsForRange(store, range.from, range.to);
  await fillSessionCosts(stats);

  onProgress?.({ phase: "cost", message: "计算费用与洞察…" });
  const cost = await computeCost(stats.models);

  // 上一周期（洞察基线）：previousPeriodKey 语义 = 当前周期前一个完整周期。
  const ranges = periodRanges(preset, now);
  const prevRange = ranges[ranges.length - 2];
  let prev: PrevPeriod | null = null;
  if (preset !== "24h" && prevRange !== undefined) {
    const prevStats = statsForRange(store, prevRange.from, prevRange.to);
    const prevCost = await computeCost(prevStats.models);
    prev = {
      cost: prevCost.total,
      sessions: prevStats.sessions,
      cacheHitRate: cacheHitRate(prevStats),
      nightRatio: nightOwlIndex(prevStats),
    };
  }

  const insights = computeInsights({ stats, prev: prev ?? undefined, cost });
  const collab = computeCollaborationInsights({ ...stats.collab, sessions: stats.sessions });

  onProgress?.({ phase: "trend", message: "计算历史趋势…" });
  const trend: PeriodTrendPoint[] = [];
  for (const r of ranges) {
    const s = statsForRange(store, r.from, r.to);
    const c = await computeCost(s.models);
    const t = s.tokens;
    trend.push({
      label: trendLabel(r, preset),
      from: r.from,
      to: r.to,
      live: r.live,
      cost: c.total,
      sessions: s.sessions,
      cacheRate: cacheHitRate(s),
      nightRatio: nightOwlIndex(s),
      events: s.totalEvents,
      totalTokens: t.input + t.output + t.cacheRead + t.reasoning,
    });
  }

  // 鲸鱼娘：mood / 触发 / 鲸评（与 Web 同规则同文案）。
  const kinds = triggerNotes(stats);
  const mood = whaleMood(stats);
  const n = stats.retryBursts ?? 0;
  const whale = { mood, kinds, lines: buildWhaleNote(kinds, mood, "light", n), n };

  const archive = store.stats();
  onProgress?.({ phase: "done", message: "完成" });
  return {
    preset,
    periodLabel: PRESET_LABELS[preset],
    periodKey: periodKey(preset, range.to),
    live: true,
    stats,
    cost,
    prev,
    insights,
    collab,
    trend,
    whale,
    generatedAt: Date.now(),
    archive: { ...archive, loadMs: Date.now() - startedAt },
  };
}
