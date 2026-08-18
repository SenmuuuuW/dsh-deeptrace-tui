/**
 * 交互式 TUI 入口组件：键盘导航 + 状态机 + 低频刷新（v2）。
 * 快捷键遵循 dsh-tui 习惯（? 帮助、q 退出），列表导航 j/k/↑/↓。
 * 历史页：c/s/t/h 切换指标（页面局部，不与其他页冲突）。
 */
import { useInput, useStdout } from "ink";
import { useEffect, useMemo, useRef, useState } from "react";
import { copyToClipboard } from "../clipboard.js";
import { Controller } from "../controller.js";
import type { ReportPreset } from "../core/index.js";
import { Frame, type View } from "./Frame.js";
import type { ResolvedTheme } from "./theme.js";
import { attentionOf } from "../vm/overview.js";
import type { HistoryMetric } from "../vm/history.js";

export interface AppProps {
  dshHome: string;
  preset: ReportPreset;
  theme: ResolvedTheme;
  /** 低频自动刷新（秒）；0 = 关闭（默认）。 */
  watchSec?: number;
  /** 显式尺寸（测试/headless 用）；缺省取终端实际尺寸。 */
  width?: number;
  height?: number;
  onExit?: () => void;
}

/** 需要关注 → 视图跳转（SEE → TRACE 闭环）。 */
function viewForFinding(id: string): View {
  if (id === "tool-health") return "tools";
  if (id === "night-cost" || id === "cache-drop" || id === "cache-good" || id === "cost-trend") return "history";
  return "trace";
}

export function DeepTraceApp({ dshHome, preset, theme, watchSec = 0, width, height, onExit }: AppProps): React.ReactNode {
  const { stdout } = useStdout();
  // 防御性尺寸：winsize 缺失/异常（如 0×0 的伪终端）时钳制到最小可用布局。
  const rawW = width ?? stdout.columns ?? 100;
  const rawH = height ?? stdout.rows ?? 40;
  const w = Math.max(40, Math.min(rawW, 300));
  const h = Math.max(12, Math.min(rawH, 100));
  const low = h < 26;

  const controller = useMemo(() => new Controller(dshHome, preset), [dshHome, preset]);
  const [snap, setSnap] = useState(() => controller.snapshot());
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState(0);
  const [detail, setDetail] = useState<number | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyMetric, setHistoryMetric] = useState<HistoryMetric>("cost");
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = controller.subscribe(() => setSnap(controller.snapshot()));
    void controller.init();
    return () => {
      unsub();
      if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    };
  }, [controller]);

  // 低频自动刷新（默认关闭；--watch N 开启，低频不轮询）。
  useEffect(() => {
    if (watchSec <= 0) return;
    const timer = setInterval(() => {
      void controller.refresh();
    }, watchSec * 1000);
    return () => clearInterval(timer);
  }, [controller, watchSec]);

  const showFlash = (text: string): void => {
    setFlash(text);
    if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
  };

  const overviewCount = snap.data === null ? 0 : attentionOf(snap.data.insights, low ? 2 : 3).length + 1;
  const toolsCount = snap.data?.stats.toolHealth.length ?? 0;
  const traceCount = snap.data?.stats.sessionsDetail.length ?? 0;

  const itemCount = (): number => {
    if (view === "overview") return overviewCount;
    if (view === "tools") return toolsCount;
    if (view === "trace") return traceCount;
    if (view === "collab") return Math.max(1, snap.data?.collab.length ?? 0);
    return 1;
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      onExit?.();
      process.exit(0);
      return;
    }
    if (key.escape) {
      if (helpOpen) setHelpOpen(false);
      else if (detail !== null) setDetail(null);
      else if (noteOpen) setNoteOpen(false);
      return;
    }
    if (helpOpen) {
      if (input === "?" || input === "q") setHelpOpen(false);
      return;
    }
    const count = itemCount();
    const move = (delta: number): void => {
      if (count <= 0) return;
      setSelected((s) => (s + delta + count) % count);
    };
    if (input === "j" || key.downArrow) move(1);
    else if (input === "k" || key.upArrow) move(-1);
    else if (input === "1") { setView("overview"); setSelected(0); setDetail(null); }
    else if (input === "2") { setView("tools"); setSelected(0); setDetail(null); }
    else if (input === "3") { setView("trace"); setSelected(0); setDetail(null); }
    else if (input === "4") { setView("collab"); setSelected(0); setDetail(null); }
    else if (input === "5") { setView("history"); setSelected(0); setDetail(null); }
    else if (input === "r") void controller.refresh();
    else if (input === "?") setHelpOpen(true);
    else if (input === "q") { onExit?.(); process.exit(0); }
    else if (view === "history" && (input === "c" || input === "s" || input === "t" || input === "h")) {
      const target = input === "c" ? "cost" : input === "s" ? "sessions" : input === "t" ? "tokens" : "cache";
      setHistoryMetric(target);
    } else if (key.return) {
      if (view === "trace") {
        if (snap.data === null) return;
        if (detail !== null) setDetail(null);
        else if (snap.data.stats.sessionsDetail[selected] !== undefined) setDetail(selected);
      } else if (view === "overview") {
        if (snap.data === null) return;
        const attention = attentionOf(snap.data.insights, low ? 2 : 3);
        if (selected < attention.length) {
          const finding = attention[selected];
          setView(viewForFinding(finding.id));
          setSelected(0);
        } else {
          setNoteOpen((v) => !v);
        }
      }
    } else if (input === "c") {
      if (snap.data === null) return;
      const items = snap.data.stats.sessionsDetail;
      const target = view === "trace" ? (detail !== null ? items[detail] : items[selected]) : undefined;
      if (target === undefined) return;
      const ok = copyToClipboard(target.sessionId);
      showFlash(ok ? `已复制 Session ID：${target.sessionId.slice(0, 20)}…` : `Session ID：${target.sessionId}`);
    }
  });

  const archiveInfo =
    snap.data === null ? "存档未加载" : `${snap.data.archive.files} 存档 · ${snap.data.archive.events.toLocaleString()} 事件 · ${snap.data.archive.sessions} 会话`;

  return (
    <Frame
      view={view}
      data={snap.data}
      theme={theme}
      width={w}
      height={h}
      selected={selected}
      detail={detail}
      noteOpen={noteOpen}
      helpOpen={helpOpen}
      loading={snap.loading}
      progress={snap.progress}
      error={snap.error}
      flash={flash}
      updatedAt={snap.data?.generatedAt ?? null}
      archiveInfo={archiveInfo}
      historyMetric={historyMetric}
    />
  );
}

export { HISTORY_METRICS } from "../vm/history.js";
