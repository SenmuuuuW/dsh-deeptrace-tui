import { describe, expect, it } from "vitest";
import { dominantSide, faultSideOf, faultVerdict, tallyFaults } from "../src/vm/fault.js";
import { buildToolsVm } from "../src/vm/tools.js";
import { makeStats } from "./helpers.js";

describe("错误码归因", () => {
  it("执行侧：权限 / 超时 / 网络 / 限流 / 被杀", () => {
    for (const code of ["EACCES", "EPERM", "ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "EPIPE", "RATE_LIMIT", "HTTP_429", "HTTP_503", "SIGKILL", "OOM"]) {
      expect(faultSideOf(code), code).toBe("exec");
    }
  });

  it("调用侧：参数非法 / 目标不存在 / 内容过期", () => {
    for (const code of ["ENOENT", "InvalidArgument", "VALIDATION_ERROR", "SchemaError", "NOT_FOUND", "STALE_CONTENT", "HTTP_400", "HTTP_404"]) {
      expect(faultSideOf(code), code).toBe("call");
    }
  });

  it("ENOTFOUND（DNS）归执行侧，不被 NOT_FOUND 抢走", () => {
    expect(faultSideOf("ENOTFOUND")).toBe("exec");
    expect(faultSideOf("NOT_FOUND")).toBe("call");
  });

  it("不认识的码一律未归因，绝不编造语义", () => {
    for (const code of ["UNKNOWN", "FS_NOT_OBSERVED_XYZ", "WeirdCustomThing", "", "Error"]) {
      expect(faultSideOf(code), code).toBe("unknown");
    }
  });

  it("主方向要 ≥60% 才下结论，否则算混合", () => {
    expect(dominantSide(tallyFaults({ ETIMEDOUT: 8, ENOENT: 2 }))).toBe("exec");
    expect(dominantSide(tallyFaults({ ETIMEDOUT: 5, ENOENT: 5 }))).toBe("mixed");
    expect(dominantSide(tallyFaults({}))).toBe("none");
    expect(dominantSide(tallyFaults({ WEIRD: 3 }))).toBe("unknown");
  });

  it("未归因过半时标低可信度，结论不装确定", () => {
    const v = faultVerdict(tallyFaults({ WEIRD: 6, ETIMEDOUT: 2 }));
    expect(v.lowConfidence).toBe(true);
    expect(v.breakdown).toContain("未归因 6");
  });

  it("无结果调用（call 有、result 无）单独计入分布", () => {
    const v = faultVerdict(tallyFaults({ ETIMEDOUT: 1 }), 3);
    expect(v.breakdown).toContain("无结果 3");
  });

  it("接进 ToolsVm：合计归因与逐工具归因都在", () => {
    const vm = buildToolsVm(makeStats());
    expect(vm.verdict.text).not.toBe("");
    expect(vm.fault.total).toBe(vm.fault.call + vm.fault.exec + vm.fault.unknown);
    for (const t of vm.tools) {
      expect(t.fault.total).toBe(t.fault.call + t.fault.exec + t.fault.unknown);
      for (const e of t.errorCodes) expect(e.side).toBe(faultSideOf(e.code));
    }
  });
});
