/**
 * 协作复盘 v3：左侧观察项列表 + 右侧当前项展开。
 *
 * 三段结构不变（观察 / 摩擦点 / 建议尝试），但补了一块「信号来源」——
 * 把结论依赖的确定性计数摊开（用户消息 / 方向修正 / 迟到约束 / 短会话），
 * 让人能自己核对结论从哪来，而不是被动接受一段评价。
 * 全部来自 core 的确定性规则，没有任何 LLM 生成。
 */
import { Box, Text } from "ink";
import { COLLAB_MIN_SESSIONS, COLLAB_MIN_USER_MESSAGES } from "../../core/index.js";
import type { AppData } from "../../data/report.js";
import { padStartWidth, padWidth, sepOf, truncateWidth } from "../../vm/format.js";
import { PaneTitle } from "../chrome.js";
import type { Layout } from "../geometry.js";
import type { ResolvedTheme } from "../theme.js";

/**
 * 复盘门槛文案：由 core 的 COLLAB_MIN_* 算出，不在 TUI 内硬编码数字。
 * must stay aligned with core collaboration thresholds.
 * ≥ (U+2265) 属 East Asian Ambiguous，ascii 档退回 ">=" 保证半宽。
 */
function collabGateText(ascii: boolean): string {
  const ge = ascii ? ">=" : "≥";
  return `${ge}${COLLAB_MIN_SESSIONS} 会话 / ${ge}${COLLAB_MIN_USER_MESSAGES} 条用户消息`;
}

const CODE_LABEL: Record<string, string> = {
  "REQUIREMENT-DRIFT": "需求漂移",
  "LATE-CONSTRAINT": "迟到约束",
  "CONTEXT-FRAGMENTATION": "上下文碎片化",
};

/** 段落：标题弱、正文强，自动按宽度折行。 */
function Section({
  theme, width, label, text, tone,
}: {
  theme: ResolvedTheme;
  width: number;
  label: string;
  text: string;
  tone: "text" | "muted" | "signal";
}): React.ReactNode {
  const t = theme.tokens;
  const color = tone === "signal" ? t.signal : tone === "muted" ? t.muted : t.text;
  return (
    <Box flexDirection="column" flexShrink={0} marginTop={1}>
      <Text color={t.muted} dimColor>
        {"  "}
        {label}
      </Text>
      <Box width={Math.max(10, width - 4)} marginLeft={2} flexShrink={0}>
        <Text color={color} wrap="wrap">
          {text}
        </Text>
      </Box>
    </Box>
  );
}

/** 信号来源：结论背后的确定性计数。 */
function SignalTable({
  data, theme, width,
}: {
  data: AppData;
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const c = data.stats.collab;
  const rows: [string, string][] = [
    ["用户消息", String(c.userMessages)],
    ["方向修正", `${c.revisions} 次 ${sepOf(theme.ascii)} ${c.sessionsWithRevision} 个会话`],
    ["迟到约束", String(c.lateConstraints)],
    ["短会话", `${c.shortSessions} / ${data.stats.sessions}`],
  ];
  return (
    <Box flexDirection="column" flexShrink={0} marginTop={1}>
      <PaneTitle theme={theme} width={width} title="信号来源" right="确定性计数" tone="muted" />
      {rows.map(([k, v]) => (
        <Text wrap="truncate" key={k}>
          {"  "}
          <Text color={t.muted}>{padWidth(k, 10, theme.ascii)}</Text>
          <Text color={t.text}>{v}</Text>
        </Text>
      ))}
    </Box>
  );
}

export function CollabView({
  data, selected, theme, layout,
}: {
  data: AppData;
  selected: number;
  theme: ResolvedTheme;
  layout: Layout;
}): React.ReactNode {
  const t = theme.tokens;
  const w = layout.mainWidth;
  const items = data.collab;

  if (items.length === 0) {
    const s = data.stats;
    return (
      <Box flexDirection="column" height={layout.bodyHeight} overflow="hidden">
        <PaneTitle theme={theme} width={w} title="协作复盘" right="样本不足" />
        <Text color={t.muted}>
          {`  样本不足，暂不复盘（门槛：${collabGateText(theme.ascii)}）。`}
        </Text>
        <Text color={t.muted} dimColor>
          {`  当前 ${s.sessions} 会话 ${sepOf(theme.ascii)} ${s.collab.userMessages} 条用户消息`}
        </Text>
        <SignalTable data={data} theme={theme} width={w} />
      </Box>
    );
  }

  const idx = ((selected % items.length) + items.length) % items.length;
  const c = items[idx];
  const split = layout.splitMain && items.length > 1;
  const detailWidth = split ? layout.detailWidth : w;

  const detail = (
    <Box flexDirection="column" flexShrink={0}>
      <PaneTitle theme={theme} width={detailWidth} title={CODE_LABEL[c.code] ?? c.code} right={c.code} />
      <Section theme={theme} width={detailWidth} label="观察" text={c.title} tone="text" />
      <Section theme={theme} width={detailWidth} label="摩擦点" text={c.observation} tone="muted" />
      <Section theme={theme} width={detailWidth} label="建议尝试" text={c.suggestion} tone="signal" />
    </Box>
  );

  if (!split) {
    return (
      <Box flexDirection="column" height={layout.bodyHeight} overflow="hidden">
        <Text color={t.muted} dimColor>
          {`  观察项 ${idx + 1}/${items.length} ${sepOf(theme.ascii)} j/k 切换`}
        </Text>
        {detail}
        {layout.bodyHeight >= 20 ? <SignalTable data={data} theme={theme} width={w} /> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="row" height={layout.bodyHeight} overflow="hidden">
      <Box flexDirection="column" width={layout.listWidth} flexShrink={0} overflow="hidden">
        <PaneTitle theme={theme} width={layout.listWidth} title="观察项" right={`${items.length} 条`} />
        {items.map((it, i) => (
          <Text wrap="truncate" key={it.code} inverse={i === idx} dimColor={i !== idx}>
            {" "}
            <Text color={t.muted}>{padStartWidth(String(i + 1), 2, theme.ascii)}</Text>
            {"  "}
            <Text color={i === idx ? t.text : t.muted}>
              {padWidth(truncateWidth(CODE_LABEL[it.code] ?? it.code, layout.listWidth - 6, theme.ascii), layout.listWidth - 6, theme.ascii)}
            </Text>
          </Text>
        ))}
        <SignalTable data={data} theme={theme} width={layout.listWidth} />
      </Box>
      <Box width={2} flexShrink={0} />
      <Box flexDirection="column" width={layout.detailWidth} flexShrink={0} overflow="hidden">
        {detail}
      </Box>
    </Box>
  );
}
