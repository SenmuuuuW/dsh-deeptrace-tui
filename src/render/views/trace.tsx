/**
 * 会话轨迹 v2：profiler 式。
 * 宽屏（WIDE/STANDARD）：左 Session 列表 + 右当前项 detail（常显）。
 * 窄屏（COMPACT）：列表 → Enter → detail 全屏。
 */
import { Box, Text } from "ink";
import type { TraceVm, TraceItemVm } from "../../vm/trace.js";
import { windowSlice } from "../Frame.js";
import type { ResolvedTheme } from "../theme.js";

function riskMarkers(item: { retries: number; dangerCount: number; redDanger: number; secrets: number }): React.ReactNode {
  const marks: React.ReactNode[] = [];
  if (item.retries >= 3) marks.push(<Text key="retry" color="#F5A623">{item.retries} RETRY</Text>);
  if (item.redDanger > 0) marks.push(<Text key="red" color="#E5484D">{item.redDanger} RED</Text>);
  if (item.dangerCount > 0) marks.push(<Text key="risk" color="#E5484D">{item.dangerCount} RISK</Text>);
  if (item.secrets > 0) marks.push(<Text key="secret" color="#F5A623">{item.secrets} SECRET</Text>);
  if (marks.length === 0) return null;
  return (
    <>
      {"  "}
      {marks.map((m, i) => (
        <Text key={i}>{m} </Text>
      ))}
    </>
  );
}

export function SessionDetail({
  item, theme,
}: {
  item: TraceItemVm;
  theme: ResolvedTheme;
}): React.ReactNode {
  const t = theme.tokens;
  return (
    <Box flexDirection="column">
      <Text color={t.signal} bold>
        SESSION #{String(item.rank).padStart(2, "0")}
      </Text>
      <Text dimColor>{item.title}</Text>
      <Box marginTop={1}>
        <Text>Cost     {item.costText}</Text>
      </Box>
      <Text>Tokens   {item.tokensText}</Text>
      <Text>Tools    {item.toolCalls} · turns {item.turns}</Text>
      <Text>
        Retry    {item.retries}
        {item.dangerCount > 0 ? ` · ${item.dangerCount} RISK${item.redDanger > 0 ? ` (${item.redDanger} RED)` : ""}` : ""}
        {item.secrets > 0 ? ` · ${item.secrets} SECRET` : ""}
      </Text>
      <Text dimColor>{item.firstTimeText} ~ {item.lastTimeText}</Text>
      <Box marginTop={1}>
        <Text dimColor>[c] 复制 Session ID</Text>
      </Box>
    </Box>
  );
}

export function TraceView({
  vm, selected, detail, wide, theme, height,
}: {
  vm: TraceVm;
  selected: number;
  detail: number | null;
  wide: boolean;
  theme: ResolvedTheme;
  height: number;
}): React.ReactNode {
  const t = theme.tokens;
  const maxRows = Math.max(2, height - 3);
  const { slice, start, up, down } = windowSlice(vm.items, selected, maxRows);

  // 窄屏 + detail 打开：全屏 detail。
  if (!wide && detail !== null) {
    const item = vm.items[detail];
    if (item === undefined) return null;
    return <SessionDetail item={item} theme={theme} />;
  }

  const list = (
    <Box flexDirection="column" flexGrow={1}>
      <Text dimColor>
        {vm.items.length} sessions · by cost
      </Text>
      {up && <Text dimColor>▲</Text>}
      {slice.map((item, i) => {
        const idx = start + i;
        const active = wide ? idx === selected : idx === selected;
        return (
          <Box key={item.sessionId} flexDirection="column">
            <Text inverse={active}>
              {String(item.rank).padStart(2, "0")}{" "}
              <Text color={t.signal} bold>{item.costText}</Text>
              {riskMarkers(item)}
            </Text>
            <Text dimColor={!active}>
              {"     "}
              {item.title.length > 34 ? `${item.title.slice(0, 33)}…` : item.title}
            </Text>
          </Box>
        );
      })}
      {down && <Text dimColor>▼</Text>}
    </Box>
  );

  if (wide) {
    const current = vm.items[selected];
    return (
      <Box flexDirection="row" flexGrow={1}>
        <Box width={42} flexGrow={0} marginRight={2}>
          {list}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {current !== undefined ? <SessionDetail item={current} theme={theme} /> : null}
        </Box>
      </Box>
    );
  }
  return list;
}
