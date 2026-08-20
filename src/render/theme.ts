/**
 * 主题 token —— 与 dsh-tui（SONAR/ABYSS）同一套深海配色语义：
 * DeepSeek Blue #4D6BFE、深海 navy、冷灰 muted、浅 cyan signal、
 * 少量 amber warn、少量 danger red。
 * no-color 模式：所有 token → undefined（终端默认色），只保留 bold/dim 样式。
 */
export interface ThemeTokens {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  brand: string;
  signal: string;
  warn: string;
  error: string;
  thinking: string;
  userAccent: string;
}

export const THEME: ThemeTokens = {
  bg: "#05070F",
  surface: "#0A1220",
  text: "#C9D4E8",
  muted: "#5A6B8C",
  brand: "#4D6BFE",
  signal: "#6FE3D5",
  warn: "#F5A623",
  error: "#E5484D",
  thinking: "#8FA3C8",
  userAccent: "#7B9BE8",
};

/** no-color：所有颜色 token → undefined。 */
export const NO_COLOR_TOKENS: ThemeTokens = {
  bg: "#000000",
  surface: "#000000",
  text: "#FFFFFF",
  muted: "#808080",
  brand: "#FFFFFF",
  signal: "#FFFFFF",
  warn: "#FFFFFF",
  error: "#FFFFFF",
  thinking: "#808080",
  userAccent: "#FFFFFF",
};

export interface ResolvedTheme {
  color: boolean;
  /** true = 结构线降级 ASCII（-|+），用于缺 box-drawing 字形的终端。 */
  ascii: boolean;
  tokens: ThemeTokens;
}

/**
 * 颜色能力探测：
 * - NO_COLOR 环境变量（含空值）→ false
 * - TERM=dumb / TERM 缺失 → false
 * - FORCE_COLOR=1 → true
 * - COLORTERM=truecolor/24bit → true
 * - 默认 true（256/truecolor 由终端自行降级；no-color 由显式开关决定）
 */
export function detectColorSupport(env: NodeJS.ProcessEnv = process.env, argv: readonly string[] = []): boolean {
  if (argv.includes("--no-color")) return false;
  if (env.NO_COLOR !== undefined) return false;
  const term = env.TERM;
  if (term === "dumb" || term === undefined) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") return true;
  return true;
}

/**
 * box-drawing 可用性探测。
 * 与颜色是两件事：`--no-color` 只关颜色（截图/CI 仍要好看的结构线），
 * 真正缺字形的是 TERM=dumb / linux console 这类终端。
 */
export function detectAsciiFallback(env: NodeJS.ProcessEnv = process.env, argv: readonly string[] = []): boolean {
  if (argv.includes("--ascii")) return true;
  const term = env.TERM;
  if (term === "dumb" || term === undefined || term === "linux") return true;
  return false;
}

export function resolveTheme(color: boolean, ascii = false): ResolvedTheme {
  return { color, ascii, tokens: color ? THEME : NO_COLOR_TOKENS };
}
