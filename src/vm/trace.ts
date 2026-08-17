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
    for (const usage of Object.values(t)) tokens += usage.input + usage.output + usage.cacheRead + usage.reasoning;
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
    };
  });
  return { items, total: stats.sessions };
}

export type { SessionDetail };
