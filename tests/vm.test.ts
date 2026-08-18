import { describe, expect, it } from "vitest";
import type { ReportStats } from "../src/core/index.js";
import { makeAppData, makeStats } from "./helpers.js";
import { bar10, formatDelta, formatDuration, formatPct, formatYen, sparkline } from "../src/vm/format.js";
import { attentionOf, buildOverviewVm, periodShortOf, trendLines, whaleNoteSplit } from "../src/vm/overview.js";
import { buildToolsVm } from "../src/vm/tools.js";
import { buildTraceVm } from "../src/vm/trace.js";
import { buildHistoryVm, historyRows, metricText, metricValue } from "../src/vm/history.js";

describe("format", () => {
  it("formatYen / formatPct / formatDelta", () => {
    expect(formatYen(38.6)).toBe("¥38.60");
    expect(formatPct(99.4)).toBe("99.4%");
    expect(formatDelta(75)).toBe("▲ 75%");
    expect(formatDelta(-20)).toBe("▼ 20%");
    expect(formatDelta(null)).toBe("—");
  });

  it("formatDuration", () => {
    expect(formatDuration(71)).toBe("71ms");
    expect(formatDuration(6700)).toBe("6.7s");
  });

  it("sparkline 全零 → 等宽点阵", () => {
    expect(sparkline([0, 0, 0], 5)).toBe("·····");
  });

  it("sparkline 归一化使用最大值", () => {
    const s = sparkline([0, 5, 10], 6);
    expect(s).toHaveLength(6);
    expect(s[0]).toBe("▁");
    expect(s[5]).toBe("█");
  });

  it("bar10", () => {
    expect(bar10(1)).toBe("██████████");
    expect(bar10(0)).toBe("░░░░░░░░░░");
    expect(bar10(0.5)).toBe("█████░░░░░");
  });
});

describe("overview vm", () => {
  it("buildOverviewVm：KPI 四指标 + 压缩趋势", () => {
    const vm = buildOverviewVm(makeAppData(makeStats()));
    expect(vm.kpi.costText).toBe("¥38.60");
    expect(vm.kpi.costDelta).toBe("▲ 93%");
    expect(vm.kpi.sessions).toBeGreaterThan(0);
    expect(vm.trend).toHaveLength(4);
    expect(vm.trend[0].title).toBe("成本");
    expect(vm.trend[0].spark.length).toBe(8);
    expect(vm.trend[0].value.length).toBeGreaterThan(0);
  });

  it("attentionOf：info 不占位，critical > warning > tip，Top N", () => {
    const insights = [
      { id: "cache-good", level: "info" as const, title: "缓存命中率良好", detail: "", action: "" },
      { id: "i2", level: "tip" as const, title: "提示项", detail: "", action: "" },
      { id: "i1", level: "critical" as const, title: "致命项", detail: "", action: "" },
      { id: "i3", level: "warning" as const, title: "警告项", detail: "", action: "" },
      { id: "i4", level: "tip" as const, title: "提示项2", detail: "", action: "" },
    ];
    const a = attentionOf(insights, 3);
    expect(a).toHaveLength(3);
    expect(a.map((x) => x.title)).toEqual(["致命项", "警告项", "提示项"]);
    expect(a[0].tag).toBe("NOTICE");
    expect(a[0].rank).toBe(1);
  });

  it("attentionOf：id → 英文短标签", () => {
    const a = attentionOf([{ id: "tool-health", level: "warning" as const, title: "工具 edit 失败", detail: "", action: "" }], 3);
    expect(a[0].tag).toBe("TOOL HEALTH");
  });

  it("periodShortOf：wk-2026-W34 → W34", () => {
    const app = makeAppData(makeStats());
    expect(periodShortOf(app)).toBe("W34");
  });

  it("trendLines / whaleNoteSplit：方向感 + 短鲸评", () => {
    const app = makeAppData(makeStats());
    const lines = trendLines(app);
    expect(lines[3].title).toBe("夜间");
    const note = whaleNoteSplit(app);
    expect(note.short.length).toBeGreaterThan(0);
    expect(note.short.length).toBeLessThanOrEqual(2);
    expect(note.full.length).toBeGreaterThanOrEqual(note.short.length);
  });
});

describe("tools vm", () => {
  const stats = {
    toolCallsTotal: 3515,
    toolErrors: 13,
    toolHealth: [
      { name: "bash", calls: 3515, completed: 3502, failed: 13, incomplete: 0, successRate: 0.996, failureRate: 0.0037, avgDurationMs: 6700, p50DurationMs: 3000, p95DurationMs: 37800, errorCodes: { TOOL_OUTCOME_UNKNOWN: 13 } },
      { name: "edit", calls: 543, completed: 490, failed: 53, incomplete: 0, successRate: 0.902, failureRate: 0.098, avgDurationMs: 71, p50DurationMs: 50, p95DurationMs: 240, errorCodes: { FS_NOT_OBSERVED: 26, FS_STALE_VERSION: 19, FS_EDIT_NOT_FOUND: 8 } },
    ],
  } as unknown as ReportStats;

  it("异常工具优先（与 core 洞察同门槛）", () => {
    const vm = buildToolsVm(stats);
    expect(vm.tools[0].name).toBe("edit");
    expect(vm.tools[0].anomaly).toBe(true);
    expect(vm.tools[1].anomaly).toBe(false);
    expect(vm.tools[0].errorCodes[0]).toEqual({ code: "FS_NOT_OBSERVED", count: 26 });
  });

  it("失败率文本与条形", () => {
    const vm = buildToolsVm(stats);
    expect(vm.tools[0].failureRateText).toBe("9.8%");
    expect(vm.tools[0].bar).toBe("█████████░");
  });
});

describe("trace vm", () => {
  it("按费用排序、风险标记计数（含 secret 归属）", () => {
    const base = makeStats();
    const stats: ReportStats = {
      ...base,
      sessionsDetail: [
        { sessionId: "b", title: "B", firstTime: 1, lastTime: 2, events: 10, commands: 1, toolCalls: 3, retryBursts: 17, dangerCount: 5, redDanger: 1, modelTokens: { "deepseek/deepseek-v4-flash": { input: 1000, output: 1000, cacheRead: 0, reasoning: 0 } }, cost: 7.29, turns: 3, userMessages: 2, collabRevisions: 0, collabLateConstraints: 0 },
        { sessionId: "a", title: "A", firstTime: 1, lastTime: 2, events: 10, commands: 1, toolCalls: 3, retryBursts: 2, dangerCount: 0, redDanger: 0, modelTokens: {}, cost: 8.36, turns: 3, userMessages: 2, collabRevisions: 0, collabLateConstraints: 0 },
      ],
      secretHits: [{ label: "OpenAI 风格密钥", time: 1, source: "user", sessionId: "b" }],
    };
    const vm = buildTraceVm(stats);
    expect(vm.items).toHaveLength(2);
    expect(vm.items[0].sessionId).toBe("a"); // 费用高者在前
    expect(vm.items[0].costText).toBe("¥8.36");
    expect(vm.items[1].secrets).toBe(1);
    expect(vm.items[1].retries).toBe(17);
  });
});

describe("history vm", () => {
  it("单指标 × 5 周期 + 比例条形 + 按日活跃", () => {
    const app = makeAppData(makeStats());
    const vm = buildHistoryVm(app, "cost");
    expect(vm.rows).toHaveLength(5);
    expect(vm.rows[4].live).toBe(true);
    expect(vm.rows[4].valueText).toBe("¥38.60");
    expect(vm.rows[4].bar.length).toBeGreaterThan(0);
    expect(vm.daily.length).toBeGreaterThan(0);
    expect(vm.dailySpark.length).toBeGreaterThan(0);
  });

  it("指标切换：tokens / cache 文本口径", () => {
    const app = makeAppData(makeStats());
    expect(metricText(app.trend[4], "tokens")).toBe("4.00M");
    expect(metricText(app.trend[4], "cache")).toBe("99.0%");
    expect(metricValue(app.trend[4], "sessions")).toBe(20);
    const vm = buildHistoryVm(app, "cache");
    expect(vm.rows[0].valueText.length).toBeGreaterThan(0);
  });

  it("historyRows：全零周期 → 点阵条形", () => {
    const app = makeAppData(makeStats(), { trend: makeAppData(makeStats()).trend.map((t) => ({ ...t, cost: 0 })) });
    const rows = historyRows(app, "cost");
    expect(rows[0].bar).toBe("·".repeat(12));
  });
});
