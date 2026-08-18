/**
 * 主框架 v2（presentational 壳）：响应式档位计算 + 视图路由 + Header/Footer。
 * 纯展示：数据来自 AppData，无副作用。交互 App 与 headless render 共用。
 *
 * 响应式（3 档宽度 × 3 档高度，不做几十个断点）：
 *   COMPACT  <90  单列、无鲸鱼
 *   STANDARD 90-129  主内容 + 小鲸鱼
 *   WIDE     >=130  Trace 双栏 / Tools 正常工具双列
 *   LOW      <26 行  需要关注 Top 2、无鲸评、趋势精简
 *   NORMAL   26-39
 *   TALL     >=40
 */
import { Box, Text } from "ink";
import type { AppData } from "../data/report.js";
import { buildOverviewVm } from "../vm/overview.js";
import { buildToolsVm } from "../vm/tools.js";
import { buildTraceVm } from "../vm/trace.js";
import type { HistoryMetric } from "../vm/history.js";
import type { ResolvedTheme } from "./theme.js";
import { Header, Footer } from "./layout.js";
import { WhaleFace } from "./whale/WhaleFace.js";
import { OverviewView } from "./views/overview.js";
import { ToolsView } from "./views/tools.js";
import { TraceView } from "./views/trace.js";
import { CollabView } from "./views/collab.js";
import { HistoryView } from "./views/history.js";
import { HelpView } from "./views/help.js";
import { sparkline } from "../vm/format.js";

export type View = "overview" | "tools" | "trace" | "collab" | "history";

export const VIEW_LABELS: Record<View, string> = {
  overview: "总览",
  tools: "工具健康",
  trace: "会话轨迹",
  collab: "协作复盘",
  history: "历史趋势",
};

export interface FrameProps {
  view: View;
  data: AppData | null;
  theme: ResolvedTheme;
  width: number;
  height: number;
  selected: number;
  /** 会话详情打开的条目下标（trace 窄屏模式）。 */
  detail: number | null;
  /** 鲸评展开（overview）。 */
  noteOpen: boolean;
  helpOpen: boolean;
  loading: boolean;
  progress: { message: string; done?: number; total?: number } | null;
  error: string | null;
  flash: string | null;
  /** 数据更新时间（footer 右侧时间）。 */
  updatedAt: number | null;
  archiveInfo: string;
  /** 历史页当前指标（c/s/t/h 切换）。 */
  historyMetric: HistoryMetric;
}

/** 视口内可见窗口（列表虚拟化）。 */
export function windowSlice<T>(items: readonly T[], selected: number, max: number): { slice: T[]; start: number; up: boolean; down: boolean } {
  if (items.length <= max) return { slice: items.slice(), start: 0, up: false, down: false };
  const half = Math.floor(max / 2);
  let start = selected - half;
  start = Math.max(0, Math.min(start, items.length - max));
  return { slice: items.slice(start, start + max), start, up: start > 0, down: start + max < items.length };
}

export type WidthBand = "compact" | "standard" | "wide";
export type HeightBand = "low" | "normal" | "tall";

export function widthBandOf(width: number): WidthBand {
  if (width < 90) return "compact";
  if (width < 130) return "standard";
  return "wide";
}

export function heightBandOf(height: number): HeightBand {
  if (height < 26) return "low";
  if (height < 40) return "normal";
  return "tall";
}

export function Frame({
  view, data, theme, width, height, selected, detail, noteOpen, helpOpen, loading, progress, error, flash, updatedAt, archiveInfo, historyMetric,
}: FrameProps): React.ReactNode {
  const wb = widthBandOf(width);
  const hb = heightBandOf(height);
  const low = hb === "low";
  const contentHeight = Math.max(3, height - 5);
  const showWhale = wb !== "compact" && view === "overview" && data !== null && !low;
  const attentionMax = low ? 2 : 3;

  let content: React.ReactNode;
  if (helpOpen) {
    content = <HelpView theme={theme} archiveInfo={archiveInfo} updatedAt={updatedAt} width={width} height={height} />;
  } else if (error !== null) {
    content = (
      <Box flexDirection="column">
        <Text color="#E5484D" bold>数据读取失败</Text>
        <Text>{error}</Text>
        <Text dimColor>检查 DSH_HOME 与存档路径后按 [r] 重试。</Text>
      </Box>
    );
  } else if (data === null) {
    const p = progress;
    const pct = p?.total !== undefined && p?.total > 0 ? ` ${Math.round(((p.done ?? 0) / p.total) * 100)}%` : "";
    content = (
      <Box flexDirection="row">
        <Box flexDirection="column" flexGrow={1}>
          <Text dimColor>{p?.message ?? "加载中…"}{pct}</Text>
          {p?.total !== undefined && p.total > 0 && (
            <Text>{sparkline(new Array(p.total).fill(1).map((_, i) => (i < (p.done ?? 0) ? 1 : 0)), 24)}</Text>
          )}
        </Box>
        <Box marginLeft={2}>
          <WhaleFace state="thinking" color={theme.color} />
        </Box>
      </Box>
    );
  } else if (view === "overview") {
    const vm = buildOverviewVm(data, attentionMax);
    content = (
      <OverviewView
        vm={vm}
        data={data}
        theme={theme}
        selected={selected}
        noteOpen={noteOpen}
        width={width}
        contentHeight={contentHeight}
        showWhale={showWhale}
      />
    );
  } else if (view === "tools") {
    const vm = buildToolsVm(data.stats);
    content = <ToolsView vm={vm} selected={selected} theme={theme} wide={wb === "wide"} width={width} height={height} />;
  } else if (view === "trace") {
    const vm = buildTraceVm(data.stats);
    content = <TraceView vm={vm} selected={selected} detail={detail} wide={wb !== "compact"} theme={theme} height={height} />;
  } else if (view === "collab") {
    content = <CollabView data={data} selected={selected} theme={theme} />;
  } else {
    content = <HistoryView data={data} metric={historyMetric} theme={theme} />;
  }

  return (
    <Box flexDirection="column" width={width}>
      <Header data={data} theme={theme} width={width} />
      <Box flexGrow={1}>{content}</Box>
      <Footer view={view} theme={theme} width={width} flash={flash} updatedAt={updatedAt} />
    </Box>
  );
}
