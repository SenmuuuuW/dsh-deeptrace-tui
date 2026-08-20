/**
 * 错误归因（纯函数、确定性）。
 *
 * 口径说明（重要）：
 * core 的 errorCodeOf 只做 error.code → error.name → "UNKNOWN"，
 * 也就是说错误码是运行时任意字符串，没有统一枚举。
 * 因此这里**只**匹配含义明确的知名码/知名子串，其余一律落到「未归因」，
 * 绝不给不认识的码编造语义。原始错误码在界面上始终原样展示。
 *
 * 两个方向刻意描述「失败形态」而非指责：
 *  - call 调用侧：请求本身与现实不符（参数非法 / 目标不存在 / 内容已过期）
 *  - exec 执行侧：环境没能把请求执行下去（权限 / 超时 / 网络 / 限流 / 进程被杀）
 */
import { dashOf, sepOf } from "./format.js";

export type FaultSide = "call" | "exec" | "unknown";

export const FAULT_LABEL: Record<FaultSide, string> = {
  call: "调用侧",
  exec: "执行侧",
  unknown: "未归因",
};

export const FAULT_HINT: Record<FaultSide, string> = {
  call: "参数/目标与现实不符",
  exec: "环境未能执行完成",
  unknown: "错误码语义未知",
};

/** 知名子串 → 方向。顺序无关：全部小写后做 includes 匹配。 */
const RULES: ReadonlyArray<readonly [string, FaultSide]> = [
  // 调用侧：请求与现实不符
  ["invalid", "call"],
  ["validation", "call"],
  ["schema", "call"],
  ["badrequest", "call"],
  ["bad_request", "call"],
  ["unprocessable", "call"],
  ["parse", "call"],
  ["syntax", "call"],
  ["notfound", "call"],
  ["not_found", "call"],
  ["enoent", "call"],
  ["no_match", "call"],
  ["nomatch", "call"],
  ["stale", "call"],
  ["has_not_been_read", "call"],
  ["unsupported", "call"],
  ["unrecognized", "call"],
  ["missing", "call"],
  ["400", "call"],
  ["404", "call"],
  ["422", "call"],
  // 执行侧：环境没执行下去
  ["eacces", "exec"],
  ["eperm", "exec"],
  ["permission", "exec"],
  ["denied", "exec"],
  ["etimedout", "exec"],
  ["timeout", "exec"],
  ["timedout", "exec"],
  ["econnrefused", "exec"],
  ["econnreset", "exec"],
  ["enotfound", "exec"],
  ["ehostunreach", "exec"],
  ["enetwork", "exec"],
  ["network", "exec"],
  ["socket", "exec"],
  ["epipe", "exec"],
  ["enospc", "exec"],
  ["emfile", "exec"],
  ["rate_limit", "exec"],
  ["ratelimit", "exec"],
  ["429", "exec"],
  ["500", "exec"],
  ["502", "exec"],
  ["503", "exec"],
  ["504", "exec"],
  ["unavailable", "exec"],
  ["sigkill", "exec"],
  ["sigterm", "exec"],
  ["killed", "exec"],
  ["oom", "exec"],
];

/** 未归因的显式白名单：这些码本身就表示「没拿到码」。 */
const EXPLICIT_UNKNOWN = new Set(["unknown", "error", "", "null", "undefined"]);

/**
 * 单个错误码归因。只认知名子串，其余落「未归因」。
 * enotfound（DNS）比 not_found 更长且更具体，需要先判执行侧，避免被 notfound 抢走。
 */
export function faultSideOf(code: string): FaultSide {
  const c = code.trim().toLowerCase();
  if (EXPLICIT_UNKNOWN.has(c)) return "unknown";
  if (c.includes("enotfound")) return "exec";
  for (const [needle, side] of RULES) {
    if (c.includes(needle)) return side;
  }
  return "unknown";
}

export interface FaultTally {
  call: number;
  exec: number;
  unknown: number;
  total: number;
}

export function emptyTally(): FaultTally {
  return { call: 0, exec: 0, unknown: 0, total: 0 };
}

/** 按错误码计数聚合归因。counts 形如 { ENOENT: 3, ETIMEDOUT: 1 }。 */
export function tallyFaults(counts: Readonly<Record<string, number>>): FaultTally {
  const t = emptyTally();
  for (const [code, n] of Object.entries(counts)) {
    if (n <= 0) continue;
    t[faultSideOf(code)] += n;
    t.total += n;
  }
  return t;
}

export function addTally(into: FaultTally, from: FaultTally): void {
  into.call += from.call;
  into.exec += from.exec;
  into.unknown += from.unknown;
  into.total += from.total;
}

/**
 * 主方向：占比 ≥ 60% 才敢下结论，否则算「混合」。
 * 未归因永远不作为结论方向，只作为可信度的扣分项。
 */
export function dominantSide(t: FaultTally): FaultSide | "mixed" | "none" {
  if (t.total <= 0) return "none";
  const attributed = t.call + t.exec;
  if (attributed <= 0) return "unknown";
  if (t.call / attributed >= 0.6) return "call";
  if (t.exec / attributed >= 0.6) return "exec";
  return "mixed";
}

export interface FaultVerdict {
  side: FaultSide | "mixed" | "none";
  /** 一句话结论，例：偏执行侧（环境未能执行完成）。 */
  text: string;
  /** 分布，例：执行侧 12 · 调用侧 3 · 未归因 1。 */
  breakdown: string;
  /** 未归因占比过高时为 true，界面应提示结论不完整。 */
  lowConfidence: boolean;
}

export function faultVerdict(t: FaultTally, incomplete = 0, ascii = false): FaultVerdict {
  const side = dominantSide(t);
  const parts: string[] = [];
  if (t.exec > 0) parts.push(`执行侧 ${t.exec}`);
  if (t.call > 0) parts.push(`调用侧 ${t.call}`);
  if (t.unknown > 0) parts.push(`未归因 ${t.unknown}`);
  if (incomplete > 0) parts.push(`无结果 ${incomplete}`);
  let text: string;
  if (side === "none") text = "本期没有失败调用";
  else if (side === "call") text = "偏调用侧（参数/目标与现实不符）";
  else if (side === "exec") text = "偏执行侧（环境未能执行完成）";
  else if (side === "mixed") text = "两侧都有，需要逐工具看";
  else text = "错误码语义未知，无法归因";
  return {
    side,
    text,
    breakdown: parts.join(` ${sepOf(ascii)} `) || dashOf(ascii),
    lowConfidence: t.total > 0 && t.unknown / t.total > 0.5,
  };
}
