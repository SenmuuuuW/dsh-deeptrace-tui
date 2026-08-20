/**
 * 布局零件：Nav（状态栏导航）+ Kpi（总览四指标）。
 *
 * 顶栏 / 状态栏 / 分隔线已统一到 chrome.tsx，
 * 这里只留仍被引用的两个零件 —— 原 Header / Footer / Rule / SectionTitle
 * 已随 chrome 重构退役并删除，避免留下两套外壳。
 *
 * 颜色角色（统一，不做彩虹）：
 *   brand=蓝 → 身份/激活 · signal=cyan → 信息 · warn=琥珀 → 注意
 *   error=红 → 仅真危险 · muted=灰 → 元数据 · text=白 → 主内容
 */
import { Box, Text } from "ink";
import type { ResolvedTheme } from "./theme.js";
import type { View } from "./Frame.js";

const NAV_ORDER: View[] = ["overview", "tools", "trace", "collab", "history"];
const NAV_SHORT: Record<View, string> = {
  overview: "总览",
  tools: "工具",
  trace: "会话",
  collab: "协作",
  history: "历史",
};

/**
 * 视图导航（状态栏左侧）。窄屏只留序号 + 当前视图名，
 * 因为"我在哪一页"比"一共有哪几页"更重要。
 */
export function Nav({
  view, theme, compact,
}: {
  view: View;
  theme: ResolvedTheme;
  compact: boolean;
}): React.ReactNode {
  const t = theme.tokens;
  if (compact) {
    const i = NAV_ORDER.indexOf(view) + 1;
    return (
      <Text>
        <Text color={t.text} bold>{`${i}/${NAV_ORDER.length} ${NAV_SHORT[view]}`}</Text>
        <Text color={t.muted} dimColor>{" 1-5 切换"}</Text>
      </Text>
    );
  }
  return (
    <Text>
      {NAV_ORDER.map((v, i) => {
        const active = v === view;
        return (
          <Text key={v} color={active ? t.text : t.muted} bold={active} dimColor={!active}>
            {active ? `[${i + 1} ${NAV_SHORT[v]}]` : ` ${i + 1} ${NAV_SHORT[v]} `}
          </Text>
        );
      })}
      <Text color={t.muted} dimColor>{"  ? 帮助"}</Text>
    </Text>
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
