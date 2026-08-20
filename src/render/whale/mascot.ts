/**
 * 观察员小鲸鱼 —— 终端符号线稿 mascot（纯函数，无 Ink 依赖）。
 *
 * 为什么不再用像素 sprite：
 *   16×12 逻辑像素经 half-block 压成 16 列 × 6 行后，在以文字为主的 TUI 里
 *   是一整块高饱和色噪点 —— 抢主信息、且必然制造大块留白。
 *   （把 web 版 512px 鲸鱼娘头像降采样到 16 列的实测结果就是一团糊块。）
 *
 * 从 web 版继承的是「设计语言」而不是像素：
 *   正面头像构图、宽间距大眼、一个字形一种情绪 —— 与 whale-report 的
 *   四表情规格书（呆萌 / 生气 / 困困 / 无语）一一对应，两端观感同源。
 *
 * 线稿用与 UI 结构线同一套 box-drawing 笔画，3 行 × 11 列，
 * 与文本同一视觉重量：装饰 + 状态提示，不做主角。
 *
 * 宽度安全（终端兼容性硬约束）：
 *   外框只用单线 box-drawing（与 chrome 结构线同一风险档），
 *   五官一律纯 ASCII —— 任何终端、任何 locale、任何 ambiguous 设置都是 1 格。
 *   East Asian Ambiguous / Wide 字形（●、‿、﹏、▀▄ 等）一律不用。
 *   ascii=true 时整只降级为纯 ASCII，供缺字形终端使用。
 *
 * 轮廓在所有状态下完全一致（只换眼/嘴字形 + 颜色），
 * 状态切换时 mascot 不会跳动，也不会改变占位。
 */

/** mascot 状态。core 的 whaleMood 决定其中 4 个；idle/thinking 是 TUI 自身的 UI 状态。 */
export type WhaleState = "idle" | "happy" | "thinking" | "warning" | "angry" | "sleepy";

/** 线稿分段的颜色角色（由主题解析成具体色值）。 */
export type MarkRole = "body" | "accent" | "face";

export interface MarkSegment {
  text: string;
  role: MarkRole;
}

export interface WhaleMascot {
  state: WhaleState;
  /** 3 行线稿，宽度恒为 [10, 11, 10]（胸鳍在中行外突一列）。 */
  rows: MarkSegment[][];
  /** 单行微章（窄/矮终端），恒 9 列。 */
  tick: MarkSegment[];
  /** 中文状态词（颜色之外的第二重状态表达）。 */
  label: string;
  /** 颜色语义档：由 theme 映射到 token。 */
  tone: "brand" | "signal" | "warn" | "error" | "muted";
}

/** 线稿宽度契约（单测钉死）。 */
export const MARK_WIDTH = 11;
export const MARK_HEIGHT = 3;
export const MARK_ROW_WIDTHS: readonly number[] = [10, 11, 10];
export const TICK_WIDTH = 9;

interface StateSpec {
  /** 左眼 / 右眼分开：angry 需要 `>` `<` 这种非对称眉眼。 */
  eyeL: string;
  eyeR: string;
  mouth: string;
  label: string;
  tone: WhaleMascot["tone"];
  /** 胸鳍是否跟随 tone 上色（false = 用中性色，避免整只都是警示色）。 */
  accentFollowsTone: boolean;
}

const STATES: Record<WhaleState, StateSpec> = {
  idle: { eyeL: "o", eyeR: "o", mouth: "_", label: "待机", tone: "brand", accentFollowsTone: false },
  happy: { eyeL: "^", eyeR: "^", mouth: "w", label: "一切顺利", tone: "signal", accentFollowsTone: true },
  thinking: { eyeL: "o", eyeR: "-", mouth: "?", label: "解析中", tone: "brand", accentFollowsTone: false },
  warning: { eyeL: ".", eyeR: ".", mouth: "~", label: "有需要留意", tone: "warn", accentFollowsTone: true },
  angry: { eyeL: ">", eyeR: "<", mouth: "^", label: "有危险操作", tone: "error", accentFollowsTone: true },
  sleepy: { eyeL: "-", eyeR: "-", mouth: "z", label: "夜间活跃", tone: "muted", accentFollowsTone: true },
};

interface Glyphs {
  top: string;
  bottom: string;
  wallL: string;
  wallR: string;
  fin: string;
}

const BOX: Glyphs = { top: " ╭───────╮", bottom: " ╰───────╯", wallL: "┤ ", wallR: " ├", fin: "─" };
const ASCII: Glyphs = { top: " .-------.", bottom: " '-------'", wallL: "| ", wallR: " |", fin: "-" };

/** core mood → mascot 状态（阈值仍由 core whaleMood 决定，这里只做外观映射）。 */
export const MOOD_TO_STATE: Record<string, WhaleState> = {
  happy: "happy",
  angry: "angry",
  sleepy: "sleepy",
  dazed: "warning",
};

export function stateForMood(mood: string): WhaleState {
  return MOOD_TO_STATE[mood] ?? "warning";
}

/**
 * 构建 mascot 线稿（正面头像 + 两侧胸鳍）：
 *
 *      ╭───────╮        ← 头顶
 *     ─┤ o _ o ├─       ← 胸鳍 + 眼 · 嘴 · 眼
 *      ╰───────╯        ← 下颌
 *
 * 竖线固定在第 1 / 9 列，五官固定在第 3 / 5 / 7 列 —— 恒在轮廓之内。
 */
export function whaleMascot(state: WhaleState, ascii = false): WhaleMascot {
  const s = STATES[state];
  const g = ascii ? ASCII : BOX;
  const finRole: MarkRole = s.accentFollowsTone ? "body" : "accent";
  const rows: MarkSegment[][] = [
    [{ text: g.top, role: "body" }],
    [
      { text: g.fin, role: finRole },
      { text: g.wallL, role: "body" },
      { text: s.eyeL, role: "face" },
      { text: " ", role: "body" },
      { text: s.mouth, role: "face" },
      { text: " ", role: "body" },
      { text: s.eyeR, role: "face" },
      { text: g.wallR, role: "body" },
      { text: g.fin, role: finRole },
    ],
    [{ text: g.bottom, role: "body" }],
  ];
  const tick: MarkSegment[] = [
    { text: g.fin, role: finRole },
    { text: g.wallL.trimEnd(), role: "body" },
    { text: s.eyeL, role: "face" },
    { text: " ", role: "body" },
    { text: s.mouth, role: "face" },
    { text: " ", role: "body" },
    { text: s.eyeR, role: "face" },
    { text: g.wallR.trimStart(), role: "body" },
    { text: g.fin, role: finRole },
  ];
  return { state, rows, tick, label: s.label, tone: s.tone };
}

/** 每行的显示宽度（半角字符 → 码点数即列数）。 */
export function markRowWidth(row: readonly MarkSegment[]): number {
  return row.reduce((n, seg) => n + [...seg.text].length, 0);
}

/** 纯文本线稿（测试 / 文档 / no-color 预览）。 */
export function mascotToText(state: WhaleState, ascii = false): string[] {
  return whaleMascot(state, ascii).rows.map((row) => row.map((s) => s.text).join(""));
}

export const WHALE_STATES: WhaleState[] = ["idle", "happy", "thinking", "warning", "angry", "sleepy"];
