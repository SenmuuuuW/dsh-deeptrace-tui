/**
 * 工作台外壳：顶栏 / 主体（主工作区 │ 诊断区）/ 状态栏。
 *
 * 设计意图 —— 让它像一个"正在工作的终端工具"，不像一张静态报表：
 *   · 屏幕被结构线切成固定分区，任何视图切换都不改变骨架位置；
 *   · 主体高度 = 终端高度 - 4，视图按这个数填满，底部不留死白；
 *   · 结构线只有 3 条（上横线 / 竖分隔 / 下横线），其余靠标题 + 缩进分层；
 *   · 顶栏常驻 LIVE / LOCAL / DETERMINISTIC / READ-ONLY —— 时刻说明
 *     这个工具的性质（本地、只读、确定性），窄屏按优先级逐个丢弃。
 */
import { Box, Text } from "ink";
import type { Layout } from "./geometry.js";
import type { ResolvedTheme } from "./theme.js";
import { displayWidth, truncateWidth } from "../vm/format.js";

/** 结构线字形（no-color 终端可能同时缺 box-drawing，降级 ASCII）。 */
export interface Glyphs {
  h: string;
  v: string;
  down: string;
  up: string;
}

export const BOX_GLYPHS: Glyphs = { h: "─", v: "│", down: "┬", up: "┴" };
export const ASCII_GLYPHS: Glyphs = { h: "-", v: "|", down: "+", up: "+" };

export function glyphsFor(theme: ResolvedTheme): Glyphs {
  return theme.ascii ? ASCII_GLYPHS : BOX_GLYPHS;
}

/**
 * 横向结构线；rail 存在时在竖线所在列放接头字符。
 * 返回恰好 width 列的字符串。
 */
export function ruleLine(layout: Layout, glyphs: Glyphs, kind: "down" | "up"): string {
  const { width, mainWidth, railShown } = layout;
  if (!railShown) return glyphs.h.repeat(Math.max(1, width));
  const junction = mainWidth + 1;
  const left = glyphs.h.repeat(Math.max(0, junction));
  const right = glyphs.h.repeat(Math.max(0, width - junction - 1));
  return `${left}${kind === "down" ? glyphs.down : glyphs.up}${right}`;
}

/**
 * 状态 chips，按优先级逐个丢弃以适配窄屏。
 * 刻意不用 ●/○：它们属于 East Asian Ambiguous，CJK 终端可能按 2 列渲染，
 * 右对齐会整体错位。LIVE 状态改用文字 + 颜色 + 粗体承载。
 */
export function chipsFor(live: boolean, maxWidth: number, ascii = false): string {
  const liveChip = live ? "LIVE" : "SNAPSHOT";
  const full = [liveChip, "LOCAL", "DETERMINISTIC", "READ-ONLY"];
  const candidates = [
    full,
    [liveChip, "LOCAL", "READ-ONLY"],
    [liveChip, "READ-ONLY"],
    [liveChip],
  ];
  // chips 是右对齐的，宽度算错会整条顶栏错位，所以 ascii 模式下连分隔符都得是半宽：
  // · (U+00B7) 属于 East Asian Ambiguous，CJK 终端可能按 2 列渲染。
  const sep = ascii ? " | " : " · ";
  for (const set of candidates) {
    const text = set.join(sep);
    if (displayWidth(text) <= maxWidth) return text;
  }
  return liveChip;
}

/** 顶栏：品牌 + 周期（左）· 状态 chips（右）。 */
export function TopBar({
  theme, layout, periodText, live,
}: {
  theme: ResolvedTheme;
  layout: Layout;
  periodText: string;
  live: boolean;
}): React.ReactNode {
  const t = theme.tokens;
  const brand = "深迹 DEEPTRACE";
  const chips = chipsFor(live, Math.max(6, layout.width - displayWidth(brand) - 6), theme.ascii);
  const leftRoom = layout.width - displayWidth(chips) - displayWidth(brand) - 4;
  const period = leftRoom > 4 ? truncateWidth(periodText, leftRoom, theme.ascii) : "";
  return (
    <Box width={layout.width} justifyContent="space-between">
      <Text>
        <Text color={t.brand} bold>
          {brand}
        </Text>
        {period !== "" ? <Text color={t.muted}>{"  "}{period}</Text> : null}
      </Text>
      <Text color={live ? t.signal : t.muted} bold={live}>
        {chips}
      </Text>
    </Box>
  );
}

/** 竖分隔线（主体高度整列）。 */
export function VerticalDivider({
  theme, height,
}: {
  theme: ResolvedTheme;
  height: number;
}): React.ReactNode {
  const g = glyphsFor(theme);
  return (
    <Box flexDirection="column" width={1} flexShrink={0}>
      {Array.from({ length: Math.max(1, height) }, (_, i) => (
        <Text key={i} color={theme.tokens.muted} dimColor>
          {g.v}
        </Text>
      ))}
    </Box>
  );
}

/** 横向结构线（带接头）。 */
export function StructureRule({
  theme, layout, kind,
}: {
  theme: ResolvedTheme;
  layout: Layout;
  kind: "down" | "up";
}): React.ReactNode {
  return (
    <Text color={theme.tokens.muted} dimColor>
      {ruleLine(layout, glyphsFor(theme), kind)}
    </Text>
  );
}

/**
 * 分区标题：标题 + 拖尾细线填满该栏宽度。
 * 不用边框盒子 —— 盒子在 80 列会吃掉太多列，细线同样能建立层级。
 */
export function PaneTitle({
  theme, width, title, right, tone = "brand",
}: {
  theme: ResolvedTheme;
  width: number;
  title: string;
  /** 右侧元信息（计数 / 排序口径等），空间不足自动丢弃。 */
  right?: string;
  tone?: "brand" | "muted";
}): React.ReactNode {
  const t = theme.tokens;
  const g = glyphsFor(theme);
  const titleW = displayWidth(title);
  const rightText = right ?? "";
  const rightW = rightText === "" ? 0 : displayWidth(rightText) + 1;
  const fill = Math.max(1, width - titleW - rightW - 1);
  return (
    <Text>
      <Text color={tone === "brand" ? t.brand : t.muted} bold>
        {title}
      </Text>
      <Text color={t.muted} dimColor>
        {" "}
        {g.h.repeat(fill)}
      </Text>
      {rightText !== "" ? (
        <Text color={t.muted} dimColor>
          {" "}
          {rightText}
        </Text>
      ) : null}
    </Text>
  );
}

/** 状态栏：视图导航（左）· 时间 / flash（右）。 */
export function StatusBar({
  theme, layout, nav, hint, right, flashActive,
}: {
  theme: ResolvedTheme;
  layout: Layout;
  nav: React.ReactNode;
  /** 当前视图的上下文快捷键提示（窄屏丢弃）。 */
  hint: string;
  right: string;
  flashActive: boolean;
}): React.ReactNode {
  const t = theme.tokens;
  const showHint = layout.width >= 112 && hint !== "";
  const rightText = truncateWidth(right, Math.max(6, Math.floor(layout.width / 3)), theme.ascii);
  return (
    <Box width={layout.width} justifyContent="space-between">
      <Text>
        {nav}
        {showHint ? (
          <Text color={t.muted} dimColor>
            {"   "}
            {hint}
          </Text>
        ) : null}
      </Text>
      <Text color={flashActive ? t.signal : t.muted} dimColor={!flashActive}>
        {rightText}
      </Text>
    </Box>
  );
}

/**
 * 外壳装配：顶栏 / 上线 / [主区 │ 诊断区] / 下线 / 状态栏。
 * 主体两栏都固定宽高，内容溢出由各视图按 bodyHeight 自行裁剪。
 */
export function Shell({
  theme, layout, top, main, rail, bottom,
}: {
  theme: ResolvedTheme;
  layout: Layout;
  top: React.ReactNode;
  main: React.ReactNode;
  rail: React.ReactNode | null;
  bottom: React.ReactNode;
}): React.ReactNode {
  return (
    <Box flexDirection="column" width={layout.width} height={layout.height}>
      {top}
      <StructureRule theme={theme} layout={layout} kind="down" />
      <Box flexDirection="row" height={layout.bodyHeight} flexShrink={0}>
        <Box flexDirection="column" width={layout.mainWidth} flexShrink={0} overflow="hidden">
          {main}
        </Box>
        {layout.railShown && rail !== null ? (
          <>
            <Box width={1} flexShrink={0} />
            <VerticalDivider theme={theme} height={layout.bodyHeight} />
            <Box flexDirection="column" width={layout.railWidth} flexShrink={0} paddingLeft={1} overflow="hidden">
              {rail}
            </Box>
          </>
        ) : null}
      </Box>
      <StructureRule theme={theme} layout={layout} kind="up" />
      {bottom}
    </Box>
  );
}
