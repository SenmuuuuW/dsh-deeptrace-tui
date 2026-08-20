/**
 * 格式化工具（纯函数）。数字口径与 Web 版一致（formatTokens 直接来自 core）。
 */
import { formatTokens } from "../core/index.js";

/** ¥38.60 */
export function formatYen(n: number): string {
  return `¥${n.toFixed(2)}`;
}

/** 99.4% */
export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** 08-17（本地时区；周期边界是本地日历语义，显示必须用本地时区）。 */
export function formatDateLocal(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 08-17 14:30 */
export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 1.09B / 97K */
export function formatTokensZh(n: number): string {
  return formatTokens(n);
}

/**
 * 分隔符：· (U+00B7) 属于 East Asian Ambiguous —— CJK locale 终端可能按 2 列渲染，
 * 而 string-width 按 1 列计。宽度算错 1 列，整行就会溢出换行、把帧顶掉一行。
 * chrome（顶栏 / 状态栏）是全宽定位的，1 列误差直接错位，所以 ascii 档必须换半宽。
 */
export function sepOf(ascii: boolean): string {
  return ascii ? "|" : "·";
}

/** 严重 / 警告 / 提示 / 信息 */
export function levelLabel(level: string): string {
  if (level === "critical") return "严重";
  if (level === "warning") return "警告";
  if (level === "tip") return "提示";
  return "信息";
}

/**
 * 空值占位：— (U+2014) 属于 East Asian Ambiguous，和 · 同一类问题 ——
 * CJK 终端按 2 列渲染、string-width 按 1 列计。占位符常出现在右对齐的
 * 数值列里，算错 1 列会把整列推歪，所以 ascii 档换双 hyphen（明确 2 列）。
 */
export function dashOf(ascii: boolean): string {
  return ascii ? "--" : "—";
}

/** 区间箭头：→ (U+2192) 同属 Ambiguous。 */
export function arrowOf(ascii: boolean): string {
  return ascii ? "->" : "→";
}

/**
 * 费用涨跌文本：▲ 75% / ▼ 20% / —
 *
 * ▲▼ 也是 Ambiguous 字形。ascii 档用 +/-，方向语义不依赖字形宽度；
 * 空值用 dashOf 而不是单 hyphen —— 否则 "- 20%"（下跌）和 "-"（无数据）
 * 在一列里看起来像同一种东西。
 */
export function formatDelta(deltaPct: number | null, ascii = false): string {
  if (deltaPct === null) return dashOf(ascii);
  const mark = deltaPct > 0 ? (ascii ? "+" : "▲") : ascii ? "-" : "▼";
  return `${mark} ${Math.abs(deltaPct)}%`;
}

/** 时长：71ms / 6.7s */
export function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

/** ASCII 降级斜坡：无 block-element 字体时用密度递增的可打印字符。 */
const RAMP_BLOCK = "▁▂▃▄▅▆▇█";
const RAMP_ASCII = "._-=+*#@";

/** Unicode sparkline（▁▂▃▄▅▆▇█）。全零 → 等宽点阵。ascii=true 走纯 ASCII 斜坡。 */
export function sparkline(values: readonly number[], width = 10, ascii = false): string {
  const max = Math.max(0, ...values);
  if (max <= 0) return (ascii ? "." : "·").repeat(width);
  const ramp = ascii ? RAMP_ASCII : RAMP_BLOCK;
  let out = "";
  for (let i = 0; i < width; i++) {
    const idx = Math.min(values.length - 1, Math.floor((i / width) * values.length));
    const level = Math.round((values[idx] / max) * 7);
    out += ramp[level];
  }
  return out;
}

/** 成功率/失败率 10 格条形：████████░░。rate ∈ [0,1]。 */
export function bar10(rate: number, ascii = false): string {
  const filled = Math.max(0, Math.min(10, Math.round(rate * 10)));
  const [on, off] = ascii ? ["#", "."] : ["█", "░"];
  return on.repeat(filled) + off.repeat(10 - filled);
}

/** 比例条（历史趋势用）：满格 / 空值点阵。 */
export function ratioBar(value: number, max: number, width: number, ascii = false): string {
  // 零值只画一个基线刻度，不铺满整行：铺满会让"这期是 0"看起来像"这期最大"。
  // 刻意不用 ·（U+00B7）——它属于 East Asian Ambiguous，CJK 终端可能按 2 列渲染，
  // 会把同一行右对齐的数字整体推歪。- 是无歧义半宽字符。
  if (max <= 0 || value <= 0) return "-";
  const on = ascii ? "#" : "█";
  return on.repeat(Math.max(1, Math.min(width, Math.round((value / max) * width))));
}

/** 数值标注（趋势行）：1.09B → 值 + 单位。 */
export function formatBig(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// ── 终端显示宽度 ──────────────────────────────────────────────────────────
// Ink 内部用 string-width 量宽；本项目手工拼接定宽字符串（分隔线、状态栏、
// 面板标题）时必须用同一口径，否则中文会把线条撑歪。

/** 双宽码点区间（CJK / 全角 / 常用 emoji）。 */
const WIDE_RANGES: readonly [number, number][] = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

/** 零宽码点（组合记号 / BOM / 方向控制）。 */
function isZeroWidth(cp: number): boolean {
  return (cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff;
}

function codePointWidth(cp: number): number {
  if (isZeroWidth(cp)) return 0;
  for (const [lo, hi] of WIDE_RANGES) {
    if (cp >= lo && cp <= hi) return 2;
  }
  return 1;
}

/** 终端显示宽度（CJK / 全角 = 2 列）。 */
export function displayWidth(s: string): number {
  let n = 0;
  for (const ch of s) n += codePointWidth(ch.codePointAt(0) ?? 0);
  return n;
}

/**
 * 省略号：… (U+2026) 同属 East Asian Ambiguous —— 把 ambiguous 判成 2 列的
 * CJK locale 终端会多占 1 列，让「刚好占满」的截断行溢出换行。
 * ascii 档改用 "..."：三个半宽点，任何 locale 下都确定是 3 列。
 */
function ellipsisOf(ascii: boolean): string {
  return ascii ? "..." : "…";
}

/**
 * 按显示宽度截断（绝不半个汉字）。
 * 预留空间按省略号的**真实** display width 算，不写死 max - 1 ——
 * ascii 档的 "..." 占 3 列，写死 1 会稳定超宽 2 列。
 */
export function truncateWidth(s: string, max: number, ascii = false): string {
  if (max <= 0) return "";
  if (displayWidth(s) <= max) return s;
  const ellipsis = ellipsisOf(ascii);
  const ellipsisWidth = displayWidth(ellipsis);
  // 容不下省略号本身：宁可硬截也不要吐出比 max 还宽的字符串。
  if (ellipsisWidth >= max) return truncateHard(s, max);
  let out = "";
  let n = 0;
  for (const ch of s) {
    const w = codePointWidth(ch.codePointAt(0) ?? 0);
    if (n + w > max - ellipsisWidth) break;
    out += ch;
    n += w;
  }
  return `${out}${ellipsis}`;
}

/** 无省略号的硬截断（只在 max 容不下省略号时用）。 */
function truncateHard(s: string, max: number): string {
  let out = "";
  let n = 0;
  for (const ch of s) {
    const w = codePointWidth(ch.codePointAt(0) ?? 0);
    if (n + w > max) break;
    out += ch;
    n += w;
  }
  return out;
}

/** 按显示宽度右填充到定宽（用于列对齐；已超宽则截断）。 */
export function padWidth(s: string, width: number, ascii = false): string {
  const t = truncateWidth(s, width, ascii);
  return t + " ".repeat(Math.max(0, width - displayWidth(t)));
}

/** 按显示宽度左填充（数字右对齐）。 */
export function padStartWidth(s: string, width: number, ascii = false): string {
  const t = truncateWidth(s, width, ascii);
  return " ".repeat(Math.max(0, width - displayWidth(t))) + t;
}
