/**
 * 工具健康 v2：异常优先，权重分级 —— 异常工具详细块，正常工具压缩一行。
 */
import { Box, Text } from "ink";
import type { ToolsVm, ToolVm } from "../../vm/tools.js";
import { windowSlice } from "../Frame.js";
import type { ResolvedTheme } from "../theme.js";

function AttentionTool({ tool, selected, theme }: { tool: ToolVm; selected: boolean; theme: ResolvedTheme }): React.ReactNode {
  const t = theme.tokens;
  const errCodes = tool.errorCodes.map((e) => `${e.code} ${String(e.count).padStart(3)}`).join("   ");
  return (
    <Box flexDirection="column">
      <Text inverse={selected}>
        <Text color={t.warn} bold>{tool.name}</Text>
        <Text color={t.warn}>  ATTENTION</Text>
      </Text>
      <Text dimColor={!selected}>
        {tool.successRateText}   {tool.calls} calls   {tool.failed} failed   {tool.avgDurationText}
      </Text>
      <Text dimColor={!selected}>{tool.bar}</Text>
      {errCodes !== "" && <Text dimColor={!selected}>{errCodes}</Text>}
    </Box>
  );
}

/** 正常工具：一行压缩。 */
function NormalToolRow({ tool, selected }: { tool: ToolVm; selected: boolean }): React.ReactNode {
  return (
    <Text dimColor={!selected} inverse={selected}>
      {tool.name.padEnd(16)}
      {tool.successRateText.padStart(7)}  {String(tool.calls).padStart(6)}
      {tool.failed > 0 ? <Text color="#F5A623">  {tool.failed} failed</Text> : null}
    </Text>
  );
}

export function ToolsView({
  vm, selected, theme, wide, width, height,
}: {
  vm: ToolsVm;
  selected: number;
  theme: ResolvedTheme;
  /** WIDE 档：正常工具双列。 */
  wide: boolean;
  width: number;
  height: number;
}): React.ReactNode {
  const t = theme.tokens;
  const anomalies = vm.tools.filter((x) => x.anomaly);
  const normal = vm.tools.filter((x) => !x.anomaly);
  const attentionRows = Math.min(anomalies.length, Math.max(2, height - 12));
  const normalRows = Math.max(1, height - 4 - attentionRows * 4);

  const normalSlice = windowSlice(normal, Math.max(0, selected - anomalies.length), normalRows);
  const nStart = anomalies.length;

  const normalCols = wide ? 2 : 1;
  const perCol = Math.ceil(normalSlice.slice.length / normalCols);
  const leftCol = normalSlice.slice.slice(0, perCol);
  const rightCol = normalSlice.slice.slice(perCol);

  return (
    <Box flexDirection="column">
      <Text dimColor>
        工具健康 TOOL HEALTH · {vm.tools.length} 个工具 · {vm.totalCalls} calls · {vm.totalFailed} failed
      </Text>
      <Box flexDirection="column" marginTop={0}>
        {anomalies.slice(0, attentionRows).map((tool, i) => (
          <Box key={tool.name} marginTop={i === 0 ? 0 : 1}>
            <AttentionTool tool={tool} selected={selected === i} theme={theme} />
          </Box>
        ))}
        {anomalies.length === 0 && <Text dimColor>没有异常工具。</Text>}
      </Box>
      {normalSlice.up && <Text dimColor>▲</Text>}
      {normalCols === 1 ? (
        <Box flexDirection="column" marginTop={normalSlice.slice.length > 0 ? 1 : 0}>
          {normalSlice.slice.map((tool, i) => (
            <NormalToolRow key={tool.name} tool={tool} selected={selected === nStart + normalSlice.start + i} />
          ))}
        </Box>
      ) : (
        <Box flexDirection="row" marginTop={normalSlice.slice.length > 0 ? 1 : 0}>
          <Box flexDirection="column" width={Math.floor(width / 2) - 1} marginRight={2}>
            {leftCol.map((tool, i) => (
              <NormalToolRow key={tool.name} tool={tool} selected={selected === nStart + normalSlice.start + i} />
            ))}
          </Box>
          <Box flexDirection="column" width={Math.floor(width / 2) - 1}>
            {rightCol.map((tool, i) => (
              <NormalToolRow key={tool.name} tool={tool} selected={selected === nStart + normalSlice.start + perCol + i} />
            ))}
          </Box>
        </Box>
      )}
      {normalSlice.down && <Text dimColor>▼</Text>}
      <Text color={t.muted} dimColor>  </Text>
    </Box>
  );
}
