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

/** 严重 / 警告 / 提示 / 信息 */
export function levelLabel(level: string): string {
  if (level === "critical") return "严重";
  if (level === "warning") return "警告";
  if (level === "tip") return "提示";
  return "信息";
}

/** 费用涨跌文本：▲ 75% / ▼ 20% / — */
export function formatDelta(deltaPct: number | null): string {
  if (deltaPct === null) return "—";
  return `${deltaPct > 0 ? "▲" : "▼"} ${Math.abs(deltaPct)}%`;
}

/** 时长：71ms / 6.7s */
export function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

/** Unicode sparkline（▁▂▃▄▅▆▇█）。全零 → 等宽点阵。 */
export function sparkline(values: readonly number[], width = 10): string {
  const max = Math.max(0, ...values);
  if (max <= 0) return "·".repeat(width);
  const ramp = "▁▂▃▄▅▆▇█";
  let out = "";
  for (let i = 0; i < width; i++) {
    const idx = Math.min(values.length - 1, Math.floor((i / width) * values.length));
    const level = Math.round((values[idx] / max) * 7);
    out += ramp[level];
  }
  return out;
}

/** 成功率/失败率 10 格条形：████████░░。rate ∈ [0,1]。 */
export function bar10(rate: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(rate * 10)));
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/** 数值标注（趋势行）：1.09B → 值 + 单位。 */
export function formatBig(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
