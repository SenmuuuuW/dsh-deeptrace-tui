/**
 * Tools 页交互验收（跨档 j/k / 首尾循环 / resize clamp / 高亮一致 / 不隐藏可选项）。
 *
 * 为什么单独一个文件：高亮用 chalk `inverse` 表达，而无头渲染器的假 stdout 让
 * chalk 落到 level 0（样式被丢弃），必须 FORCE_COLOR=1 才能在文本里看到 ESC[7m。
 * 但 FORCE_COLOR 一旦全局打开，ANSI 序列会进入所有 displayWidth 断言把宽度算爆，
 * 所以只在本文件内先设环境变量、再动态 import ink 依赖链（ESM 静态 import 会被提升，
 * 早于赋值执行，拿不到带色的 chalk）。
 */
import { beforeAll, describe, expect, it } from "vitest";
import { moveSelection, clampSelection } from "../src/render/geometry.js";
import { buildToolsVm, type ToolVm } from "../src/vm/tools.js";
import { makeTieredStats } from "./helpers.js";

const ESC = String.fromCharCode(27);
const INVERSE = `${ESC}[7m`;

const SIZES: [number, number][] = [
  [80, 24],
  [100, 30],
  [120, 40],
  [160, 50],
];

/** 动态 import 的模块句柄（beforeAll 里填充）。 */
let mod: {
  Frame: typeof import("../src/render/Frame.js").Frame;
  renderToText: typeof import("../src/render/headless.js").renderToText;
  resolveTheme: typeof import("../src/render/theme.js").resolveTheme;
  makeAppData: typeof import("./helpers.js").makeAppData;
  React: typeof import("react");
};

beforeAll(async () => {
  process.env.FORCE_COLOR = "1";
  mod = {
    Frame: (await import("../src/render/Frame.js")).Frame,
    renderToText: (await import("../src/render/headless.js")).renderToText,
    resolveTheme: (await import("../src/render/theme.js")).resolveTheme,
    makeAppData: (await import("./helpers.js")).makeAppData,
    React: await import("react"),
  };
});

const stats = makeTieredStats();
const vm = buildToolsVm(stats);
const flat = vm.tiers.flat;

/** 渲染 tools 页一帧（带 ANSI，用于抓 inverse 高亮行）。 */
async function toolsFrame(selected: number, width: number, height: number, ascii = false): Promise<string> {
  const data = mod.makeAppData(stats);
  return await mod.renderToText(
    mod.React.createElement(mod.Frame, {
      view: "tools" as const,
      data,
      theme: mod.resolveTheme(false, ascii),
      width, height, selected,
      detail: null, noteOpen: false, helpOpen: false, loading: false,
      progress: null, error: null, flash: null,
      updatedAt: data.generatedAt, archiveInfo: "x", historyMetric: "cost" as const,
    }),
    { width, height },
  );
}

/** 被 inverse 标记的行（高亮行）。工具页每次最多一行带 ESC[7m。 */
function inverseLines(text: string): string[] {
  return text.split("\n").filter((l) => l.includes(INVERSE));
}

/** 去掉 ANSI，便于按名字断言。 */
function strip(s: string): string {
  return s.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");
}

/**
 * 高亮的工具名（锚定到 inverse span，不是整行）。
 *
 * 三种行（AttentionTool / FailingToolRow / NormalToolRow）都是 2 空格缩进 + 名字列开头，
 * 所以 span 内 trim() 后的首 token 就是工具名。
 *
 * 为什么必须取 span 而不是整行：零失败档在 width>=76 时是双列，一条物理行上有两个工具
 * （左 ls / 右 todo），只有其中一个被 inverse 包住。按整行取首 token 会永远返回左列，
 * 按整行做 includes 又会因为"另一列的名字也在这行"而假通过 —— 两种都验不出高亮错位。
 */
function highlightedName(text: string): string {
  const spans = [...text.matchAll(new RegExp(`${ESC}\\[7m([\\s\\S]*?)${ESC}\\[27m`, "g"))];
  if (spans.length !== 1) return `<${spans.length} 处高亮>`;
  return strip(spans[0][1]).trim().split(/\s+/)[0] ?? "";
}

describe("跨档 j/k", () => {
  it("j 连按走遍全部 16 项，顺序 = anomaly → failing → normal", () => {
    const seen: string[] = [];
    let sel = 0;
    for (let i = 0; i < flat.length; i++) {
      seen.push(flat[sel].name);
      sel = moveSelection(sel, 1, flat.length);
    }
    // 期望值由三档分别推导，不从 flat 反推 —— 否则等于用 flat 证明 flat，
    // 分档顺序若反了（normal 排到 anomaly 前面）这条断言也会通过。
    const { anomalies, failing, normal } = vm.tiers;
    expect(seen).toEqual([
      ...anomalies.map((x) => x.name),
      ...failing.map((x) => x.name),
      ...normal.map((x) => x.name),
    ]);
    // 走满一圈后回到起点。
    expect(sel).toBe(0);
  });

  it("跨档边界：anomaly 末项 →j→ failing 首项，failing 末项 →j→ normal 首项", () => {
    const { anomalies, failing } = vm.tiers;
    const aLast = anomalies.length - 1;
    const fFirst = moveSelection(aLast, 1, flat.length);
    expect(fFirst).toBe(anomalies.length);
    expect(flat[fFirst].name).toBe(failing[0].name);

    const fLast = anomalies.length + failing.length - 1;
    const nFirst = moveSelection(fLast, 1, flat.length);
    expect(nFirst).toBe(anomalies.length + failing.length);
    expect(flat[nFirst].name).toBe(vm.tiers.normal[0].name);
  });

  it("k 反向跨档：normal 首项 →k→ failing 末项", () => {
    const nFirst = vm.tiers.anomalies.length + vm.tiers.failing.length;
    const back = moveSelection(nFirst, -1, flat.length);
    expect(flat[back].name).toBe(vm.tiers.failing[vm.tiers.failing.length - 1].name);
  });
});

describe("首尾循环", () => {
  it("第一项 k → 最后一项", () => {
    expect(moveSelection(0, -1, flat.length)).toBe(flat.length - 1);
  });

  it("最后一项 j → 第一项", () => {
    expect(moveSelection(flat.length - 1, 1, flat.length)).toBe(0);
  });

  it("空列表不产生非法索引", () => {
    expect(moveSelection(0, 1, 0)).toBe(0);
    expect(moveSelection(3, -1, 0)).toBe(0);
    expect(clampSelection(5, 0)).toBe(0);
  });
});

describe("resize / 条目数变化后 selected 合法", () => {
  it("条目数变少后 clamp 回落到末项，不指向空位", () => {
    expect(clampSelection(15, 16)).toBe(15);
    expect(clampSelection(15, 4)).toBe(3);
    expect(clampSelection(0, 16)).toBe(0);
    expect(clampSelection(-2, 16)).toBe(0);
  });

  it("越界的 selected 上 j/k 仍落在合法区间（clamp effect 未落地时的中间态）", () => {
    for (const stale of [16, 40, 999]) {
      const next = moveSelection(stale, 1, flat.length);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(flat.length);
    }
  });

  it("四种尺寸下渲染 selected=末项都不崩、不超宽", async () => {
    for (const [w, h] of SIZES) {
      const text = await toolsFrame(flat.length - 1, w, h);
      const lines = strip(text).split("\n");
      expect(lines.length, `${w}x${h} 行数`).toBe(h);
      for (const line of lines) {
        expect(line.length, `${w}x${h} 不超宽`).toBeLessThanOrEqual(w);
      }
    }
  });
});

describe("高亮工具名 === VM selected 对象", () => {
  it("每一个 selected 都精确高亮 flat[selected]，且只高亮一行", async () => {
    for (const [w, h] of [[120, 40], [160, 50]] as [number, number][]) {
      for (let sel = 0; sel < flat.length; sel++) {
        const name = highlightedName(await toolsFrame(sel, w, h));
        expect(name, `${w}x${h} sel=${sel}`).toBe(flat[sel].name);
      }
    }
  });

  it("高亮的不是同名前缀的邻项（名字按整列比对）", async () => {
    // read / write 互为子串风险项：write 高亮时不能匹配到 read 那行。
    const wIdx = flat.findIndex((x) => x.name === "write");
    const rIdx = flat.findIndex((x) => x.name === "read");
    expect(wIdx).toBeGreaterThanOrEqual(0);
    expect(rIdx).toBeGreaterThanOrEqual(0);
    expect(highlightedName(await toolsFrame(wIdx, 160, 50))).toBe("write");
    expect(highlightedName(await toolsFrame(rIdx, 160, 50))).toBe("read");
  });
});

describe("selectable item 不被 windowing 隐藏", () => {
  it("四种尺寸 × 全部 16 项：选中项的名字始终出现在画面上", async () => {
    for (const [w, h] of SIZES) {
      for (let sel = 0; sel < flat.length; sel++) {
        const text = strip(await toolsFrame(sel, w, h));
        expect(text, `${w}x${h} sel=${sel} 选中项 ${flat[sel].name} 必须可见`)
          .toContain(flat[sel].name);
      }
    }
  });

  it("四种尺寸 × 全部 16 项：选中项恒被 inverse 标出（不只是碰巧在画面上）", async () => {
    for (const [w, h] of SIZES) {
      for (let sel = 0; sel < flat.length; sel++) {
        const name = highlightedName(await toolsFrame(sel, w, h));
        expect(name, `${w}x${h} sel=${sel} 必须恰好一行高亮且是选中项`).toBe(flat[sel].name);
      }
    }
  });

  it("ASCII 档同样不隐藏选中项", async () => {
    for (const [w, h] of SIZES) {
      for (let sel = 0; sel < flat.length; sel++) {
        const name = highlightedName(await toolsFrame(sel, w, h, true));
        expect(name, `ascii ${w}x${h} sel=${sel}`).toBe(flat[sel].name);
      }
    }
  });
});

describe("夹具前提", () => {
  it("三档都非空，且 flat = anomalies ++ failing ++ normal", () => {
    const { anomalies, failing, normal } = vm.tiers;
    expect(anomalies.length).toBeGreaterThan(0);
    expect(failing.length).toBeGreaterThan(0);
    expect(normal.length).toBeGreaterThan(0);
    expect(flat.map((x) => x.name)).toEqual(
      [...anomalies, ...failing, ...normal].map((x: ToolVm) => x.name),
    );
  });
});
