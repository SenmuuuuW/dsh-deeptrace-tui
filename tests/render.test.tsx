import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { loadWhaleSprite, luminance, spriteCells, validateSprite, type WhaleSprite } from "../src/render/whale/render.js";
import { makeAppData, makeStats } from "./helpers.js";
import { Frame, windowSlice } from "../src/render/Frame.js";
import { resolveTheme } from "../src/render/theme.js";

async function frameText(view: "overview" | "tools" | "trace" | "collab" | "history", width = 100, height = 40): Promise<string> {
  const data = makeAppData(makeStats());
  const { lastFrame, unmount } = render(
    <Frame
      view={view}
      data={data}
      theme={resolveTheme(false)}
      width={width}
      height={height}
      selected={0}
      detail={null}
      helpOpen={false}
      loading={false}
      progress={null}
      error={null}
      flash={null}
      updatedAt={data.generatedAt}
      archiveInfo={`${data.archive.files} 存档`}
    />,
  );
  await new Promise((r) => setTimeout(r, 20));
  const text = lastFrame() ?? "";
  unmount();
  return text;
}

describe("Frame 渲染", () => {
  it("总览：标题 / 指标 / 趋势 / 发现 / 鲸评", async () => {
    const text = await frameText("overview");
    expect(text).toContain("深迹 DEEPTRACE");
    expect(text).toContain("● LIVE");
    expect(text).toContain("¥38.60");
    expect(text).toContain("趋势");
    expect(text).toContain("LIVE");
    expect(text).toContain("鲸评");
  });

  it("工具健康：异常优先 + 错误码", async () => {
    const text = await frameText("tools");
    expect(text).toContain("工具健康");
    expect(text).toContain("TOOL HEALTH");
  });

  it("会话轨迹：按费用排序 + 风险标记", async () => {
    const text = await frameText("trace");
    expect(text).toContain("TRACE");
    expect(text).toContain("按费用排序");
  });

  it("协作复盘：样本不足提示", async () => {
    const text = await frameText("collab");
    expect(text).toContain("协作复盘");
    expect(text).toContain("样本不足");
  });

  it("历史趋势：周期表格 + 活跃", async () => {
    const text = await frameText("history");
    expect(text).toContain("HISTORY");
    expect(text).toContain("LIVE");
    expect(text).toContain("按日活跃");
  });

  it("窄终端（80×24）不炸布局：无鲸鱼列", async () => {
    const text = await frameText("overview", 80, 24);
    expect(text).toContain("深迹 DEEPTRACE");
    expect(text).toContain("发现");
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

describe("像素鲸鱼娘 renderer", () => {
  const sprites: string[] = ["idle", "happy", "thinking", "warning", "angry", "sleepy"];

  it("6 个占位 sprite 全部合法", () => {
    for (const name of sprites) {
      const s = loadWhaleSprite(name);
      expect(() => validateSprite(s)).not.toThrow();
    }
  });

  it("half-block 色彩模式：16×24 → 12 行；上下像素合并进 ▀ 的前景/背景", () => {
    const s = loadWhaleSprite("happy");
    const cells = spriteCells(s, true);
    expect(cells).toHaveLength(12);
    expect(cells[0]).toHaveLength(16);
    // 喷水柱 (7,0)=f (7,1)=l → ▀ fg=f bg=l
    const cell = cells[0][7];
    expect(cell.char).toBe("▀");
    expect(cell.fg).toBe(s.palette.f);
    expect(cell.bg).toBe(s.palette.l);
    // 透明区域 → 空格
    expect(cells[0][0].char).toBe(" ");
  });

  it("no-color 剪影：所有实体像素有明暗字符，透明为空格", () => {
    const s = loadWhaleSprite("angry");
    const cells = spriteCells(s, false);
    for (const row of cells) {
      for (const c of row) {
        expect([" ", "░", "▒", "▓", "█"]).toContain(c.char);
      }
    }
    expect(cells[0][0].char).toBe(" ");
  });

  it("luminance 计算", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#FFFFFF")).toBe(1);
    expect(luminance("#4D6BFE")).toBeGreaterThan(0.2);
    expect(luminance("#4D6BFE")).toBeLessThan(0.7);
  });
  it("未知 palette key 报错", () => {
    const bad = { name: "bad", w: 2, h: 1, palette: { a: "#000000" }, grid: ["ab"] } as unknown as WhaleSprite;
    expect(() => validateSprite(bad)).toThrow(/unknown palette key/);
  });
});
