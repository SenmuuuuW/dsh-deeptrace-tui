/**
 * 工作台几何（纯函数，可单测）—— 所有响应式决策集中在这里。
 *
 * 屏幕恒定五段（合计精确等于终端高度，不留底部空白）：
 *
 *   row 0            顶栏：品牌 · 周期 · 状态 chips
 *   row 1            上横线（rail 存在时带 ┬ 接头）
 *   row 2..H-3       主体：主工作区 │ 右侧诊断区
 *   row H-2          下横线（带 ┴ 接头）
 *   row H-1          状态栏：导航 + 快捷键 + 时间
 *
 * 主体高度 = H - 4，视图必须按这个数排布内容（列表窗口按它算容量），
 * 这是"打开后不再是左上角几行字 + 大片空白"的机制保证。
 */

export type WidthBand = "compact" | "standard" | "wide";
export type HeightBand = "low" | "normal" | "tall";

export function widthBandOf(width: number): WidthBand {
  if (width < 100) return "compact";
  if (width < 140) return "standard";
  return "wide";
}

export function heightBandOf(height: number): HeightBand {
  if (height < 26) return "low";
  if (height < 40) return "normal";
  return "tall";
}

/** 顶栏/状态栏/横线各 1 行，合计 4 行非主体。 */
export const CHROME_ROWS = 4;

export interface Layout {
  width: number;
  height: number;
  widthBand: WidthBand;
  heightBand: HeightBand;
  /** 主体可用行数（= height - 4）。 */
  bodyHeight: number;
  /** 是否显示右侧诊断区。 */
  railShown: boolean;
  /** 诊断区列宽（含左侧 1 空格内边距，不含分隔竖线）。 */
  railWidth: number;
  /** 主工作区列宽。 */
  mainWidth: number;
  /** 主工作区内部是否再分左右（列表 + 详情，profiler 式）。 */
  splitMain: boolean;
  /** 主工作区内部左列（列表）宽度；splitMain 为 false 时等于 mainWidth。 */
  listWidth: number;
  /** 主工作区内部右列（详情）宽度。 */
  detailWidth: number;
  /** mascot 形态：3 行线稿 / 单行微章 / 不显示。 */
  mascot: "mark" | "tick" | "none";
}

/**
 * 解析布局。
 *
 * 宽度策略：
 *   <100  单列，无诊断区（诊断信息由各视图自己带最小摘要）；
 *   100-139  主区 + 32 列诊断区；
 *   >=140    主区 + 38 列诊断区，且主区内部可再分列表/详情。
 *
 * 高度策略：
 *   <26 行 mascot 退化成单行微章（省 2 行给内容）；
 *   <20 行 完全不显示 mascot。
 */
export function layoutOf(width: number, height: number): Layout {
  const widthBand = widthBandOf(width);
  const heightBand = heightBandOf(height);
  const bodyHeight = Math.max(3, height - CHROME_ROWS);

  const railShown = width >= 100;
  const railWidth = !railShown ? 0 : width >= 140 ? 38 : 32;
  // 分隔竖线占 1 列，竖线两侧各 1 空格内边距。
  const dividerCols = railShown ? 3 : 0;
  const mainWidth = Math.max(20, width - railWidth - dividerCols);

  // 主区内部再分列表/详情：需要 76 列才不至于两边都挤扁。
  // 同时要求整屏 >=100 —— 80 列终端主区虽有 80 列，但拆开后列表和详情都读不了，
  // 那种尺寸下走"列表 → Enter → 详情占满"更好用。
  const splitMain = mainWidth >= 76 && width >= 100;
  const listWidth = splitMain ? Math.min(46, Math.max(34, Math.floor(mainWidth * 0.42))) : mainWidth;
  const detailWidth = splitMain ? Math.max(20, mainWidth - listWidth - 2) : 0;

  const mascot: Layout["mascot"] = bodyHeight < 16 ? "none" : height < 26 ? "tick" : "mark";

  return {
    width,
    height,
    widthBand,
    heightBand,
    bodyHeight,
    railShown,
    railWidth,
    mainWidth,
    splitMain,
    listWidth,
    detailWidth,
    mascot,
  };
}

// ── 列表选中（纯函数，键盘与测试共用同一实现）──────────────────────────

/**
 * j/k 移动：先把 selected 夹回合法区间再取模，越界时不会绕远路。
 *
 * 先 min 再取模是必要的：条目数刚变少（r 刷新 / 切档）而 clamp effect 尚未落地时，
 * selected 可能大于 count-1，直接取模会跳到一个和方向无关的位置。
 * count<=0 时保持 0 —— 空列表没有可选项。
 */
export function moveSelection(selected: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (Math.min(selected, count - 1) + delta + count) % count;
}

/** 条目数变化后把 selected 夹回合法区间（count 为 0 时回到 0）。 */
export function clampSelection(selected: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(0, selected), count - 1);
}
