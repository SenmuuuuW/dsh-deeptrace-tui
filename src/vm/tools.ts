/**
 * 视图模型：工具健康（纯函数）。
 * 排序口径与 Web 版第 9 条洞察一致：异常工具优先（关注度 = failed × (1+failureRate)），
 * 其余按调用数降序。
 */
import { TOOL_HEALTH_MIN_CALLS, TOOL_HEALTH_MIN_FAILED, TOOL_HEALTH_MIN_FAILURE_RATE, type ReportStats, type ToolHealth } from "../core/index.js";
import { bar10, formatDuration, formatPct } from "./format.js";

export interface ToolErrorCode {
  code: string;
  count: number;
}

export interface ToolVm {
  name: string;
  calls: number;
  completed: number;
  failed: number;
  incomplete: number;
  successRateText: string;
  failureRateText: string;
  avgDurationText: string;
  p50Text: string;
  p95Text: string;
  bar: string;
  attention: number;
  anomaly: boolean;
  errorCodes: ToolErrorCode[];
}

export interface ToolsVm {
  tools: ToolVm[];
  totalCalls: number;
  totalFailed: number;
}

/** 与 core 洞察同门槛的异常判定。 */
export function isAnomaly(t: ToolHealth): boolean {
  return (
    t.calls >= TOOL_HEALTH_MIN_CALLS &&
    t.failed >= TOOL_HEALTH_MIN_FAILED &&
    t.failureRate >= TOOL_HEALTH_MIN_FAILURE_RATE
  );
}

export function buildToolsVm(stats: ReportStats): ToolsVm {
  const tools = stats.toolHealth
    .map((t) => {
      const attention = t.failed * (1 + t.failureRate);
      return {
        name: t.name,
        calls: t.calls,
        completed: t.completed,
        failed: t.failed,
        incomplete: t.incomplete,
        successRateText: formatPct(t.successRate * 100, 1),
        failureRateText: formatPct(t.failureRate * 100, 1),
        avgDurationText: formatDuration(t.avgDurationMs),
        p50Text: formatDuration(t.p50DurationMs),
        p95Text: formatDuration(t.p95DurationMs),
        bar: bar10(1 - t.failureRate),
        attention,
        anomaly: isAnomaly(t),
        errorCodes: Object.entries(t.errorCodes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([code, count]) => ({ code, count })),
      };
    })
    .sort((a, b) => {
      if (a.anomaly !== b.anomaly) return a.anomaly ? -1 : 1;
      if (a.attention !== b.attention) return b.attention - a.attention;
      return b.calls - a.calls;
    });
  return {
    tools,
    totalCalls: stats.toolCallsTotal,
    totalFailed: stats.toolErrors,
  };
}
