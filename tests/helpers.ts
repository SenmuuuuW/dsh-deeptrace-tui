/**
 * 测试辅助：合成事件 + AppData 工厂（不触网、确定性）。
 */
import {
  aggregate,
  buildWhaleNote,
  type RawEvent,
  type RawSessionHeader,
  type ReportStats,
  type ToolHealth,
} from "../src/core/index.js";
import type { AppData } from "../src/data/report.js";

/** 合成一周内的会话事件（确定性时间轴）。 */
export function makeEvents(): { events: RawEvent[]; headers: RawSessionHeader[] } {
  const t0 = Date.UTC(2026, 7, 11, 9, 0, 0);
  const headers: RawSessionHeader[] = [{ id: "s1", createdAt: t0, cwd: "/workspace" }];
  const events: RawEvent[] = [];
  const ev = (type: string, time: number, data: Record<string, unknown> = {}): RawEvent => ({
    type,
    time,
    data: { sessionId: "s1", ...data },
  });
  // 回合 1：消息 + 请求 + 用量
  events.push(ev("turn/start", t0));
  events.push(ev("user/message", t0 + 1000, { content: [{ type: "text", text: "帮我调研 DSH 插件生态" }] }));
  events.push(ev("request/header", t0 + 2000, { header: { config: { model: "deepseek-v4-flash", provider: "deepseek" } } }));
  events.push(ev("assistant/message", t0 + 3000, { usage: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 8000, reasoningTokens: 100 } }));
  // 工具：bash 成功
  events.push(ev("tool/call", t0 + 4000, { name: "bash", arguments: JSON.stringify({ command: "ls -la" }), callId: "c1" }));
  events.push(ev("tool/result", t0 + 5000, { message: { source: { callId: "c1" }, content: "ok" } }));
  // 工具：edit 失败（错误码）
  events.push(ev("tool/call", t0 + 6000, { name: "edit", arguments: JSON.stringify({ file: "a.ts" }), callId: "c2" }));
  events.push(ev("tool/result", t0 + 7000, { error: { code: "FS_NOT_OBSERVED" }, message: { source: { callId: "c2" }, content: "file not observed" } }));
  // 回合 2：重试风暴（同一命令连续 3 次）
  events.push(ev("turn/start", t0 + 8000));
  for (let i = 0; i < 3; i++) {
    events.push(ev("tool/call", t0 + 9000 + i * 1000, { name: "bash", arguments: JSON.stringify({ command: "pnpm install" }), callId: `r${i}` }));
  }
  // 危险命令（amber）
  events.push(ev("tool/call", t0 + 20000, { name: "bash", arguments: JSON.stringify({ command: "git push --force" }), callId: "d1" }));
  // 疑似密钥（user 消息）
  events.push(ev("user/message", t0 + 21000, { content: [{ type: "text", text: "token 是 sk-1234567890123456789012，别外传" }] }));
  events.push(ev("session/title", t0 + 22000, { title: "调研 DSH 插件生态" }));
  return { events, headers };
}

/** 合成 stats（确定性：与 Web 版同一 aggregate 引擎）。 */
export function makeStats(now = Date.UTC(2026, 7, 17, 12, 0, 0)): ReportStats {
  const { events, headers } = makeEvents();
  return aggregate(events, { from: now - 7 * 86400000, to: now }, headers);
}

const TREND = [
  { label: "W30", from: 0, to: 1, live: false, cost: 10, sessions: 5, cacheRate: 90, nightRatio: 5, events: 100, totalTokens: 1_000_000 },
  { label: "W31", from: 1, to: 2, live: false, cost: 20, sessions: 10, cacheRate: 95, nightRatio: 8, events: 200, totalTokens: 2_000_000 },
  { label: "W32", from: 2, to: 3, live: false, cost: 30, sessions: 15, cacheRate: 97, nightRatio: 10, events: 300, totalTokens: 3_000_000 },
  { label: "W33", from: 3, to: 4, live: false, cost: 25, sessions: 12, cacheRate: 98, nightRatio: 12, events: 250, totalTokens: 2_500_000 },
  { label: "LIVE", from: 4, to: 5, live: true, cost: 38.6, sessions: 20, cacheRate: 99, nightRatio: 14, events: 400, totalTokens: 4_000_000 },
];

/**
 * 三档齐全的 toolHealth 夹具：异常 3 / 有失败 4 / 零失败 9。
 *
 * 默认夹具（makeStats）只有 edit + bash 两个工具，撑不出跨档 j/k 和窗口滚动 ——
 * 交互验收必须有足够条目把每一档都压到需要 windowSlice 截断的程度。
 *
 * 门槛口径来自 core（insights.ts 的实际常量值，不是注释里写的那套）：
 *   TOOL_HEALTH_MIN_CALLS=30 / MIN_FAILED=5 / MIN_FAILURE_RATE=0.08
 * 三者同时满足才是异常档。write 刻意压在 30/5/0.167 的边界上。
 */
export function makeTieredStats(now = Date.UTC(2026, 7, 17, 12, 0, 0)): ReportStats {
  const th = (
    name: string,
    calls: number,
    failed = 0,
    errorCodes: Record<string, number> = {},
  ): ToolHealth => ({
    name,
    calls,
    completed: calls - failed,
    failed,
    incomplete: 0,
    successRate: calls === 0 ? 0 : (calls - failed) / calls,
    failureRate: calls === 0 ? 0 : failed / calls,
    avgDurationMs: 100 + calls,
    p50DurationMs: 80 + calls,
    p95DurationMs: 400 + calls * 10,
    errorCodes,
  });
  const toolHealth: ToolHealth[] = [
    // 异常档：calls>=30 且 failed>=5 且 rate>=0.08 全部满足
    th("fetch", 60, 20, { ETIMEDOUT: 12, ECONNRESET: 8 }),
    th("edit", 40, 8, { FS_NOT_OBSERVED: 6, EACCES: 2 }),
    th("write", 30, 5, { ENOENT: 5 }),
    // 有失败但未达门槛：各差一个条件
    th("bash", 60, 2, { ENOENT: 2 }),           // rate 0.033 < 0.08
    th("grep", 80, 4, { EAGAIN: 4 }),           // failed 4 < 5
    th("glob", 20, 6, { UNKNOWN_WEIRD: 6 }),    // calls 20 < 30
    th("read", 25, 1, { EPERM: 1 }),            // calls/failed/rate 均不足
    // 零失败
    th("ls", 50), th("todo", 44), th("task", 38), th("web", 33), th("apply", 29),
    th("diff", 24), th("stat", 19), th("hash", 12), th("noop", 6),
  ];
  const base = makeStats(now);
  return { ...base, toolHealth };
}

export function makeAppData(stats: ReportStats, overrides: Partial<AppData> = {}): AppData {
  return {
    preset: "weekly",
    periodLabel: "周报",
    periodKey: "wk-2026-W34",
    live: true,
    stats,
    cost: { perModel: {}, total: 38.6, currency: "CNY", source: "builtin", fetchedAt: 0 },
    prev: { cost: 20, sessions: 10, cacheHitRate: 95, nightRatio: 8 },
    insights: [],
    collab: [],
    trend: TREND,
    whale: { mood: "happy", kinds: [], lines: buildWhaleNote([], "happy"), n: 0 },
    generatedAt: Date.UTC(2026, 7, 17, 10, 0, 0),
    archive: { files: 97, events: 76_747, sessions: 40, loadMs: 123 },
    ...overrides,
  };
}
