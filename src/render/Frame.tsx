/**
 * 主框架（presentational）：五个视图 + 头部/导航/页脚。
 * 纯展示：数据来自 AppData（controller 产出），无副作用、无事件订阅。
 * 同一 Frame 被交互 App 与 headless render（--render）共用。
 */
import { Box, Text } from "ink";
import type { AppData } from "../data/report.js";
import { buildHistoryVm } from "../vm/history.js";
import { buildOverviewVm, type OverviewVm } from "../vm/overview.js";
import { buildToolsVm, type ToolsVm } from "../vm/tools.js";
import { buildTraceVm, type TraceVm } from "../vm/trace.js";
import { formatDateLocal, formatDateTime, formatDelta, formatPct, formatYen, levelLabel, sparkline } from "../vm/format.js";
import type { ResolvedTheme } from "./theme.js";
import { WhaleFace, type WhaleState } from "./whale/WhaleFace.js";

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
  /** 会话详情打开的条目下标（trace 视图）。 */
  detail: number | null;
  helpOpen: boolean;
  loading: boolean;
  progress: { message: string; done?: number; total?: number } | null;
  error: string | null;
  flash: string | null;
  /** 数据更新时间（footer 状态）。 */
  updatedAt: number | null;
  archiveInfo: string;
}

/** 视口内可见窗口（列表虚拟化）。 */
export function windowSlice<T>(items: readonly T[], selected: number, max: number): { slice: T[]; start: number; up: boolean; down: boolean } {
  if (items.length <= max) return { slice: items.slice(), start: 0, up: false, down: false };
  const half = Math.floor(max / 2);
  let start = selected - half;
  start = Math.max(0, Math.min(start, items.length - max));
  return { slice: items.slice(start, start + max), start, up: start > 0, down: start + max < items.length };
}

const NAV_ORDER: View[] = ["overview", "tools", "trace", "collab", "history"];

function Header({ view, data, theme, width }: { view: View; data: AppData | null; theme: ResolvedTheme; width: number }): React.ReactNode {
  const t = theme.tokens;
  const live = data?.live ?? false;
  const meta = [
    live ? "● LIVE" : "○ PERIOD",
    "LOCAL",
    "DETERMINISTIC",
    "READ-ONLY",
  ];
  const periodInfo = data === null
    ? "读取会话存档…"
    : `${data.periodLabel} · ${data.periodKey} · ${formatDateLocal(data.stats.period.from)} ~ ${formatDateLocal(data.stats.period.to)}`;
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text color={t.brand} bold>
          深迹 DEEPTRACE
        </Text>
        <Text color={t.muted}>
          {meta.join(" · ")}
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color={t.muted}>{periodInfo}</Text>
        <Text color={t.muted}>
          {NAV_ORDER.map((v) => (
            <Text key={v} color={v === view ? t.signal : t.muted} bold={v === view}>
              {v === view ? `[${NAV_ORDER.indexOf(v) + 1}]${VIEW_LABELS[v]}` : `${NAV_ORDER.indexOf(v) + 1}${VIEW_LABELS[v]}`}{" "}
            </Text>
          ))}
        </Text>
      </Box>
      {width > 0 && <Text color={t.muted}>{theme.color ? "─".repeat(Math.max(8, width)) : "-".repeat(Math.max(8, width))}</Text>}
    </Box>
  );
}

function Footer({
  view, data, theme, flash, updatedAt, archiveInfo, progress, loading, width,
}: {
  view: View;
  data: AppData | null;
  theme: ResolvedTheme;
  flash: string | null;
  updatedAt: number | null;
  archiveInfo: string;
  progress: { message: string; done?: number; total?: number } | null;
  loading: boolean;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const keys =
    view === "trace" && data !== null
      ? "[j/k] 移动  [Enter] 详情  [c] 复制ID  [r] 刷新  [?] 帮助  [q] 退出"
      : view === "overview"
        ? "[j/k] 移动  [Enter] 跳转  [r] 刷新  [?] 帮助  [q] 退出"
        : "[j/k] 移动  [1-5] 视图  [r] 刷新  [?] 帮助  [q] 退出";
  const status = loading
    ? progress?.message ?? "加载中…"
    : flash !== null
      ? flash
      : `更新于 ${updatedAt !== null ? new Date(updatedAt).toTimeString().slice(0, 8) : "—"} · ${archiveInfo}`;
  // 窄终端：状态行截断，避免换行破坏单行页脚。
  const maxStatus = Math.max(10, width - keys.length - 4);
  const shortStatus = status.length > maxStatus ? `${status.slice(0, maxStatus - 1)}…` : status;
  return (
    <Box flexDirection="column">
      <Text color={t.muted}>{theme.color ? "─".repeat(Math.max(8, width)) : "-".repeat(Math.max(8, width))}</Text>
      <Box justifyContent="space-between">
        <Text color={t.muted}>{keys}</Text>
        <Text color={t.muted}>{shortStatus}</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────── 总览 ───────────────────────────

function Findings({ vm, selected }: { vm: OverviewVm; selected: number }): React.ReactNode {
  return (
    <Box flexDirection="column">
      <Text dimColor>发现 · FINDINGS（本期洞察）</Text>
      {vm.findings.length === 0 && <Text dimColor>本期没有触发任何洞察 —— 数据很干净。</Text>}
      {vm.findings.map((f) => (
        <Text key={f.rank} color={f.level === "critical" ? "#E5484D" : f.level === "warning" ? "#F5A623" : f.level === "tip" ? "#6FE3D5" : undefined} inverse={selected === f.rank - 1}>
          {`${String(f.rank).padStart(2, "0")} `}
          <Text bold>{levelLabel(f.level)}</Text>{" "}
          {f.title}
        </Text>
      ))}
    </Box>
  );
}

function TrendSection({ title, rows }: { title: string; rows: { label: string; value: string; spark: string; live: boolean }[] }): React.ReactNode {
  return (
    <Box flexDirection="column">
      {rows.map((r) => (
        <Text key={`${title}-${r.label}`} dimColor={!r.live}>
          <Text bold={r.live}>{title}</Text>{" "}
          <Text color={r.live ? undefined : undefined}>{`${r.label.padStart(4)}  ${r.value}  ${r.spark}${r.live ? "  ○ LIVE" : ""}`}</Text>
        </Text>
      ))}
    </Box>
  );
}

function OverviewView({ vm, data, theme, selected, contentHeight, showWhale }: {
  vm: OverviewVm; data: AppData; theme: ResolvedTheme; selected: number; contentHeight: number; showWhale: boolean;
}): React.ReactNode {
  const t = theme.tokens;
  const sel = vm.findings[selected];
  const whaleState = (data.whale.mood === "happy" ? "happy" : data.whale.mood === "angry" ? "angry" : data.whale.mood === "sleepy" ? "sleepy" : "warning") as WhaleState;
  const noteLines = data.whale.lines;
  const noteBudget = Math.max(3, contentHeight - 10);
  const visibleNote = noteLines.slice(0, noteBudget);

  const left = (
    <Box flexDirection="column" flexGrow={1}>
      <Text>
        <Text color={t.signal} bold>成本 {vm.costText}</Text>
        <Text color={t.muted}>（{vm.costDelta}）</Text>
        {"   "}<Text>会话 {vm.sessions}</Text>
        {"  "}<Text>回合 {vm.turns}</Text>
        {"  "}<Text>Tokens {vm.tokensText}</Text>
        {"  "}<Text color={t.thinking}>Cache {vm.cacheRateText}</Text>
        {"  "}<Text color={t.muted}>夜间 {vm.nightText}</Text>
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>趋势 · TREND（近 5 周期）</Text>
        {vm.trend.map((s) => <TrendSection key={s.title} title={s.title} rows={s.rows} />)}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Findings vm={vm} selected={selected} />
        {sel !== undefined && (
          <Box flexDirection="column" marginTop={0}>
            <Text dimColor>  {sel.detail}</Text>
            <Text color={t.thinking}>  建议：{sel.action}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );

  const right = showWhale ? (
    <Box flexDirection="column" marginLeft={2}>
      <WhaleFace state={whaleState} color={theme.color} clipped={contentHeight < 14} />
      <Text bold color={t.brand} dimColor>鲸评 WHALE NOTE / OBSERVER</Text>
      {visibleNote.map((l, i) => (
        <Text key={i} color={l.kind === "opener" ? t.userAccent : l.kind === "aside" ? t.warn : t.text} dimColor={l.kind === "closer" || l.kind === "footer"}>
          {l.text}
        </Text>
      ))}
    </Box>
  ) : null;

  return (
    <Box flexDirection="row" flexGrow={1}>
      {left}
      {right}
    </Box>
  );
}

// ─────────────────────────── 工具健康 ───────────────────────────

function ToolsView({ vm, selected, contentHeight }: { vm: ToolsVm; selected: number; contentHeight: number }): React.ReactNode {
  const max = Math.max(1, contentHeight - 1);
  const { slice, start, up, down } = windowSlice(vm.tools, selected, max);
  return (
    <Box flexDirection="column">
      <Text dimColor>
        工具健康 TOOL HEALTH · 按关注度排序（异常优先）· 共 {vm.tools.length} 个工具 · 调用 {vm.totalCalls} · 失败 {vm.totalFailed}
      </Text>
      {up && <Text dimColor>▲ 更多</Text>}
      {slice.map((tool, i) => {
        const idx = start + i;
        const selectedRow = idx === selected;
        const errCodes = tool.errorCodes.map((e) => `${e.code} ×${e.count}`).join("  ");
        return (
          <Box key={tool.name} flexDirection="column">
            <Text inverse={selectedRow}>
              {`${String(idx + 1).padStart(2, "0")} `}
              <Text color={tool.anomaly ? "#F5A623" : undefined} bold={tool.anomaly}>{tool.name}</Text>
              {" "}
              <Text color={selectedRow ? undefined : tool.anomaly ? "#F5A623" : undefined}>
                成功 {tool.successRateText} · 调用 {tool.calls} · 失败 {tool.failed}
                {tool.incomplete > 0 ? ` · 未配对 ${tool.incomplete}` : ""}
              </Text>
              {" "}
              <Text dimColor={!selectedRow}>平均 {tool.avgDurationText} · P95 {tool.p95Text}</Text>
            </Text>
            <Text dimColor={!selectedRow}>
              {tool.bar}
              {errCodes !== "" ? `  ${errCodes}` : "  无失败记录"}
            </Text>
          </Box>
        );
      })}
      {down && <Text dimColor>▼ 更多</Text>}
    </Box>
  );
}

// ─────────────────────────── 会话轨迹 ───────────────────────────

function riskMarkers(item: { retries: number; dangerCount: number; redDanger: number; secrets: number }): React.ReactNode {
  const marks: React.ReactNode[] = [];
  if (item.retries >= 3) marks.push(<Text key="retry" color="#F5A623">{item.retries} RETRY</Text>);
  if (item.redDanger > 0) marks.push(<Text key="red" color="#E5484D">{item.redDanger} RED</Text>);
  if (item.dangerCount > 0) marks.push(<Text key="risk" color="#E5484D">{item.dangerCount} RISK</Text>);
  if (item.secrets > 0) marks.push(<Text key="secret" color="#F5A623">{item.secrets} SECRET</Text>);
  if (marks.length === 0) return null;
  return (
    <>
      {" "}
      {marks.map((m, i) => (
        <Text key={i}>{m} </Text>
      ))}
    </>
  );
}

function TraceView({ vm, selected, detail, contentHeight, theme }: {
  vm: TraceVm; selected: number; detail: number | null; contentHeight: number; theme: ResolvedTheme;
}): React.ReactNode {
  const t = theme.tokens;
  if (detail !== null) {
    const item = vm.items[detail];
    if (item === undefined) return null;
    return (
      <Box flexDirection="column">
        <Text color={t.signal} bold>TRACE / SESSION #{String(detail + 1).padStart(2, "0")}</Text>
        <Text>标题     {item.title}</Text>
        <Text>ID       {item.sessionId}</Text>
        <Text>时间     {item.firstTimeText} ~ {item.lastTimeText}</Text>
        <Text>费用     {item.costText}</Text>
        <Text>Tokens   {item.tokensText}</Text>
        <Text>工具调用 {item.toolCalls} · 回合 {item.turns}</Text>
        <Text>
          风险     {item.retries} 重试{item.dangerCount > 0 ? ` · ${item.dangerCount} 危险操作（红级 ${item.redDanger}）` : ""}
          {item.secrets > 0 ? ` · ${item.secrets} 疑似密钥` : ""}
        </Text>
        <Box marginTop={1}>
          <Text dimColor>[c] 复制 Session ID · [Esc] 返回</Text>
        </Box>
      </Box>
    );
  }
  const max = Math.max(1, contentHeight - 1);
  const { slice, start, up, down } = windowSlice(vm.items, selected, max);
  return (
    <Box flexDirection="column">
      <Text dimColor>按费用排序 · Top {vm.items.length} / 共 {vm.total} 会话</Text>
      {up && <Text dimColor>▲ 更多</Text>}
      {slice.map((item, i) => {
        const idx = start + i;
        return (
          <Box key={item.sessionId} flexDirection="column">
            <Text inverse={idx === selected}>
              {`${String(item.rank).padStart(2, "0")} `}
              <Text color={t.signal} bold>{item.costText}</Text>
              {riskMarkers(item)}
              {"  "}
              <Text dimColor>{item.tokensText} tokens · {item.toolCalls} 工具</Text>
            </Text>
            <Text dimColor={idx !== selected}>
              {"     "}{item.title}
              <Text dimColor>  {item.lastTimeText}</Text>
            </Text>
          </Box>
        );
      })}
      {down && <Text dimColor>▼ 更多</Text>}
    </Box>
  );
}

// ─────────────────────────── 协作复盘 ───────────────────────────

function CollabView({ data, contentHeight }: { data: AppData; contentHeight: number }): React.ReactNode {
  const max = Math.max(1, contentHeight - 1);
  const items = data.collab.slice(0, max);
  const s = data.stats;
  return (
    <Box flexDirection="column">
      <Text dimColor>观察人机协作模式 · 确定性规则（无 LLM）· 样本不足不展示</Text>
      {items.length === 0 && (
        <Text>
          本周会话 {s.sessions} 个 · 用户消息 {s.collab.userMessages} 条 —— 样本不足，暂不复盘。
          <Text dimColor>（会话 ≥5 且用户消息 ≥30 时自动出现）</Text>
        </Text>
      )}
      {items.map((c, i) => (
        <Box key={c.code} flexDirection="column" marginTop={i === 0 ? 0 : 1}>
          <Text>
            <Text color="#4D6BFE" bold>{`${String(i + 1).padStart(2, "0")} `}{c.title}</Text>
            <Text dimColor>  {c.code}</Text>
          </Text>
          <Text dimColor>观察  {c.observation}</Text>
          <Text color="#6FE3D5">建议  {c.suggestion}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ─────────────────────────── 历史趋势 ───────────────────────────

function HistoryView({ data, contentHeight }: { data: AppData; contentHeight: number }): React.ReactNode {
  const vm = buildHistoryVm(data);
  const maxRows = Math.max(2, contentHeight - 6);
  const rows = vm.rows.slice(-maxRows);
  const w = Math.max(...rows.map((r) => r.costText.length), 8);
  return (
    <Box flexDirection="column">
      <Text dimColor>历史趋势 · HISTORY（近 {data.trend.length} 周期，LIVE 为进行中）</Text>
      <Text dimColor>
        {"周期".padEnd(6)}{"成本".padStart(w)}  会话   Cache   夜间   Tokens
      </Text>
      {rows.map((r) => (
        <Text key={r.label} bold={r.live}>
          <Text color={r.live ? "#6FE3D5" : undefined}>{r.label.padEnd(6)}</Text>
          <Text color={r.live ? "#6FE3D5" : undefined}>{r.costText.padStart(w)}</Text>
          {"  "}
          {String(r.sessions).padStart(4)}  {r.cacheRateText.padStart(6)}  {r.nightText.padStart(4)}  {r.tokensText.padStart(7)}
          {r.live ? "  ●" : ""}
        </Text>
      ))}
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>本期按日活跃（近 {vm.daily.length} 天，事件数）</Text>
        <Text>{vm.dailySpark}</Text>
        <Text dimColor>峰值 {vm.maxDaily} 条/天 · 最忙日：{data.stats.busiestDay ? `${data.stats.busiestDay.date}（${data.stats.busiestDay.events} 条）` : "—"}</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────── 帮助 ───────────────────────────

function HelpView(): React.ReactNode {
  const rows: [string, string][] = [
    ["1 - 5", "切换视图：总览 / 工具健康 / 会话轨迹 / 协作复盘 / 历史趋势"],
    ["j / ↓", "下一项"],
    ["k / ↑", "上一项"],
    ["Enter", "打开（会话详情 / 发现跳转）"],
    ["Esc", "返回"],
    ["r", "刷新数据（增量重读变化存档）"],
    ["c", "复制 Session ID（会话详情）"],
    ["?", "帮助"],
    ["q", "退出 DeepTrace"],
  ];
  return (
    <Box flexDirection="column">
      <Text bold>快捷键 HELP</Text>
      {rows.map(([k, d]) => (
        <Text key={k}>
          <Text color="#4D6BFE" bold>{k.padEnd(8)}</Text> {d}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>数据：DSH 本机会话存档 · 只读 · 确定性聚合 · 0 token 生成</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────── Frame ───────────────────────────

export function Frame({ view, data, theme, width, height, selected, detail, helpOpen, loading, progress, error, flash, updatedAt, archiveInfo }: FrameProps): React.ReactNode {
  const contentHeight = Math.max(3, height - 6);
  // 小鲸鱼 mascot 16 列宽、6 行高：宽度 ≥88 显示；极矮终端只显示头部。
  const showWhale = width >= 88 && view === "overview" && data !== null;

  let content: React.ReactNode;
  if (helpOpen) {
    content = <HelpView />;
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
          <Box marginTop={1}>
            <Text dimColor>深迹 DeepTrace —— 不离开终端，复盘你的 Agent。</Text>
          </Box>
        </Box>
        <Box marginLeft={2}>
          <WhaleFace state="thinking" color={theme.color} />
        </Box>
      </Box>
    );
  } else if (view === "overview") {
    const vm = buildOverviewVm(data);
    content = <OverviewView vm={vm} data={data} theme={theme} selected={selected} contentHeight={contentHeight} showWhale={showWhale} />;
  } else if (view === "tools") {
    const vm = buildToolsVm(data.stats);
    content = <ToolsView vm={vm} selected={selected} contentHeight={contentHeight} />;
  } else if (view === "trace") {
    const vm = buildTraceVm(data.stats);
    content = <TraceView vm={vm} selected={selected} detail={detail} contentHeight={contentHeight} theme={theme} />;
  } else if (view === "collab") {
    content = <CollabView data={data} contentHeight={contentHeight} />;
  } else {
    content = <HistoryView data={data} contentHeight={contentHeight} />;
  }

  return (
    <Box flexDirection="column" width={width}>
      <Header view={view} data={data} theme={theme} width={width} />
      <Box flexGrow={1}>{content}</Box>
      <Footer
        view={view}
        data={data}
        theme={theme}
        flash={flash}
        updatedAt={updatedAt}
        archiveInfo={archiveInfo}
        progress={progress}
        loading={loading}
        width={width}
      />
    </Box>
  );
}
