/**
 * 总览 v2：一屏回答三问 —— 整体怎样（KPI）？最大问题（需要关注 Top3）？要不要进去看（趋势+鲸评）。
 * 三级视觉层级：KPI（数字）→ 需要关注（异常优先）→ 趋势（方向感）。
 */
import { Box, Text } from "ink";
import type { AppData } from "../../data/report.js";
import type { OverviewVm } from "../../vm/overview.js";
import { Kpi, SectionTitle } from "../layout.js";
import type { ResolvedTheme } from "../theme.js";
import { WhaleFace, type WhaleState } from "../whale/WhaleFace.js";

const LEVEL_COLOR: Record<string, string | undefined> = {
  critical: "#E5484D",
  warning: "#F5A623",
  tip: "#6FE3D5",
};

/** 需要关注列表（Top N）。选中项 Enter 跳转对应视图。 */
export function AttentionList({
  vm, selected, theme,
}: {
  vm: OverviewVm;
  selected: number;
  theme: ResolvedTheme;
}): React.ReactNode {
  const t = theme.tokens;
  return (
    <Box flexDirection="column">
      <SectionTitle>需要关注</SectionTitle>
      {vm.attention.length === 0 && (
        <Text dimColor>
          本期没有需要关注的问题。
          <Text color={t.signal}> 数据很干净。</Text>
        </Text>
      )}
      {vm.attention.map((a) => (
        <Box key={a.id} flexDirection="column" marginTop={0}>
          <Text inverse={selected === a.rank - 1}>
            {String(a.rank).padStart(2, "0")}{"  "}
            <Text color={LEVEL_COLOR[a.level] ?? t.muted} bold>
              {a.tag}
            </Text>
          </Text>
          <Text dimColor={selected !== a.rank - 1}>
            {"    "}
            {a.title}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/** 显示宽度（CJK = 2 列）。 */
function widthOf(s: string): number {
  return [...s].reduce((a, c) => a + (c.charCodeAt(0) > 0xff ? 2 : 1), 0);
}

/** 趋势压缩：4 行（label + sparkline + 当前值），细节进 History。 */
export function TrendBlock({ vm }: { vm: OverviewVm }): React.ReactNode {
  return (
    <Box flexDirection="column">
      <SectionTitle>趋势</SectionTitle>
      {vm.trend.map((l) => (
        <Text key={l.title}>
          <Text bold>{l.title}{" ".repeat(Math.max(1, 6 - widthOf(l.title)))}</Text>
          <Text>{l.spark}</Text>
          <Text dimColor>  {l.value}</Text>
        </Text>
      ))}
    </Box>
  );
}

/** 右下角小鲸鱼 + 鲸评（≤2 行；Enter 展开完整版）。 */
export function WhaleBlock({
  vm, data, theme, noteOpen, selectedWhale, compact,
}: {
  vm: OverviewVm;
  data: AppData;
  theme: ResolvedTheme;
  noteOpen: boolean;
  selectedWhale: boolean;
  compact: boolean;
}): React.ReactNode {
  const t = theme.tokens;
  const state = (vm.whaleMood === "happy" ? "happy" : vm.whaleMood === "angry" ? "angry" : vm.whaleMood === "sleepy" ? "sleepy" : "warning") as WhaleState;
  const lines = noteOpen ? vm.whaleNoteFull : vm.whaleNoteShort;
  return (
    <Box flexDirection="column" marginLeft={2} width={24}>
      <WhaleFace state={state} color={theme.color} />
      <Text bold color={t.brand} dimColor inverse={selectedWhale}>
        鲸评{noteOpen ? "" : "  [Enter]"}
      </Text>
      {!compact &&
        lines.map((l, i) => (
          <Text
            key={i}
            color={l.kind === "opener" ? t.userAccent : l.kind === "aside" ? t.warn : l.kind === "footer" || l.kind === "closer" ? t.muted : t.text}
            dimColor={l.kind === "closer" || l.kind === "footer"}
          >
            {l.text}
          </Text>
        ))}
    </Box>
  );
}

export function OverviewView({
  vm, data, theme, selected, noteOpen, width, contentHeight, showWhale,
}: {
  vm: OverviewVm;
  data: AppData;
  theme: ResolvedTheme;
  /** 选择位：0..attention-1 为需要关注项，attention 为鲸评条目。 */
  selected: number;
  noteOpen: boolean;
  width: number;
  contentHeight: number;
  showWhale: boolean;
}): React.ReactNode {
  const low = contentHeight < 20;
  const whaleSelected = selected >= vm.attention.length;
  const left = (
    <Box flexDirection="column" flexGrow={1}>
      <Kpi vm={vm.kpi} theme={theme} width={width} />
      <Box marginTop={1}>
        <AttentionList vm={vm} selected={whaleSelected ? -1 : selected} theme={theme} />
      </Box>
      <Box marginTop={1}>
        <TrendBlock vm={vm} />
      </Box>
    </Box>
  );
  const right =
    showWhale && !low ? (
      // 小装饰：与"需要关注"同垂直位置（KPI 之下），不制造底部大片空白。
      <Box flexDirection="column" marginLeft={2} marginTop={2}>
        <WhaleBlock vm={vm} data={data} theme={theme} noteOpen={noteOpen} selectedWhale={whaleSelected} compact={false} />
      </Box>
    ) : null;
  return (
    <Box flexDirection="row" flexGrow={1}>
      {left}
      {right}
    </Box>
  );
}
