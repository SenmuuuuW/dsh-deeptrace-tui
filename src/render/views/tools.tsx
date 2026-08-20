/**
 * 工具健康 v3：先给结论，再给证据。
 *
 * 这一版要回答的核心问题是"是调用侧的问题，还是执行侧的问题"：
 *   · 顶部一行判定：全期错误码归因方向 + 分布 + 无结果调用数；
 *   · 异常工具每个一块，带自己的归因方向、失败率条、原始错误码（错误码永远原样显示）；
 *   · 正常工具压缩成表，宽屏双列，只占该占的地方。
 * 归因规则见 vm/fault.ts —— 只认含义明确的知名错误码，其余进「未归因」，不编语义。
 */
import { Box, Text } from "ink";
import {
  TOOL_HEALTH_MIN_CALLS,
  TOOL_HEALTH_MIN_FAILED,
  TOOL_HEALTH_MIN_FAILURE_RATE,
} from "../../core/index.js";
import type { ToolsVm, ToolVm } from "../../vm/tools.js";
import { FAULT_LABEL, type FaultSide } from "../../vm/fault.js";
import { displayWidth, padStartWidth, padWidth, ratioBar, sepOf, truncateWidth } from "../../vm/format.js";
import { windowSlice } from "../Frame.js";
import { PaneTitle } from "../chrome.js";
import type { Layout } from "../geometry.js";
import type { ResolvedTheme } from "../theme.js";

/**
 * 异常门槛文案：直接由 core 的常量算出，不在 TUI 内硬编码数字。
 * must stay aligned with core insight thresholds（改 core 常量即改这里的显示）。
 * ≥ (U+2265) 属 East Asian Ambiguous，ascii 档退回 ">=" 保证半宽。
 */
function anomalyGateText(ascii: boolean): string {
  const ge = ascii ? ">=" : "≥";
  const pct = Math.round(TOOL_HEALTH_MIN_FAILURE_RATE * 100);
  return `${ge}${TOOL_HEALTH_MIN_CALLS} 次调用、${ge}${TOOL_HEALTH_MIN_FAILED} 次失败且失败率 ${ge}${pct}%`;
}

function sideColor(theme: ResolvedTheme, side: FaultSide | "mixed" | "none"): string | undefined {
  if (!theme.color) return undefined;
  const t = theme.tokens;
  return side === "exec" ? t.warn : side === "call" ? t.brand : side === "mixed" ? t.warn : t.muted;
}

/** 判定条：一眼看出方向。放最上面，是这个视图存在的理由。 */
function VerdictBar({ vm, theme, width }: { vm: ToolsVm; theme: ResolvedTheme; width: number }): React.ReactNode {
  const t = theme.tokens;
  const v = vm.verdict;
  return (
    <Box flexDirection="column" flexShrink={0}>
      <PaneTitle
        theme={theme}
        width={width}
        title="判定"
        right={`${vm.tools.length} 工具 ${sepOf(theme.ascii)} ${vm.totalCalls} 次调用 ${sepOf(theme.ascii)} ${vm.totalFailed} 次失败`}
      />
      <Text>
        {"  "}
        <Text color={sideColor(theme, v.side)} bold>
          {v.text}
        </Text>
        <Text color={t.muted} dimColor>
          {"   "}
          {v.breakdown}
        </Text>
      </Text>
      <Text color={t.muted} dimColor>
        {"  "}
        {v.lowConfidence
          ? "过半错误码语义未知，方向仅供参考；错误码原样列在下方。"
          : `调用侧＝参数/目标与现实不符 ${sepOf(theme.ascii)} 执行侧＝环境未能执行完成`}
      </Text>
    </Box>
  );
}

/** 异常工具块：名字 + 自己的方向 + 速率 + 失败率条 + 原始错误码。 */
function AttentionTool({
  tool, selected, theme, width,
}: {
  tool: ToolVm;
  selected: boolean;
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const codes = tool.errorCodes
    .map((e) => `${e.code}${theme.ascii ? "x" : "×"}${e.count}`)
    .join("  ");
  return (
    <Box flexDirection="column" flexShrink={0}>
      <Text wrap="truncate" inverse={selected}>
        {"  "}
        <Text color={t.warn} bold>
          {padWidth(truncateWidth(tool.name, 18, theme.ascii), 18, theme.ascii)}
        </Text>
        <Text color={t.error} bold>
          {padStartWidth(`失败 ${tool.failureRateText}`, 12, theme.ascii)}
        </Text>
        <Text color={t.muted}>
          {padStartWidth(`${tool.calls} 次 ${sepOf(theme.ascii)} ${tool.failed} 失败${tool.incomplete > 0 ? ` ${sepOf(theme.ascii)} ${tool.incomplete} 无结果` : ""}`, 26, theme.ascii)}
        </Text>
      </Text>
      <Text wrap="truncate" dimColor={!selected}>
        {"    "}
        <Text color={t.error}>{tool.bar}</Text>
        <Text color={t.muted}>
          {"  "}
          p50 {tool.p50Text} {sepOf(theme.ascii)} p95 {tool.p95Text}
        </Text>
        <Text color={sideColor(theme, tool.verdict.side)} bold>
          {"  "}
          {tool.verdict.side === "none" ? "" : FAULT_LABEL[tool.verdict.side as FaultSide] ?? "两侧混合"}
        </Text>
      </Text>
      {codes !== "" ? (
        <Text wrap="truncate" color={t.muted} dimColor={!selected}>
          {"    "}
          {truncateWidth(codes, Math.max(8, width - 4), theme.ascii)}
        </Text>
      ) : null}
    </Box>
  );
}

/**
 * 有失败但未达异常门槛：整宽一行，带错误码与归因方向。
 * 这一档刻意不塞进双列压缩表 —— 双列只有 ~58 列，错误码会被截成看不懂的残串，
 * 而"有失败"的工具恰恰是最需要看清错误码的。
 */
function FailingToolRow({
  tool, selected, theme, width,
}: {
  tool: ToolVm;
  selected: boolean;
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const nameW = Math.max(10, Math.min(18, width - 46));
  const codes = tool.errorCodes.map((e) => `${e.code}${theme.ascii ? "x" : "×"}${e.count}`).join("  ");
  const sideText = tool.verdict.side === "none" || tool.verdict.side === "mixed" ? "" : FAULT_LABEL[tool.verdict.side as FaultSide];

  // 错误码是这一档存在的理由，优先保它：位置不够时按 均时 → 归因标签 的顺序让位。
  // 首个错误码的完整宽度就是这一行的硬需求。
  const firstCodeW = displayWidth(tool.errorCodes[0] === undefined
    ? ""
    : `${tool.errorCodes[0].code}${theme.ascii ? "x" : "×"}${tool.errorCodes[0].count}`);
  const base = 2 + nameW + 10 + 8 + 2;
  let showAvg = true;
  let showSide = sideText !== "";
  const fits = (): number => width - (base + (showAvg ? 10 : 0) + (showSide ? 8 : 0));
  if (fits() < firstCodeW) showAvg = false;
  if (fits() < firstCodeW) showSide = false;
  const codeRoom = Math.max(0, fits());

  return (
    <Text wrap="truncate" dimColor={!selected} inverse={selected}>
      {"  "}
      <Text color={t.text}>{padWidth(truncateWidth(tool.name, nameW, theme.ascii), nameW, theme.ascii)}</Text>
      <Text color={t.warn}>{padStartWidth(`失败 ${tool.failed}`, 10, theme.ascii)}</Text>
      <Text color={t.muted}>{padStartWidth(`${tool.calls} 次`, 8, theme.ascii)}</Text>
      {showAvg ? (
        <Text color={t.muted} dimColor>{padStartWidth(tool.avgDurationText, 10, theme.ascii)}</Text>
      ) : null}
      {showSide ? (
        <Text color={sideColor(theme, tool.verdict.side)}>{padStartWidth(sideText, 8, theme.ascii)}</Text>
      ) : null}
      {codes !== "" && codeRoom >= 6 ? (
        <Text color={t.muted}>
          {"  "}
          {truncateWidth(codes, codeRoom, theme.ascii)}
        </Text>
      ) : null}
    </Text>
  );
}

/** 零失败工具：一行压缩（名字 / 成功率 / 次数 / 均时），宽屏双列。 */
function NormalToolRow({
  tool, selected, theme, width,
}: {
  tool: ToolVm;
  selected: boolean;
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const nameW = Math.max(8, Math.min(20, width - 26));
  return (
    <Text wrap="truncate" dimColor={!selected} inverse={selected}>
      {"  "}
      <Text color={t.text}>{padWidth(truncateWidth(tool.name, nameW, theme.ascii), nameW, theme.ascii)}</Text>
      <Text color={t.muted}>{padStartWidth(tool.successRateText, 7, theme.ascii)}</Text>
      <Text color={t.muted}>{padStartWidth(String(tool.calls), 7, theme.ascii)}</Text>
      <Text color={t.muted} dimColor>{padStartWidth(tool.avgDurationText, 8, theme.ascii)}</Text>
    </Text>
  );
}

/**
 * 耗时排行：按 p95 降序，比例条以最慢工具为基准。
 * 放在最后一档，用来吃掉剩余高度 —— 宁可给真实的 p95，也不留一片空白。
 * 只在还有 >=4 行余量时出现，不挤压上面的结论区。
 */
function LatencyBlock({
  tools, theme, width, rows,
}: {
  tools: readonly ToolVm[];
  theme: ResolvedTheme;
  width: number;
  rows: number;
}): React.ReactNode {
  const t = theme.tokens;
  const ranked = [...tools].filter((x) => x.p95Ms > 0).sort((a, b) => b.p95Ms - a.p95Ms).slice(0, rows);
  if (ranked.length === 0) return null;
  const max = ranked[0]!.p95Ms;
  const nameW = 18;
  const barW = Math.max(8, Math.min(32, width - nameW - 26));
  return (
    <Box flexDirection="column" flexShrink={0} marginTop={1}>
      <PaneTitle theme={theme} width={width} title="耗时排行" right="按 p95 降序" tone="muted" />
      {ranked.map((tool) => (
        <Text key={tool.name} wrap="truncate">
          {"  "}
          <Text color={t.text}>{padWidth(truncateWidth(tool.name, nameW, theme.ascii), nameW, theme.ascii)}</Text>
          <Text color={t.muted} dimColor>{padWidth(ratioBar(tool.p95Ms, max, barW, theme.ascii), barW, theme.ascii)}</Text>
          <Text color={t.muted}>{padStartWidth(tool.p95Text, 9, theme.ascii)}</Text>
          <Text color={t.muted} dimColor>{padStartWidth(`p50 ${tool.p50Text}`, 13, theme.ascii)}</Text>
        </Text>
      ))}
    </Box>
  );
}

export function ToolsView({
  vm, selected, theme, layout,
}: {
  vm: ToolsVm;
  selected: number;
  theme: ResolvedTheme;
  layout: Layout;
}): React.ReactNode {
  const t = theme.tokens;
  const w = layout.mainWidth;
  // 三档划分来自 vm.tiers（唯一真相源），视图不再自己 filter —— 否则两边顺序会悄悄分叉。
  const { anomalies, failing, normal } = vm.tiers;
  // 选中索引的分档边界：与 tiers.flat 的拼接顺序严格一致。
  const fStart = anomalies.length;
  const nStart = anomalies.length + failing.length;

  // 高度分配：判定 3 行固定；异常块每个 4 行，最多吃掉主区六成；有失败档每个 1 行；余下给零失败表。
  let left = layout.bodyHeight - 3;
  const anomalyBudget = Math.max(0, Math.floor(left * 0.6));
  const perAnomaly = 4;
  const anomalyRows = anomalies.length === 0 ? 0 : Math.max(1, Math.min(anomalies.length, Math.floor(anomalyBudget / perAnomaly)));
  // 每档都跟着选中项滚动：截断档位时若不滚动，被截掉的条目仍可被 j/k 选中却看不见。
  const aSlice = windowSlice(anomalies, selected, anomalyRows);
  left -= anomalyRows === 0 ? 2 : 1 + anomalyRows * perAnomaly;

  const failingRows = failing.length === 0 ? 0 : Math.max(1, Math.min(failing.length, Math.max(0, left - 3)));
  const fSlice = windowSlice(failing, Math.max(0, selected - fStart), failingRows);
  left -= failingRows === 0 ? 0 : 1 + failingRows;

  const normalHeader = 2;
  const twoCol = w >= 76;
  // 零失败表只吃自己需要的高度：双列时行数减半，剩下的让给耗时排行。
  const normalNeedRows = Math.ceil(normal.length / (twoCol ? 2 : 1));
  const normalRowsAvail = Math.max(1, Math.min(normalNeedRows, left - normalHeader));
  const normalRows = twoCol ? normalRowsAvail * 2 : normalRowsAvail;
  const normalSlice = windowSlice(normal, Math.max(0, selected - nStart), normalRows);
  left -= normalSlice.slice.length === 0 ? 0 : normalHeader + normalRowsAvail;

  // 余量给耗时排行：标题 1 行 + 至少 3 行数据才值得开这一块。
  const latencyRows = left >= 4 ? Math.min(left - 2, 8) : 0;
  const colWidth = twoCol ? Math.floor((w - 2) / 2) : w;
  const perCol = Math.ceil(normalSlice.slice.length / (twoCol ? 2 : 1));
  const leftCol = normalSlice.slice.slice(0, perCol);
  const rightCol = twoCol ? normalSlice.slice.slice(perCol) : [];

  return (
    <Box flexDirection="column" height={layout.bodyHeight} overflow="hidden">
      <VerdictBar vm={vm} theme={theme} width={w} />
      <Box flexDirection="column" flexShrink={0} marginTop={1}>
        {anomalyRows === 0 ? (
          <Text color={t.signal}>{`  没有达到异常门槛的工具（${anomalyGateText(theme.ascii)}）。`}</Text>
        ) : (
          <>
            <PaneTitle
              theme={theme}
              width={w}
              title="异常工具"
              right={`${anomalies.length} 个 ${sepOf(theme.ascii)} 关注度排序${aSlice.up || aSlice.down ? ` ${sepOf(theme.ascii)} j/k 滚动` : ""}`}
            />
            {aSlice.slice.map((tool, i) => (
              <AttentionTool
                key={tool.name}
                tool={tool}
                selected={selected === aSlice.start + i}
                theme={theme}
                width={w}
              />
            ))}
          </>
        )}
      </Box>
      {fSlice.slice.length > 0 ? (
        <Box flexDirection="column" flexShrink={0} marginTop={1}>
          <PaneTitle
            theme={theme}
            width={w}
            title="有失败（未达门槛）"
            right={`${failing.length} 个 ${sepOf(theme.ascii)} 错误码原样${fSlice.up || fSlice.down ? ` ${sepOf(theme.ascii)} j/k 滚动` : ""}`}
          />
          {fSlice.slice.map((tool, i) => (
            <FailingToolRow
              key={tool.name}
              tool={tool}
              selected={selected === fStart + fSlice.start + i}
              theme={theme}
              width={w}
            />
          ))}
        </Box>
      ) : null}
      {normalSlice.slice.length > 0 ? (
        <Box flexDirection="column" flexShrink={0} marginTop={1}>
          <PaneTitle
            theme={theme}
            width={w}
            title="零失败工具"
            right={`${normal.length} 个${normalSlice.up || normalSlice.down ? ` ${sepOf(theme.ascii)} j/k 滚动` : ""}`}
            tone="muted"
          />
          <Box flexDirection="row" flexShrink={0}>
            <Box flexDirection="column" width={colWidth} flexShrink={0}>
              {leftCol.map((tool, i) => (
                <NormalToolRow
                  key={tool.name}
                  tool={tool}
                  selected={selected === nStart + normalSlice.start + i}
                  theme={theme}
                  width={colWidth}
                />
              ))}
            </Box>
            {twoCol ? (
              <Box flexDirection="column" width={colWidth} flexShrink={0} marginLeft={2}>
                {rightCol.map((tool, i) => (
                  <NormalToolRow
                    key={tool.name}
                    tool={tool}
                    selected={selected === nStart + normalSlice.start + perCol + i}
                    theme={theme}
                    width={colWidth}
                  />
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>
      ) : null}
      {latencyRows >= 3 ? (
        <LatencyBlock tools={vm.tools} theme={theme} width={w} rows={latencyRows} />
      ) : null}
    </Box>
  );
}
