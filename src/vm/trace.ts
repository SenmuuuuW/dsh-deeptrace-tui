/**
 * 视图模型：会话轨迹（纯函数）。
 * 排序口径与 Web 版一致：按折算费用降序，Top 20。
 */
import type { ReportStats, SessionDetail } from "../core/index.js";
import { formatBig, formatDateTime, formatYen } from "./format.js";

export interface TraceItemVm {
  rank: number;
  sessionId: string;
  title: string;
  costText: string;
  retries: number;
  dangerCount: number;
  redDanger: number;
  secrets: number;
  tokensText: string;
  toolCalls: number;
  firstTimeText: string;
  lastTimeText: string;
  turns: number;
  /**
   * 按模型的 token 拆分（降序）。tokens 本来就是逐模型加出来的，
   * 以前把拆分丢掉只留总数 —— inspector 里这份拆分正是"这次会话钱花在哪"的答案。
   */
  models: Array<{ name: string; tokens: number; tokensText: string; share: number }>;
}

export interface TraceVm {
  items: TraceItemVm[];
  total: number;
}

export function buildTraceVm(stats: ReportStats): TraceVm {
  // 防御性排序：按折算费用降序（与 Web 版 generateReportData 口径一致）。
  const sorted = [...stats.sessionsDetail].sort((a, b) => b.cost - a.cost);
  const items = sorted.map((d, idx) => {
    const t = d.modelTokens;
    let tokens = 0;
    const perModel: Array<{ name: string; tokens: number }> = [];
    for (const [name, usage] of Object.entries(t)) {
      const n = usage.input + usage.output + usage.cacheRead + usage.reasoning;
      tokens += n;
      if (n > 0) perModel.push({ name, tokens: n });
    }
    perModel.sort((a, b) => b.tokens - a.tokens);
    const models = perModel.map((m) => ({
      name: m.name,
      tokens: m.tokens,
      tokensText: formatBig(m.tokens),
      share: tokens > 0 ? m.tokens / tokens : 0,
    }));
    const secrets = stats.secretHits.filter((h) => h.sessionId === d.sessionId).length;
    return {
      rank: idx + 1,
      sessionId: d.sessionId,
      title: d.title || "(无标题)",
      costText: formatYen(d.cost),
      retries: d.retryBursts,
      dangerCount: d.dangerCount,
      redDanger: d.redDanger,
      secrets,
      tokensText: formatBig(tokens),
      toolCalls: d.toolCalls,
      firstTimeText: formatDateTime(d.firstTime),
      lastTimeText: formatDateTime(d.lastTime),
      turns: d.turns,
      models,
    };
  });
  return { items, total: stats.sessions };
}

export type { SessionDetail };
