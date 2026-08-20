/**
 * 会话轨迹 v3：log explorer 式。
 * 主区可拆分时（>=76 列）：左会话列表 + 右当前项详情，选中即预览，不用按 Enter。
 * 不可拆分时：列表 → Enter → 详情占满主区。
 *
 * 列表一行一条（不是两行），像日志一样可以快速扫；标题截断而不是换行，
 * 因为在 log explorer 里"对齐的列"比"完整的标题"更有用。
 */
import { Box, Text } from "ink";
import type { TraceVm, TraceItemVm } from "../../vm/trace.js";
import { displayWidth, formatPct, padStartWidth, padWidth, ratioBar, sepOf, truncateWidth } from "../../vm/format.js";
import { windowSlice } from "../Frame.js";
import { PaneTitle } from "../chrome.js";
import type { Layout } from "../geometry.js";
import type { ResolvedTheme } from "../theme.js";

/**
 * 风险标记：只用大写短标签 + 颜色，不用符号（避免歧义宽度）。
 * 返回纯数据而不是节点 —— 调用方必须先知道标记要占多少列，
 * 否则 " RISK9 RETRY31" 会把整行顶出容器、换行成两行。
 */
interface RiskMark { key: string; text: string; tone: "error" | "warn"; bold: boolean }

function riskMarksOf(
  item: { retries: number; dangerCount: number; redDanger: number; secrets: number },
): RiskMark[] {
  const marks: RiskMark[] = [];
  if (item.redDanger > 0) marks.push({ key: "red", text: `RED${item.redDanger}`, tone: "error", bold: true });
  else if (item.dangerCount > 0) marks.push({ key: "risk", text: `RISK${item.dangerCount}`, tone: "error", bold: false });
  if (item.retries >= 3) marks.push({ key: "retry", text: `RETRY${item.retries}`, tone: "warn", bold: false });
  if (item.secrets > 0) marks.push({ key: "secret", text: `SEC${item.secrets}`, tone: "warn", bold: false });
  return marks;
}

/** 标记按优先级裁剪到给定列宽内（前面的更重要，先保）。 */
function fitMarks(marks: readonly RiskMark[], room: number): RiskMark[] {
  const kept: RiskMark[] = [];
  let used = 0;
  for (const m of marks) {
    const need = displayWidth(m.text) + 1;
    if (used + need > room) break;
    kept.push(m);
    used += need;
  }
  return kept;
}

function MarkRun({ marks, theme, room }: { marks: readonly RiskMark[]; theme: ResolvedTheme; room: number }): React.ReactNode {
  const t = theme.tokens;
  const kept = fitMarks(marks, room);
  if (kept.length === 0) return null;
  return (
    <>
      {kept.map((m) => (
        <Text key={m.key} color={m.tone === "error" ? t.error : t.warn} bold={m.bold}>
          {" "}
          {m.text}
        </Text>
      ))}
    </>
  );
}

/** 详情：字段名固定列宽，值左对齐 —— 像 inspector 面板，不像句子。 */
export function SessionDetail({
  item, theme, width, modelRows = 0,
}: {
  item: TraceItemVm;
  theme: ResolvedTheme;
  width: number;
  /** 余量允许时展开按模型的 token 拆分（0 = 不展开）。 */
  modelRows?: number;
}): React.ReactNode {
  const t = theme.tokens;
  const field = (label: string, value: React.ReactNode): React.ReactNode => (
    <Text wrap="truncate" key={label}>
      {"  "}
      <Text color={t.muted}>{padWidth(label, 8, theme.ascii)}</Text>
      {value}
    </Text>
  );
  return (
    <Box flexDirection="column" flexShrink={0}>
      <PaneTitle theme={theme} width={width} title="会话详情" right={`#${String(item.rank).padStart(2, "0")}`} />
      <Text color={t.text} bold>
        {"  "}
        {truncateWidth(item.title, Math.max(8, width - 2), theme.ascii)}
      </Text>
      <Box height={1} />
      {field("费用", <Text color={t.brand} bold>{item.costText}</Text>)}
      {field("Tokens", <Text color={t.text}>{item.tokensText}</Text>)}
      {field("工具", <Text color={t.text}>{item.toolCalls} 次 {sepOf(theme.ascii)} {item.turns} 回合</Text>)}
      {field(
        "重试",
        <Text color={item.retries >= 3 ? t.warn : t.text}>
          {item.retries}
          {item.retries >= 3 ? " （重试风暴）" : ""}
        </Text>,
      )}
      {field(
        "风险",
        item.dangerCount === 0 && item.secrets === 0 ? (
          <Text color={t.muted}>无</Text>
        ) : (
          <Text>
            {item.dangerCount > 0 ? (
              <Text color={item.redDanger > 0 ? t.error : t.warn}>
                {item.dangerCount} 条危险命令{item.redDanger > 0 ? `（${item.redDanger} 高危）` : ""}
              </Text>
            ) : null}
            {item.secrets > 0 ? <Text color={t.warn}>{item.dangerCount > 0 ? ` ${sepOf(theme.ascii)} ` : ""}{item.secrets} 条疑似密钥</Text> : null}
          </Text>
        ),
      )}
      {field("时间", <Text color={t.muted}>{item.firstTimeText}</Text>)}
      {field("", <Text color={t.muted}>{item.lastTimeText}</Text>)}
      {modelRows >= 2 && item.models.length > 0 ? (
        <>
          <Box height={1} />
          <PaneTitle theme={theme} width={width} title="按模型 Tokens" right={`${item.models.length} 个`} tone="muted" />
          {item.models.slice(0, modelRows - 1).map((m) => {
            const nameW = Math.max(12, Math.min(30, width - 26));
            const barW = Math.max(4, Math.min(14, width - nameW - 22));
            return (
              <Text wrap="truncate" key={m.name}>
                {"  "}
                <Text color={t.text}>{padWidth(truncateWidth(m.name, nameW, theme.ascii), nameW, theme.ascii)}</Text>
                <Text color={t.muted} dimColor>{padWidth(ratioBar(m.tokens, item.models[0]!.tokens, barW, theme.ascii), barW, theme.ascii)}</Text>
                <Text color={t.muted}>{padStartWidth(m.tokensText, 10, theme.ascii)}</Text>
                <Text color={t.muted} dimColor>{padStartWidth(formatPct(m.share * 100, 0), 6, theme.ascii)}</Text>
              </Text>
            );
          })}
        </>
      ) : null}
      <Box height={1} />
      <Text color={t.muted} dimColor>
        {"  "}
        c 复制 Session ID（只复制 ID，不含内容）
      </Text>
    </Box>
  );
}

/** 列表一行：序号 / 费用 / 标题 / 风险标记。 */
function Row({
  item, active, theme, width,
}: {
  item: TraceItemVm;
  active: boolean;
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const costW = 9;
  // 标记先占位再算标题宽：给标记一个上限列宽，标题拿剩下的。
  const marks = riskMarksOf(item);
  const markRoom = marks.length === 0 ? 0 : Math.min(16, Math.max(0, Math.floor(width * 0.28)));
  const fixed = 1 + 2 + costW + 2;
  const titleW = Math.max(6, width - fixed - markRoom);
  return (
    <Text wrap="truncate" inverse={active} dimColor={!active}>
      {" "}
      <Text color={t.muted}>{String(item.rank).padStart(2, "0")}</Text>
      <Text color={t.brand} bold>{padStartWidth(item.costText, costW, theme.ascii)}</Text>
      {"  "}
      <Text color={t.text}>{padWidth(truncateWidth(item.title, titleW, theme.ascii), titleW, theme.ascii)}</Text>
      <MarkRun marks={marks} theme={theme} room={markRoom} />
    </Text>
  );
}

export function TraceView({
  vm, selected, detail, theme, layout,
}: {
  vm: TraceVm;
  selected: number;
  detail: number | null;
  theme: ResolvedTheme;
  layout: Layout;
}): React.ReactNode {
  const t = theme.tokens;
  const split = layout.splitMain;

  // 不可拆分且 detail 打开：详情占满主区。
  if (!split && detail !== null) {
    const item = vm.items[detail];
    if (item === undefined) return null;
    return (
      <Box flexDirection="column" height={layout.bodyHeight} overflow="hidden">
        <SessionDetail item={item} theme={theme} width={layout.mainWidth} modelRows={Math.max(0, Math.min(9, layout.bodyHeight - 14))} />
        <Box flexGrow={1} />
        <Text color={t.muted} dimColor>{"  Esc 返回列表"}</Text>
      </Box>
    );
  }

  const listWidth = split ? layout.listWidth : layout.mainWidth;
  const rows = Math.max(2, layout.bodyHeight - 2);
  const { slice, start, up, down } = windowSlice(vm.items, selected, rows);
  const list = (
    <Box flexDirection="column" flexShrink={0}>
      <PaneTitle
        theme={theme}
        width={listWidth}
        title="会话"
        right={`${vm.items.length}/${vm.total} ${sepOf(theme.ascii)} 按费用`}
      />
      {slice.map((item, i) => (
        <Row key={item.sessionId} item={item} active={start + i === selected} theme={theme} width={listWidth} />
      ))}
      {vm.items.length === 0 ? <Text dimColor>{"  本期没有会话记录"}</Text> : null}
      {up || down ? (
        <Text color={t.muted} dimColor>
          {"  "}
          {up ? `上方 ${start} 条` : ""}
          {up && down ? ` ${sepOf(theme.ascii)} ` : ""}
          {down ? `下方 ${vm.items.length - start - slice.length} 条` : ""}
        </Text>
      ) : null}
    </Box>
  );

  if (!split) {
    return (
      <Box flexDirection="column" height={layout.bodyHeight} overflow="hidden">
        {list}
      </Box>
    );
  }

  const current = vm.items[selected];
  return (
    <Box flexDirection="row" height={layout.bodyHeight} overflow="hidden">
      <Box flexDirection="column" width={layout.listWidth} flexShrink={0} overflow="hidden">
        {list}
      </Box>
      <Box width={2} flexShrink={0} />
      <Box flexDirection="column" width={layout.detailWidth} flexShrink={0} overflow="hidden">
        {current !== undefined ? (
          <SessionDetail item={current} theme={theme} width={layout.detailWidth} modelRows={Math.max(0, Math.min(9, layout.bodyHeight - 14))} />
        ) : (
          <Text color={t.muted} dimColor>{"  选中左侧任一会话查看详情"}</Text>
        )}
      </Box>
    </Box>
  );
}
