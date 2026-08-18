/**
 * 布局壳：Header / Footer / KPI —— v2 极简版。
 *
 * 颜色角色（统一，不做彩虹）：
 *   brand=蓝 → 身份/激活 · signal=cyan → 信息 · warn=琥珀 → 注意
 *   error=红 → 仅真危险 · muted=灰 → 元数据 · text=白 → 主内容
 *
 * 分隔线：全屏只有 Header 下 1 条；其余靠空白/缩进/颜色分层。
 */
import { Box, Text } from "ink";
import type { AppData } from "../data/report.js";
import { periodShortOf } from "../vm/overview.js";
import type { ResolvedTheme } from "./theme.js";
import type { View } from "./Frame.js";

export const NAV_ORDER: View[] = ["overview", "tools", "trace", "collab", "history"];
export const NAV_SHORT: Record<View, string> = {
  overview: "总览",
  tools: "工具",
  trace: "会话",
  collab: "协作",
  history: "历史",
};

/** 分隔线（主题色；no-color 回退为 -）。 */
export function Rule({ theme, width }: { theme: ResolvedTheme; width: number }): React.ReactNode {
  return (
    <Text color={theme.tokens.muted} dimColor>
      {theme.color ? "─".repeat(Math.max(8, width)) : "-".repeat(Math.max(8, width))}
    </Text>
  );
}

/** Section 标题（小写灰字，正文由内容本身承担）。 */
export function SectionTitle({ children }: { children: React.ReactNode }): React.ReactNode {
  return <Text dimColor>{children}</Text>;
}

/** 头部：品牌 + ●LIVE（右侧），第二行周期。无 meta 堆叠。 */
export function Header({
  data, theme, width,
}: {
  data: AppData | null;
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const live = data?.live ?? false;
  const period =
    data === null
      ? "读取会话存档…"
      : `${data.periodLabel} · ${periodShortOf(data)}`;
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text color={t.brand} bold>
          深迹 DEEPTRACE
        </Text>
        <Text color={live ? t.signal : t.muted} bold={live}>
          {live ? "● LIVE" : "○ 周期"}
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color={t.muted}>{period}</Text>
        <Text color={t.muted}>{"  "}</Text>
      </Box>
      <Rule theme={theme} width={width} />
    </Box>
  );
}

/** 页脚：只做导航 + 右侧时间/flash。状态类信息进 Help → DIAGNOSTICS。 */
export function Footer({
  view, theme, width, flash, updatedAt,
}: {
  view: View;
  theme: ResolvedTheme;
  width: number;
  flash: string | null;
  updatedAt: number | null;
}): React.ReactNode {
  const t = theme.tokens;
  const nav = NAV_ORDER.map((v) => {
    const active = v === view;
    return (
      <Text key={v} color={active ? t.text : t.muted} bold={active}>
        {active ? `[${NAV_ORDER.indexOf(v) + 1} ${NAV_SHORT[v]}]` : ` ${NAV_ORDER.indexOf(v) + 1} ${NAV_SHORT[v]} `}
      </Text>
    );
  });
  const time = updatedAt !== null ? new Date(updatedAt).toTimeString().slice(0, 5) : "—";
  const right = flash !== null ? flash : time;
  const maxRight = Math.max(8, width - 42);
  const shortRight = right.length > maxRight ? `${right.slice(0, maxRight - 1)}…` : right;
  return (
    <Box justifyContent="space-between" marginTop={1}>
      <Text dimColor>
        {nav}
        <Text dimColor> [?] 帮助</Text>
      </Text>
      <Text color={flash !== null ? t.signal : t.muted}>{shortRight}</Text>
    </Box>
  );
}

/** KPI 四指标：数字大（bold），label 弱化小字，同比仅弱 secondary。 */
export function Kpi({
  vm, theme, width,
}: {
  vm: { costText: string; costDelta: string; sessions: number; tokensText: string; cacheRateText: string };
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  const cells: { value: React.ReactNode; label: string }[] = [
    {
      value: (
        <Text>
          <Text color={t.text} bold>{vm.costText}</Text>
          <Text dimColor> {vm.costDelta}</Text>
        </Text>
      ),
      label: "成本",
    },
    { value: <Text bold>{vm.sessions}</Text>, label: "会话" },
    { value: <Text bold>{vm.tokensText}</Text>, label: "Tokens" },
    { value: <Text bold>{vm.cacheRateText}</Text>, label: "Cache" },
  ];
  // 四列固定宽（不随屏宽拉开）：宽屏也不散架。
  const col = 16;
  return (
    <Box flexDirection="row">
      {cells.map((c, i) => (
        <Box key={c.label} flexDirection="column" width={col} marginRight={i < cells.length - 1 ? 2 : 0}>
          <Text>{c.value}</Text>
          <Text color={t.muted} dimColor>
            {c.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
