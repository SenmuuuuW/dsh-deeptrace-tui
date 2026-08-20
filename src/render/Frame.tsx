/**
 * 主框架 v3（presentational 壳）：工作台骨架 + 视图路由。
 *
 * 与 v2 的区别（这一版要解决的就是"左上角一点内容、右边一大片空白"）：
 *   · 骨架由 chrome.Shell 提供，高度精确到行：顶栏 1 + 线 1 + 主体 N + 线 1 + 状态栏 1；
 *   · 主体固定分成「主工作区」和「常驻诊断区」，视图切换不改变骨架位置；
 *   · 所有响应式判断集中在 geometry.layoutOf()，视图只消费结果，不各自算断点。
 *
 * 纯展示：数据来自 AppData，无副作用。交互 App 与 headless render 共用。
 */
import { Box, Text } from "ink";
import type { AppData } from "../data/report.js";
import { buildOverviewVm } from "../vm/overview.js";
import { buildToolsVm } from "../vm/tools.js";
import { buildTraceVm } from "../vm/trace.js";
import type { HistoryMetric } from "../vm/history.js";
import type { ResolvedTheme } from "./theme.js";
import { Nav } from "./layout.js";
import { Shell, TopBar, StatusBar } from "./chrome.js";
import { layoutOf, type Layout } from "./geometry.js";
import { DiagnosticRail } from "./rail.js";
import { WhaleMark, WhaleTick } from "./whale/Whale.js";
import { OverviewView } from "./views/overview.js";
import { ToolsView } from "./views/tools.js";
import { TraceView } from "./views/trace.js";
import { CollabView } from "./views/collab.js";
import { HistoryView } from "./views/history.js";
import { HelpView } from "./views/help.js";
import { dashOf, sepOf, sparkline } from "../vm/format.js";
import { periodShortOf } from "../vm/overview.js";

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

// 档位判断已统一到 geometry.ts（单一真相源），这里只做转发以免调用方到处改 import。
export { widthBandOf, heightBandOf, layoutOf } from "./geometry.js";
export type { WidthBand, HeightBand, Layout } from "./geometry.js";

/**
 * 各视图的上下文快捷键提示（状态栏中段，窄屏丢弃）。
 * 状态栏是全宽定位的，分隔符必须跟随 ascii 档 —— 见 sepOf 的说明。
 */
function viewHint(view: View, ascii: boolean): string {
  const s = sepOf(ascii);
  const HINT: Record<View, string> = {
    overview: `Enter 展开鲸评 ${s} r 刷新`,
    tools: `j/k 选工具 ${s} Enter 看错误码`,
    trace: `j/k 选会话 ${s} Enter 详情 ${s} c 复制 ID`,
    collab: "j/k 翻观察项",
    history: "c/s/t/h 切换指标",
  };
  return HINT[view];
}

export function Frame({
  view, data, theme, width, height, selected, detail, noteOpen, helpOpen, loading, progress, error, flash, updatedAt, archiveInfo, historyMetric,
}: FrameProps): React.ReactNode {
  const layout = layoutOf(width, height);
  const low = layout.heightBand === "low";
  const contentHeight = layout.bodyHeight;
  // 诊断区已常驻鲸鱼，主区不再重复放，避免两条鲸鱼互相抢戏。
  const showWhale = !layout.railShown && view === "overview" && data !== null && !low;
  const attentionMax = low ? 2 : 3;

  let content: React.ReactNode;
  if (helpOpen) {
    content = <HelpView theme={theme} archiveInfo={archiveInfo} updatedAt={updatedAt} width={layout.mainWidth} height={contentHeight} />;
  } else if (error !== null) {
    content = (
      <Box flexDirection="column">
        <Text color={theme.tokens.error} bold>数据读取失败</Text>
        <Text>{error}</Text>
        <Text dimColor>检查 DSH_HOME 与存档路径后按 [r] 重试。</Text>
      </Box>
    );
  } else if (data === null) {
    content = <LoadingPane theme={theme} layout={layout} progress={progress} />;
  } else if (view === "overview") {
    const vm = buildOverviewVm(data, attentionMax, theme.ascii);
    content = (
      <OverviewView
        vm={vm}
        data={data}
        theme={theme}
        selected={selected}
        noteOpen={noteOpen}
        layout={layout}
        showWhale={showWhale}
      />
    );
  } else if (view === "tools") {
    const vm = buildToolsVm(data.stats, theme.ascii);
    content = <ToolsView vm={vm} selected={selected} theme={theme} layout={layout} />;
  } else if (view === "trace") {
    const vm = buildTraceVm(data.stats);
    content = <TraceView vm={vm} selected={selected} detail={detail} theme={theme} layout={layout} />;
  } else if (view === "collab") {
    content = <CollabView data={data} selected={selected} theme={theme} layout={layout} />;
  } else {
    content = <HistoryView data={data} metric={historyMetric} theme={theme} layout={layout} />;
  }

  const rail =
    data === null || helpOpen || error !== null
      ? null
      : (
          <DiagnosticRail
            theme={theme}
            layout={layout}
            data={data}
            overview={buildOverviewVm(data, 3, theme.ascii)}
            tools={buildToolsVm(data.stats, theme.ascii)}
            busy={loading}
          />
        );
  const time = updatedAt !== null ? new Date(updatedAt).toTimeString().slice(0, 5) : dashOf(theme.ascii);
  return (
    <Shell
      theme={theme}
      layout={layout}
      top={
        <TopBar
          theme={theme}
          layout={layout}
          periodText={data === null ? "读取会话存档…" : `${data.periodLabel} ${sepOf(theme.ascii)} ${periodShortOf(data)}`}
          live={data?.live ?? false}
        />
      }
      main={content}
      rail={rail}
      bottom={
        <StatusBar
          theme={theme}
          layout={layout}
          nav={<Nav view={view} theme={theme} compact={layout.widthBand === "compact"} />}
          hint={helpOpen ? "Esc 关闭帮助" : viewHint(view, theme.ascii)}
          right={flash ?? time}
          flashActive={flash !== null}
        />
      }
    />
  );
}

/** 加载中：进度 + 观察员 thinking。占满主区，避免加载态出现巨大空白。 */
function LoadingPane({
  theme, layout, progress,
}: {
  theme: ResolvedTheme;
  layout: Layout;
  progress: { message: string; done?: number; total?: number } | null;
}): React.ReactNode {
  const p = progress;
  const pct = p?.total !== undefined && p.total > 0 ? ` ${Math.round(((p.done ?? 0) / p.total) * 100)}%` : "";
  const barWidth = Math.max(8, Math.min(32, layout.mainWidth - 4));
  return (
    <Box flexDirection="column" height={layout.bodyHeight} justifyContent="center">
      <Text color={theme.tokens.muted}>
        {"  "}
        {p?.message ?? "加载中…"}
        {pct}
      </Text>
      {p?.total !== undefined && p.total > 0 ? (
        <Text color={theme.tokens.brand}>
          {"  "}
          {sparkline(new Array(p.total).fill(1).map((_, i) => (i < (p.done ?? 0) ? 1 : 0)), barWidth, theme.ascii)}
        </Text>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        {layout.mascot === "mark" ? (
          <WhaleMark state="thinking" theme={theme} />
        ) : layout.mascot === "tick" ? (
          <WhaleTick state="thinking" theme={theme} />
        ) : null}
      </Box>
    </Box>
  );
}
