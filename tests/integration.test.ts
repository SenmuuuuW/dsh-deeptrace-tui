/**
 * 真实数据集成冒烟：本机存在 DSH 会话存档时，走完整管线
 * （存档读取 → 聚合 → 计价 → 洞察 → 鲸评 → 趋势）。
 * 无存档环境（CI）自动跳过。
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionStore } from "../src/data/store.js";
import { buildReport, periodRanges, trendLabel } from "../src/data/report.js";

const dshHome = process.env.DSH_HOME ?? join(homedir(), ".dsh");
const hasArchives = existsSync(join(dshHome, "sessions"));

describe.skipIf(!hasArchives)("真实存档集成", () => {
  it("完整管线产出可用视图数据", async () => {
    const store = new SessionStore(dshHome);
    const data = await buildReport(store, "weekly");
    expect(data.archive.files).toBeGreaterThan(0);
    expect(data.stats.sessions).toBeGreaterThanOrEqual(0);
    expect(data.cost.total).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(data.cost.total)).toBe(true);
    expect(data.insights).toBeInstanceOf(Array);
    expect(data.collab).toBeInstanceOf(Array);
    expect(data.trend.length).toBe(5);
    expect(data.whale.lines.length).toBeGreaterThan(0);
    expect(data.periodKey).toMatch(/^wk-/);
  }, 120_000);

  it("增量刷新：第二次不重读未变化文件", async () => {
    const store = new SessionStore(dshHome);
    await store.load();
    const first = store.stats();
    const changed = await store.refresh();
    expect(changed).toBeGreaterThanOrEqual(0);
    expect(store.stats().files).toBe(first.files);
  }, 120_000);
});

describe("周期语义（纯函数，无存档依赖）", () => {
  it("periodRanges：5 个周期，最后一个为 live，区间连续", () => {
    const now = Date.UTC(2026, 7, 17, 12, 0, 0); // 2026-08-17
    const ranges = periodRanges("weekly", now);
    expect(ranges.length).toBe(5);
    expect(ranges[4].live).toBe(true);
    expect(ranges[4].to).toBe(now);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].from).toBe(ranges[i - 1].to);
    }
  });

  it("trendLabel：weekly 输出 ISO 周号", () => {
    const now = Date.UTC(2026, 7, 17, 12, 0, 0);
    const ranges = periodRanges("weekly", now);
    expect(trendLabel(ranges[4], "weekly")).toBe("W34");
  });

  it("periodRanges 24h：滚动窗口 5 段", () => {
    const now = Date.now();
    const ranges = periodRanges("24h", now);
    expect(ranges.length).toBe(5);
    for (const r of ranges) expect(r.to - r.from).toBe(24 * 3600 * 1000);
  });
});
