import { describe, expect, it } from "vitest";
import { resolveDims } from "../src/render/dimensions.js";

describe("resolveDims（终端尺寸优先级）", () => {
  it("显式 props 优先", () => {
    const d = resolveDims({ propW: 160, propH: 50, inkW: 80, inkH: 24, procW: 201, procH: 56 });
    expect(d).toEqual({ width: 160, height: 50, source: "props" });
  });

  it("Ink stdout 优先于 process.stdout", () => {
    const d = resolveDims({ inkW: 120, inkH: 40, procW: 201, procH: 56 });
    expect(d).toEqual({ width: 120, height: 40, source: "ink" });
  });

  it("process.stdout 兜底", () => {
    const d = resolveDims({ procW: 201, procH: 56 });
    expect(d).toEqual({ width: 201, height: 56, source: "process" });
  });

  it("全部缺失 → fallback 100×40（绝不假定 80×24）", () => {
    const d = resolveDims({});
    expect(d).toEqual({ width: 100, height: 40, source: "fallback" });
  });

  it("0/undefined 视为缺失（0×0 伪终端）", () => {
    const d = resolveDims({ inkW: 0, inkH: 0, procW: undefined, procH: undefined });
    expect(d.source).toBe("fallback");
  });

  it("宽高可部分指定（propW 单独，height 走下一级）", () => {
    const d = resolveDims({ propW: 130, inkW: 80, inkH: 24, procW: 201, procH: 56 });
    expect(d.width).toBe(130);
    expect(d.height).toBe(24); // propH 缺失 → inkH
    expect(d.source).toBe("props");
  });
});
