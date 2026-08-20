/**
 * 视图模型：工具健康（纯函数）。
 * 排序口径与 Web 版第 9 条洞察一致：异常工具优先（关注度 = failed × (1+failureRate)），
 * 其余按调用数降序。
 */
import { TOOL_HEALTH_MIN_CALLS, TOOL_HEALTH_MIN_FAILED, TOOL_HEALTH_MIN_FAILURE_RATE, type ReportStats, type ToolHealth } from "../core/index.js";
import { addTally, emptyTally, faultSideOf, faultVerdict, tallyFaults, type FaultSide, type FaultTally, type FaultVerdict } from "./fault.js";
import { bar10, formatDuration, formatPct } from "./format.js";

export interface ToolErrorCode {
  code: string;
  count: number;
  side: FaultSide;
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
  /** 原始毫秒值，供耗时排行按 p95 排序与画比例条。 */
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  bar: string;
  attention: number;
  anomaly: boolean;
  errorCodes: ToolErrorCode[];
  fault: FaultTally;
  verdict: FaultVerdict;
}

/** 工具健康的三档分组。屏幕顺序 = anomalies → failing → normal。 */
export interface ToolTiers {
  /**
   * 达异常门槛。口径来自 core 的 TOOL_HEALTH_MIN_* 常量
   * （当前 ≥30 次调用、≥5 次失败、失败率 ≥8%），不在 TUI 内另写一份。
   * must stay aligned with core insight thresholds.
   */
  anomalies: ToolVm[];
  /** 有失败但未达门槛 —— 最需要看清错误码的一档。 */
  failing: ToolVm[];
  /** 零失败。 */
  normal: ToolVm[];
  /**
   * 按屏幕顺序拼平的全量列表。**这是选中索引的唯一真相源**：
   * 渲染顺序、j/k 计数、高亮判定、动作目标全部以它为准。
   * 视图里不允许再各自 filter 一遍 —— 那样两边顺序会悄悄分叉。
   */
  flat: ToolVm[];
}

export interface ToolsVm {
  tools: ToolVm[];
  /** 三档分组 + 拼平顺序（选中索引口径）。 */
  tiers: ToolTiers;
  totalCalls: number;
  totalFailed: number;
  totalIncomplete: number;
  /** 全期归因合计（按错误码计数，非按工具）。 */
  fault: FaultTally;
  /** 全期结论：一眼看出是调用侧还是执行侧。 */
  verdict: FaultVerdict;
  /** 异常工具数量，用于标题右侧摘要。 */
  anomalyCount: number;
}

/** 与 core 洞察同门槛的异常判定。 */
export function isAnomaly(t: ToolHealth): boolean {
  return (
    t.calls >= TOOL_HEALTH_MIN_CALLS &&
    t.failed >= TOOL_HEALTH_MIN_FAILED &&
    t.failureRate >= TOOL_HEALTH_MIN_FAILURE_RATE
  );
}

/**
 * 三档划分 + 拼平。屏幕顺序在这里定义一次，视图与键盘都读它。
 * tools 已按「异常优先 → 关注度 → 调用数」排好序，这里只做分档，不重排。
 */
export function tierOf(tools: readonly ToolVm[]): ToolTiers {
  const anomalies = tools.filter((x) => x.anomaly);
  const failing = tools.filter((x) => !x.anomaly && x.failed > 0);
  const normal = tools.filter((x) => !x.anomaly && x.failed === 0);
  return { anomalies, failing, normal, flat: [...anomalies, ...failing, ...normal] };
}

export function buildToolsVm(stats: ReportStats, ascii = false): ToolsVm {
  const tools = stats.toolHealth
    .map((t) => {
      const attention = t.failed * (1 + t.failureRate);
      // 归因用全部错误码，展示只取前 5，避免结论被截断影响。
      const fault = tallyFaults(t.errorCodes);
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
        avgMs: t.avgDurationMs,
        p50Ms: t.p50DurationMs,
        p95Ms: t.p95DurationMs,
        bar: bar10(1 - t.failureRate, ascii),
        attention,
        anomaly: isAnomaly(t),
        errorCodes: Object.entries(t.errorCodes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([code, count]) => ({ code, count, side: faultSideOf(code) })),
        fault,
        verdict: faultVerdict(fault, t.incomplete, ascii),
      };
    })
    .sort((a, b) => {
      if (a.anomaly !== b.anomaly) return a.anomaly ? -1 : 1;
      if (a.attention !== b.attention) return b.attention - a.attention;
      return b.calls - a.calls;
    });
  const fault = emptyTally();
  let totalIncomplete = 0;
  let anomalyCount = 0;
  for (const t of tools) {
    addTally(fault, t.fault);
    totalIncomplete += t.incomplete;
    if (t.anomaly) anomalyCount += 1;
  }
  return {
    tools,
    tiers: tierOf(tools),
    totalCalls: stats.toolCallsTotal,
    totalFailed: stats.toolErrors,
    totalIncomplete,
    fault,
    verdict: faultVerdict(fault, totalIncomplete, ascii),
    anomalyCount,
  };
}
