/**
 * 总览 v3（主工作区侧）：从"KPI 海报"改成"当前工作上下文"。
 *
 * 分工变了：KPI / 需要关注 / 工具健康结论 / 观察员都常驻右侧诊断区，
 * 所以这里不再重复它们，只回答"这段时间我实际在干什么"：
 *   1. 工作节奏 —— 24 小时活跃直方图（每小时事件数，来自 stats.hourHistogram）
 *   2. 主要会话 —— 按折算费用排序的前若干条，带回合/工具/重试
 *   3. 趋势 —— 4 条 sparkline，给方向感
 * 窄屏（无诊断区）时退回自带 KPI + 需要关注，信息不丢。
 */
import { Box, Text } from "ink";
import type { AppData } from "../../data/report.js";
import type { OverviewVm } from "../../vm/overview.js";
import { buildTraceVm } from "../../vm/trace.js";
import { padStartWidth, padWidth, sepOf, truncateWidth } from "../../vm/format.js";
import { Kpi } from "../layout.js";
import { PaneTitle } from "../chrome.js";
import type { Layout } from "../geometry.js";
import type { ResolvedTheme } from "../theme.js";
import { WhaleMark, stateForMood } from "../whale/Whale.js";

const LEVEL_COLOR: Record<string, string | undefined> = {
  critical: "#E5484D",
  warning: "#F5A623",
  tip: "#6FE3D5",
};

/** 需要关注列表（Top N）。选中项 Enter 跳转对应视图。 */
export function AttentionList({
  vm, selected, theme, width,
}: {
  vm: OverviewVm;
  selected: number;
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  return (
    <Box flexDirection="column">
      <PaneTitle theme={theme} width={width} title="需要关注" right={String(vm.attention.length)} />
      {vm.attention.length === 0 && (
        <Text dimColor>
          {"  本期没有需要关注的问题。"}
          <Text color={t.signal}> 数据很干净。</Text>
        </Text>
      )}
      {vm.attention.map((a) => (
        <Box key={a.id} flexDirection="column">
          <Text inverse={selected === a.rank - 1}>
            {"  "}
            {String(a.rank).padStart(2, "0")}{"  "}
            <Text color={LEVEL_COLOR[a.level] ?? t.muted} bold>
              {a.tag}
            </Text>
          </Text>
          <Text dimColor={selected !== a.rank - 1}>
            {"      "}
            {truncateWidth(a.title, Math.max(8, width - 6), theme.ascii)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/** 趋势压缩：4 行（label + sparkline + 当前值）。 */
export function TrendBlock({ vm, theme, width }: { vm: OverviewVm; theme: ResolvedTheme; width: number }): React.ReactNode {
  const t = theme.tokens;
  return (
    <Box flexDirection="column">
      <PaneTitle theme={theme} width={width} title="趋势" right="近 8 期" />
      {vm.trend.map((l) => (
        <Text wrap="truncate" key={l.title}>
          {"  "}
          <Text color={t.muted}>{padWidth(l.title, 8, theme.ascii)}</Text>
          <Text color={t.brand}>{l.spark}</Text>
          <Text color={t.text} bold>{"  "}{l.value}</Text>
        </Text>
      ))}
    </Box>
  );
}

/**
 * 24 小时活跃直方图。三行半高度：用 ▁▂▃▄▅▆▇█ 一行画完，
 * 下面配 0/6/12/18 刻度，比 24 行竖条省地方且一眼看出作息。
 */
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const ASCII_BLOCKS = [".", ".", ":", ":", "|", "|", "#", "#"];

export function RhythmBlock({
  hours, theme, width,
}: {
  hours: readonly number[];
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const glyphs = theme.ascii ? ASCII_BLOCKS : BLOCKS;
  const max = Math.max(1, ...hours);
  // 每小时占 2 列，24 小时 = 48 列；不够宽就退成每小时 1 列。
  const wide = width >= 52;
  const bars = hours
    .map((n) => {
      const g = n === 0 ? " " : glyphs[Math.min(glyphs.length - 1, Math.max(0, Math.ceil((n / max) * glyphs.length) - 1))];
      return wide ? g.repeat(2) : g;
    })
    .join("");
  const scale = wide
    ? "0     3     6     9     12    15    18    21   "
    : "0  3  6  9  12 15 18 21 ";
  const peak = hours.indexOf(max);
  const night = hours.slice(0, 6).reduce((a, b) => a + b, 0) + hours[23];
  const total = hours.reduce((a, b) => a + b, 0);
  const nightPct = total > 0 ? Math.round((night / total) * 100) : 0;
  return (
    <Box flexDirection="column">
      <PaneTitle theme={theme} width={width} title="工作节奏" right={`峰值 ${String(peak).padStart(2, "0")}:00 ${sepOf(theme.ascii)} 夜间 ${nightPct}%`} />
      <Text color={t.brand}>{"  "}{truncateWidth(bars, Math.max(8, width - 2), theme.ascii)}</Text>
      <Text color={t.muted} dimColor>{"  "}{truncateWidth(scale, Math.max(8, width - 2), theme.ascii)}</Text>
    </Box>
  );
}

/** 主要会话：按折算费用排序，一行一条。 */
export function TopSessions({
  data, theme, width, max,
}: {
  data: AppData;
  theme: ResolvedTheme;
  width: number;
  max: number;
}): React.ReactNode {
  const t = theme.tokens;
  const items = buildTraceVm(data.stats).items.slice(0, max);
  const costW = 9;
  const metaW = 22;
  // 标记必须先占位再算标题宽 —— 否则 " R30" 会把行顶出容器、换行成两行。
  const markW = items.some((s) => s.retries > 0 || s.redDanger > 0) ? 7 : 0;
  const titleW = Math.max(10, width - costW - metaW - markW - 2);
  return (
    <Box flexDirection="column">
      <PaneTitle theme={theme} width={width} title="主要会话" right={`共 ${data.stats.sessions} ${sepOf(theme.ascii)} 按费用`} />
      {items.length === 0 ? <Text dimColor>{"  本期没有会话记录"}</Text> : null}
      {items.map((s) => (
        <Text key={s.sessionId} wrap="truncate">
          {"  "}
          <Text color={t.text}>{padWidth(truncateWidth(s.title, titleW, theme.ascii), titleW, theme.ascii)}</Text>
          <Text color={t.brand} bold>{padStartWidth(s.costText, costW, theme.ascii)}</Text>
          <Text color={t.muted} dimColor>
            {padStartWidth(`${s.turns} 回合 ${sepOf(theme.ascii)} ${s.toolCalls} 工具`, metaW, theme.ascii)}
          </Text>
          {markW > 0 ? (
            <Text color={s.redDanger > 0 ? t.error : t.warn} bold={s.redDanger > 0}>
              {padStartWidth(
                `${s.retries > 0 ? `R${s.retries}` : ""}${s.redDanger > 0 ? "!" : ""}`,
                markW,
                theme.ascii,
              )}
            </Text>
          ) : null}
        </Text>
      ))}
    </Box>
  );
}

export function OverviewView({
  vm, data, theme, selected, noteOpen, layout, showWhale,
}: {
  vm: OverviewVm;
  data: AppData;
  theme: ResolvedTheme;
  /** 选择位：0..attention-1 为需要关注项，attention 为鲸评条目。 */
  selected: number;
  noteOpen: boolean;
  layout: Layout;
  /** 无诊断区时主区自己带鲸鱼。 */
  showWhale: boolean;
}): React.ReactNode {
  const w = layout.mainWidth;
  const whaleSelected = selected >= vm.attention.length;
  const noRail = !layout.railShown;

  // 鲸评展开：占满主区，读长文时不需要其他东西抢注意力。
  if (noteOpen) {
    return (
      <Box flexDirection="column" height={layout.bodyHeight}>
        <PaneTitle theme={theme} width={w} title="鲸评" right="Esc 收起" />
        {vm.whaleNoteFull.slice(0, Math.max(1, layout.bodyHeight - 2)).map((l, i) => (
          <Text
            key={i}
            color={
              l.kind === "opener" ? theme.tokens.userAccent
              : l.kind === "aside" ? theme.tokens.warn
              : l.kind === "footer" || l.kind === "closer" ? theme.tokens.muted
              : theme.tokens.text
            }
            dimColor={l.kind === "closer" || l.kind === "footer"}
          >
            {"  "}
            {truncateWidth(l.text, Math.max(8, w - 2), theme.ascii)}
          </Text>
        ))}
      </Box>
    );
  }

  // 高度预算：装不下的分区整块丢弃，绝不半截。
  let left = layout.bodyHeight;
  const blocks: React.ReactNode[] = [];
  const take = (n: number): boolean => {
    if (left < n) return false;
    left -= n;
    return true;
  };

  if (noRail) {
    // 窄屏没有诊断区，KPI 与需要关注必须回到主区，否则最重要的信息会消失。
    if (take(3)) {
      blocks.push(
        <Box key="kpi" flexDirection="column" flexShrink={0}>
          <Kpi vm={vm.kpi} theme={theme} width={w} />
        </Box>,
      );
    }
    const n = vm.attention.length === 0 ? 2 : 1 + vm.attention.length * 2;
    if (take(n + 1)) {
      blocks.push(
        <Box key="attention" flexDirection="column" flexShrink={0} marginTop={1}>
          <AttentionList vm={vm} selected={whaleSelected ? -1 : selected} theme={theme} width={w} />
        </Box>,
      );
    }
  }

  if (take(4)) {
    blocks.push(
      <Box key="rhythm" flexDirection="column" flexShrink={0} marginTop={blocks.length > 0 ? 1 : 0}>
        <RhythmBlock hours={data.stats.hourHistogram} theme={theme} width={w} />
      </Box>,
    );
  }

  // 主要会话吃掉剩余高度（留出趋势的 5 行），这是"填满屏幕"的主力。
  const trendCost = 6;
  const sessionRoom = Math.max(0, left - 1 - (left >= trendCost + 3 ? trendCost : 0));
  const sessionMax = Math.min(12, Math.max(0, sessionRoom - 1));
  if (sessionMax > 0 && take(1 + sessionMax + 1)) {
    blocks.push(
      <Box key="sessions" flexDirection="column" flexShrink={0} marginTop={1}>
        <TopSessions data={data} theme={theme} width={w} max={sessionMax} />
      </Box>,
    );
  }

  if (take(trendCost)) {
    blocks.push(
      <Box key="trend" flexDirection="column" flexShrink={0} marginTop={1}>
        <TrendBlock vm={vm} theme={theme} width={w} />
      </Box>,
    );
  }

  if (showWhale && left >= 5) {
    blocks.push(
      <Box key="whale" flexDirection="column" flexShrink={0} marginTop={1}>
        <WhaleMark state={stateForMood(vm.whaleMood)} theme={theme} />
        <Text color={theme.tokens.muted} dimColor>
          {"  "}
          {truncateWidth(vm.whaleNoteShort[0]?.text ?? "", Math.max(8, w - 2), theme.ascii)}
          <Text color={theme.tokens.brand}>{"  [Enter] 鲸评"}</Text>
        </Text>
      </Box>,
    );
  }

  return (
    <Box flexDirection="column" height={layout.bodyHeight} overflow="hidden">
      {blocks}
    </Box>
  );
}
