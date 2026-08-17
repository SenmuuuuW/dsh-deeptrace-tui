import { afterEach, describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli.js";

const oldTerm = process.env.TERM;
const oldNoColor = process.env.NO_COLOR;
afterEach(() => {
  if (oldTerm === undefined) delete process.env.TERM;
  else process.env.TERM = oldTerm;
  if (oldNoColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = oldNoColor;
});

describe("parseArgs", () => {
  it("默认：weekly、有颜色（TERM 正常且无 NO_COLOR 时）、DSH_HOME", () => {
    process.env.TERM = "xterm-256color";
    delete process.env.NO_COLOR;
    const a = parseArgs([]);
    expect(a.preset).toBe("weekly");
    expect(a.color).toBe(true);
    expect(a.renderView).toBeNull();
    expect(a.dshHome.length).toBeGreaterThan(0);
  });

  it("--no-color / NO_COLOR 环境", () => {
    expect(parseArgs(["--no-color"]).color).toBe(false);
  });

  it("--preset 校验", () => {
    expect(parseArgs(["--preset", "daily"]).preset).toBe("daily");
    expect(() => parseArgs(["--preset", "bogus"])).toThrow(/未知周期/);
  });

  it("--render 校验", () => {
    expect(parseArgs(["--render", "trace"]).renderView).toBe("trace");
    expect(() => parseArgs(["--render", "nope"])).toThrow(/未知视图/);
  });

  it("--watch 必须为正数", () => {
    expect(parseArgs(["--watch", "60"]).watchSec).toBe(60);
    expect(() => parseArgs(["--watch", "-1"])).toThrow();
  });

  it("--width/--height 边界", () => {
    expect(parseArgs(["--width", "80", "--height", "24"]).width).toBe(80);
    expect(() => parseArgs(["--width", "10"])).toThrow();
  });
});
