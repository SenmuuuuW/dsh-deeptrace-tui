/**
 * 常驻诊断区（右栏）。
 *
 * 这是"报表"变成"工作台"的关键：五个视图共用同一条诊断栏，
 * 所以无论在哪个视图，本期关键数字、待处理项、工具健康结论都在原地不动。
 * 主区负责"你现在在看什么"，诊断区负责"你现在该关心什么"。
 *
 * 高度自适应：按优先级贪心分配（本期 > 需要关注 > 工具健康 > 观察员），
 * 装不下的分区整块丢弃，绝不半截显示。
 */
import { Box, Text } from "ink";
import type { AppData } from "../data/report.js";
import type { OverviewVm } from "../vm/overview.js";
import type { ToolsVm } from "../vm/tools.js";
import { padStartWidth, padWidth, truncateWidth } from "../vm/format.js";
import { PaneTitle } from "./chrome.js";
import type { Layout } from "./geometry.js";
import type { ResolvedTheme } from "./theme.js";
import { WhaleMark, WhaleTick, stateForMood, type WhaleState } from "./whale/Whale.js";

/**
 * 级别标记，恒占 2 列 —— 后面的 tag 按 w-5 截断，标记宽度算错就整列错位。
 * tip 档在非 ascii 用 ·（U+00B7，Ambiguous），CJK 终端可能按 2 列渲染而使整行变 3 列，
 * 所以 ascii 档换半宽 -。critical/warning/info 本来就是纯 ASCII。
 */
function levelMark(level: string, ascii: boolean): string {
  if (level === "critical") return "!!";
  if (level === "warning") return "! ";
  if (level === "tip") return ascii ? "- " : "· ";
  return "  ";
}

function levelColor(theme: ResolvedTheme, level: string): string | undefined {
  if (!theme.color) return undefined;
  const t = theme.tokens;
  return level === "critical" ? t.error : level === "warning" ? t.warn : t.muted;
}

/** 一行 label/value 对齐（label 左，value 右）。 */
function Row({
  theme, width, label, value, tail, valueColor,
}: {
  theme: ResolvedTheme;
  width: number;
  label: string;
  value: string;
  tail?: string;
  valueColor?: string;
}): React.ReactNode {
  const t = theme.tokens;
  const tailText = tail ?? "";
  const tailW = tailText === "" ? 0 : tailText.length + 1;
  const labelW = Math.min(8, Math.max(4, Math.floor(width * 0.4)));
  const valueW = Math.max(3, width - labelW - tailW - 2);
  return (
    <Text>
      {"  "}
      <Text color={t.muted}>{padWidth(truncateWidth(label, labelW, theme.ascii), labelW, theme.ascii)}</Text>
      <Text color={theme.color ? (valueColor ?? t.text) : undefined} bold>
        {padStartWidth(truncateWidth(value, valueW, theme.ascii), valueW, theme.ascii)}
      </Text>
      {tailText !== "" ? <Text color={t.muted} dimColor>{" "}{tailText}</Text> : null}
    </Text>
  );
}

export interface RailProps {
  theme: ResolvedTheme;
  layout: Layout;
  data: AppData;
  overview: OverviewVm;
  tools: ToolsVm;
  /** 加载中时观察员进入 thinking，避免状态说谎。 */
  busy: boolean;
}

/** 各分区最小高度（含标题行与分区间空行）。 */
const H_PERIOD = 5;
const H_ATTENTION_HEAD = 1;
const H_ATTENTION_ITEM = 2;
const H_FAULT = 3;

export function DiagnosticRail({ theme, layout, data, overview, tools, busy }: RailProps): React.ReactNode {
  const t = theme.tokens;
  const w = Math.max(12, layout.railWidth - 1);
  let left = layout.bodyHeight;

  // 本期 KPI：永远显示，它是"我在看哪一段时间的什么量级"的锚点。
  const blocks: React.ReactNode[] = [];
  const kpi = overview.kpi;
  blocks.push(
    <Box key="period" flexDirection="column" flexShrink={0}>
      <PaneTitle theme={theme} width={w} title="本期" right={overview.periodShort} />
      <Row theme={theme} width={w} label="成本" value={kpi.costText} tail={overview.live ? undefined : ""} />
      <Row theme={theme} width={w} label="会话" value={String(kpi.sessions)} />
      <Row theme={theme} width={w} label="Tokens" value={kpi.tokensText} />
      <Row theme={theme} width={w} label="Cache" value={kpi.cacheRateText} />
    </Box>,
  );
  left -= H_PERIOD;

  // 需要关注：剩余高度决定条数，但至少留出工具健康结论的位置。
  const reserve = H_FAULT + 1;
  const roomForItems = Math.max(0, left - H_ATTENTION_HEAD - 1 - reserve);
  const maxItems = Math.min(overview.attention.length, Math.floor(roomForItems / H_ATTENTION_ITEM));
  if (overview.attention.length === 0) {
    blocks.push(
      <Box key="attention" flexDirection="column" flexShrink={0} marginTop={1}>
        <PaneTitle theme={theme} width={w} title="需要关注" right="0" />
        <Text color={t.signal}>{"  本期没有异常项"}</Text>
      </Box>,
    );
    left -= H_ATTENTION_HEAD + 2;
  } else if (maxItems > 0) {
    const items = overview.attention.slice(0, maxItems);
    blocks.push(
      <Box key="attention" flexDirection="column" flexShrink={0} marginTop={1}>
        <PaneTitle theme={theme} width={w} title="需要关注" right={String(overview.attention.length)} />
        {items.map((a) => (
          <Box key={a.id} flexDirection="column" flexShrink={0}>
            <Text>
              {"  "}
              <Text color={levelColor(theme, a.level)} bold>
                {levelMark(a.level, theme.ascii)}
              </Text>
              <Text color={t.text}>{truncateWidth(a.tag, w - 5, theme.ascii)}</Text>
            </Text>
            <Text color={t.muted}>
              {"     "}
              {truncateWidth(a.title, Math.max(6, w - 6), theme.ascii)}
            </Text>
          </Box>
        ))}
      </Box>,
    );
    left -= H_ATTENTION_HEAD + 1 + items.length * H_ATTENTION_ITEM;
  }

  // 工具健康结论：一眼区分调用侧 / 执行侧。
  if (left >= H_FAULT + 1) {
    const v = tools.verdict;
    const vColor = v.side === "exec" ? t.warn : v.side === "call" ? t.brand : v.side === "mixed" ? t.warn : t.muted;
    blocks.push(
      <Box key="fault" flexDirection="column" flexShrink={0} marginTop={1}>
        <PaneTitle theme={theme} width={w} title="工具健康" right={tools.anomalyCount > 0 ? `${tools.anomalyCount} 异常` : "正常"} />
        <Text color={theme.color ? vColor : undefined} bold>
          {"  "}
          {truncateWidth(v.text, w - 2, theme.ascii)}
        </Text>
        <Text color={t.muted} dimColor>
          {"  "}
          {truncateWidth(v.breakdown, w - 2, theme.ascii)}
        </Text>
      </Box>,
    );
    left -= H_FAULT + 1;
  }

  // 观察员：装饰 + 状态提示，放最后，空间不足时先降级成一行，再整块丢弃。
  const state: WhaleState = busy ? "thinking" : stateForMood(data.whale.mood);
  const noteLine = overview.whaleNoteShort[0]?.text ?? "";
  if (layout.mascot === "mark" && left >= 7) {
    blocks.push(
      <Box key="whale" flexDirection="column" flexShrink={0} marginTop={1}>
        <PaneTitle theme={theme} width={w} title="观察员" tone="muted" />
        <WhaleMark state={state} theme={theme} />
        {left >= 9 && noteLine !== "" ? (
          <Text color={t.muted} dimColor>
            {"  "}
            {truncateWidth(noteLine, Math.max(6, w - 2), theme.ascii)}
          </Text>
        ) : null}
      </Box>,
    );
  } else if (layout.mascot !== "none" && left >= 3) {
    blocks.push(
      <Box key="whale" flexDirection="column" flexShrink={0} marginTop={1}>
        <PaneTitle theme={theme} width={w} title="观察员" tone="muted" />
        <WhaleTick state={state} theme={theme} />
      </Box>,
    );
  }

  return (
    <Box flexDirection="column" height={layout.bodyHeight} flexShrink={0} overflow="hidden">
      {blocks}
    </Box>
  );
}
