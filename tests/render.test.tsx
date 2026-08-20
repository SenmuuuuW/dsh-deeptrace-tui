import { describe, expect, it } from "vitest";
import { makeAppData, makeStats } from "./helpers.js";
import { Frame, windowSlice } from "../src/render/Frame.js";
import { renderToText } from "../src/render/headless.js";
import { resolveTheme } from "../src/render/theme.js";
import { layoutOf, widthBandOf, heightBandOf, CHROME_ROWS } from "../src/render/geometry.js";
import { chipsFor, ruleLine, BOX_GLYPHS } from "../src/render/chrome.js";
import { MARK_ROW_WIDTHS, TICK_WIDTH, WHALE_STATES, markRowWidth, mascotToText, whaleMascot } from "../src/render/whale/mascot.js";
import { displayWidth } from "../src/vm/format.js";
import { buildToolsVm } from "../src/vm/tools.js";
import type { View } from "../src/render/Frame.js";

type FrameOpts = {
  view?: View;
  width?: number;
  height?: number;
  selected?: number;
  detail?: number | null;
  noteOpen?: boolean;
  ascii?: boolean;
};

async function frameText({
  view = "overview", width = 100, height = 40, selected = 0, detail = null, noteOpen = false, ascii = false,
}: FrameOpts = {}): Promise<string> {
  const data = makeAppData(makeStats());
  return await renderToText(
    <Frame
      view={view}
      data={data}
      theme={resolveTheme(false, ascii)}
      width={width}
      height={height}
      selected={selected}
      detail={detail}
      noteOpen={noteOpen}
      helpOpen={false}
      loading={false}
      progress={null}
      error={null}
      flash={null}
      updatedAt={data.generatedAt}
      archiveInfo={`${data.archive.files} 存档`}
      historyMetric="cost"
    />,
    { width, height },
  );
}

/** 视口尺寸：终端行数 = 输出行数，列数不超过给定宽度。 */
function viewport(text: string): { rows: number; maxCols: number } {
  const lines = text.split("\n");
  return { rows: lines.length, maxCols: Math.max(...lines.map(displayWidth)) };
}

const VIEWS: View[] = ["overview", "tools", "trace", "collab", "history"];

const SIZES: [number, number][] = [
  [80, 24],
  [100, 30],
  [120, 40],
  [160, 50],
];

describe("无头渲染器", () => {
  it("宽度不再被钳到 100 列（ink-testing-library 的老问题）", async () => {
    const text = await frameText({ width: 160, height: 50 });
    expect(viewport(text).maxCols).toBeGreaterThan(120);
  });

  it("四种尺寸都精确占满终端高度、不超宽", async () => {
    for (const [w, h] of SIZES) {
      for (const view of VIEWS) {
        const vp = viewport(await frameText({ view, width: w, height: h }));
        expect(vp.rows, `${view} ${w}x${h} 行数`).toBe(h);
        expect(vp.maxCols, `${view} ${w}x${h} 列数`).toBeLessThanOrEqual(w);
      }
    }
  });
});

describe("工作台骨架", () => {
  it("顶栏常驻性质标识，宽屏给全量", async () => {
    const text = await frameText({ width: 160, height: 50 });
    expect(text).toContain("深迹 DEEPTRACE");
    expect(text).toContain("LIVE");
    expect(text).toContain("LOCAL");
    expect(text).toContain("DETERMINISTIC");
    expect(text).toContain("READ-ONLY");
  });

  it("chips 按优先级降级，永不超宽", () => {
    expect(chipsFor(true, 80)).toBe("LIVE · LOCAL · DETERMINISTIC · READ-ONLY");
    expect(chipsFor(true, 30)).toBe("LIVE · LOCAL · READ-ONLY");
    expect(chipsFor(true, 20)).toBe("LIVE · READ-ONLY");
    expect(chipsFor(true, 6)).toBe("LIVE");
    for (const max of [6, 10, 20, 30, 80]) {
      expect(displayWidth(chipsFor(true, max))).toBeLessThanOrEqual(Math.max(max, 4));
    }
  });

  it("chips 不含歧义宽度字符（●/○ 在 CJK 终端会占 2 列）", () => {
    for (const live of [true, false]) {
      expect(chipsFor(live, 80)).not.toMatch(/[●○]/);
    }
  });

  it("结构线宽度恒等于终端宽度，接头落在竖线列", () => {
    for (const [w, h] of SIZES) {
      const layout = layoutOf(w, h);
      const line = ruleLine(layout, BOX_GLYPHS, "down");
      expect(displayWidth(line), `${w}x${h}`).toBe(w);
      if (layout.railShown) {
        expect([...line][layout.mainWidth + 1]).toBe(BOX_GLYPHS.down);
      }
    }
  });

  it("窄屏（80 列）不显示诊断区，宽屏显示", () => {
    expect(layoutOf(80, 24).railShown).toBe(false);
    expect(layoutOf(100, 30).railShown).toBe(true);
    expect(layoutOf(160, 50).railShown).toBe(true);
  });

  it("主体高度 = 终端高度 - 固定 chrome 行数", () => {
    for (const [w, h] of SIZES) {
      expect(layoutOf(w, h).bodyHeight).toBe(h - CHROME_ROWS);
    }
  });

  it("档位分界", () => {
    expect(widthBandOf(80)).toBe("compact");
    expect(widthBandOf(100)).toBe("standard");
    expect(widthBandOf(160)).toBe("wide");
    expect(heightBandOf(24)).toBe("low");
    expect(heightBandOf(30)).toBe("normal");
    expect(heightBandOf(50)).toBe("tall");
  });
});

describe("诊断区（常驻）", () => {
  it("五个视图都带诊断区：本期 KPI + 需要关注 + 工具健康", async () => {
    for (const view of VIEWS) {
      const text = await frameText({ view, width: 120, height: 40 });
      expect(text, view).toContain("本期");
      expect(text, view).toContain("需要关注");
      expect(text, view).toContain("工具健康");
      expect(text, view).toContain("观察员");
    }
  });

  it("窄屏无诊断区时，KPI 与需要关注回到主区", async () => {
    const text = await frameText({ view: "overview", width: 80, height: 24 });
    expect(text).toContain("需要关注");
    expect(text).toContain("Cache");
  });
});

describe("视图内容", () => {
  it("总览：工作节奏 + 主要会话 + 趋势", async () => {
    const text = await frameText({ view: "overview", width: 120, height: 40 });
    expect(text).toContain("工作节奏");
    expect(text).toContain("主要会话");
    expect(text).toContain("趋势");
    expect(text).toContain("¥38.60");
  });

  it("总览：Enter 展开鲸评占满主区", async () => {
    const text = await frameText({ view: "overview", noteOpen: true, width: 120, height: 40 });
    expect(text).toContain("鲸评");
  });

  it("工具健康：先给判定方向，再给证据", async () => {
    const text = await frameText({ view: "tools", width: 120, height: 40 });
    expect(text).toContain("判定");
    expect(text).toMatch(/调用侧|执行侧|未归因|没有失败调用/);
    expect(text).toContain("次调用");
  });

  it("工具健康：错误码原样展示（不改写、不编造语义）", async () => {
    const text = await frameText({ view: "tools", width: 160, height: 50 });
    expect(text).toContain("FS_NOT_OBSERVED");
  });

  it("工具健康：有失败但未达门槛的工具，错误码不被双列挤成残串", async () => {
    // 这一档以前混在双列压缩表里，~58 列的列宽会把错误码截断，还会把整行顶出容器换行。
    for (const [w, h] of SIZES) {
      if (w < 100) continue;
      const text = await frameText({ view: "tools", width: w, height: h });
      expect(text, `${w}x${h}`).toContain("有失败（未达门槛）");
      // 完整错误码必须完整出现在某一行里，不能带截断省略号。
      const line = text.split("\n").find((l) => l.includes("FS_NOT_OBSERVED"));
      expect(line, `${w}x${h} 应有含完整错误码的行`).toBeDefined();
      expect(line!, `${w}x${h}`).not.toContain("FS_NOT_OBSERV…");
    }
  });

  it("工具健康：耗时排行用真实 p95 填满余量，不留大片空白", async () => {
    const text = await frameText({ view: "tools", width: 120, height: 40 });
    expect(text).toContain("耗时排行");
    expect(text).toContain("按 p95 降序");
    // 排行必须降序：第一行的 p95 不小于后面任何一行。
    const rows = text.split("\n");
    const start = rows.findIndex((l) => l.includes("耗时排行"));
    expect(start).toBeGreaterThan(0);
    const body = rows.slice(start + 1).filter((l) => /p50 /.test(l));
    // 期望条数由 fixture 决定：有 p95 的工具全部上榜（不超过余量）。
    const withP95 = buildToolsVm(makeStats()).tools.filter((t) => t.p95Ms > 0).length;
    expect(withP95).toBeGreaterThan(0);
    expect(body.length).toBe(withP95);
  });

  it("会话轨迹：宽屏列表 + 详情常显", async () => {
    const text = await frameText({ view: "trace", width: 160, height: 50 });
    expect(text).toContain("会话详情");
    expect(text).toContain("费用");
    expect(text).toContain("c 复制 Session ID");
  });

  it("会话轨迹：窄屏 Enter 进详情", async () => {
    const text = await frameText({ view: "trace", width: 80, height: 24, detail: 0 });
    expect(text).toContain("会话详情");
    expect(text).toContain("Esc 返回列表");
  });

  it("协作复盘：样本不足也给信号来源，不空屏", async () => {
    const text = await frameText({ view: "collab", width: 120, height: 40 });
    expect(text).toContain("协作复盘");
    expect(text).toContain("样本不足");
    expect(text).toContain("信号来源");
    expect(text).toContain("方向修正");
  });

  it("历史趋势：指标切换条 + 全指标一览 + 按日活跃", async () => {
    const text = await frameText({ view: "history", width: 120, height: 40 });
    expect(text).toContain("历史趋势");
    expect(text).toContain("成本");
    expect(text).toContain("LIVE");
    expect(text).toContain("按日活跃");
    expect(text).toContain("全指标一览");
  });
});

describe("ASCII 降级", () => {
  it("--ascii 下不出现 box-drawing / 半块字符", async () => {
    for (const [w, h] of SIZES) {
      const text = await frameText({ width: w, height: h, ascii: true });
      expect(text, `${w}x${h}`).not.toMatch(/[─-╿▀-▟]/);
    }
  });

  it("--ascii 下不出现歧义宽度的图形符号", async () => {
    // 中日韩文字本身是 Wide，宽度确定，不在此列；这里针对 Ambiguous 类图形符号。
    // · (U+00B7) 是全局分隔符，暂不在此列 —— 见下一条：它只在右对齐的定宽区域才会真的推歪布局，
    // 那些位置（chips）已单独保证为半宽。
    // — (U+2014) 也在此列：它是空值占位符，常落在右对齐的数值列里，算错 1 列会整列推歪。
    const AMBIGUOUS = /[●○×↑↓↻→←■□▪▫◆◇★☆▲▼△▽—]/;
    for (const [w, h] of SIZES) {
      for (const view of VIEWS) {
        const text = await frameText({ view, width: w, height: h, ascii: true });
        const bad = text.split("\n").find((l) => AMBIGUOUS.test(l));
        expect(bad, `${view} ${w}x${h}`).toBeUndefined();
      }
    }
  });

  it("--ascii 下 chrome（顶栏 / 状态栏）不含 ambiguous 分隔符", async () => {
    // ASCII safety applies to any width-measured / fixed-width / truncated /
    // aligned text path —— 不只是 chrome。判据是「这段字符串会不会被量宽」：
    // truncateWidth / padStartWidth / padEndWidth / 定宽列 / 右对齐 chrome /
    // wrap="truncate"（Ink 用 string-width 量）都算。
    // · 若在 CJK locale 终端按 2 列渲染，整行会溢出换行、把帧顶掉一行，
    // 精确占高的保证随之失效。
    // 这条用例只钉顶栏 / 状态栏这两行（最容易回归、也最好定位）；
    // 全量覆盖由 pessimistic width audit 负责。
    for (const [w, h] of SIZES) {
      for (const view of VIEWS) {
        const lines = (await frameText({ view, width: w, height: h, ascii: true })).split("\n");
        const chrome = [lines[0], lines[lines.length - 1]];
        for (const line of chrome) {
          expect(line, `${view} ${w}x${h}: ${line}`).not.toMatch(/·/);
        }
      }
    }
  });

  it("--ascii 下右对齐定宽区域（chips）连分隔符都是半宽", () => {
    for (const live of [true, false]) {
      for (const max of [6, 20, 30, 80]) {
        const chips = chipsFor(live, max, true);
        expect(chips, `live=${live} max=${max}`).toMatch(/^[\x20-\x7E]*$/);
        expect(displayWidth(chips)).toBeLessThanOrEqual(Math.max(max, 8));
      }
    }
  });
});

describe("鲸鱼观察员", () => {
  it("六种状态轮廓完全一致（只有五官变）", () => {
    const shapes = new Set(WHALE_STATES.map((s) => mascotToText(s).map((r) => r.length).join("/")));
    expect(shapes.size).toBe(1);
  });

  it("每行宽度锁定在契约上（box 与 ascii 都一样）", () => {
    for (const ascii of [false, true]) {
      for (const state of WHALE_STATES) {
        const m = whaleMascot(state, ascii);
        expect(m.rows.map(markRowWidth), `${state} ascii=${ascii}`).toEqual([...MARK_ROW_WIDTHS]);
        expect(markRowWidth(m.tick), `${state} tick ascii=${ascii}`).toBe(TICK_WIDTH);
      }
    }
  });

  it("五官只用半宽 ASCII（歧义宽度字符会把画面推歪）", () => {
    for (const state of WHALE_STATES) {
      const faces = whaleMascot(state).rows.flat().filter((s) => s.role === "face");
      expect(faces.length).toBeGreaterThan(0);
      for (const f of faces) {
        expect(displayWidth(f.text), `${state} ${f.text}`).toBe(f.text.length);
        expect(f.text).toMatch(/^[\x20-\x7E]+$/);
      }
    }
  });

  it("状态是双通道：颜色之外还有中文文字标签", () => {
    for (const state of WHALE_STATES) {
      expect(whaleMascot(state).label).not.toBe("");
    }
  });

  it("小尺寸终端降级：矮屏用一行 tick，极矮不显示", () => {
    expect(layoutOf(120, 40).mascot).toBe("mark");
    expect(layoutOf(120, 24).mascot).toBe("tick");
    expect(layoutOf(120, 18).mascot).toBe("none");
  });
});

describe("windowSlice", () => {
  it("窗口滚动：选中项保持在可见窗口内", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const w = windowSlice(items, 18, 5);
    expect(w.slice).toEqual([15, 16, 17, 18, 19]);
    expect(w.up).toBe(true);
    expect(w.down).toBe(false);
    const w2 = windowSlice(items, 1, 5);
    expect(w2.slice).toEqual([0, 1, 2, 3, 4]);
  });
});
