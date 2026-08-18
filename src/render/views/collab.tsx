/**
 * 协作复盘 v2：一次一条 —— 观察 → 摩擦 → 可以尝试，j/k 切换。
 */
import { Box, Text } from "ink";
import type { AppData } from "../../data/report.js";
import type { ResolvedTheme } from "../theme.js";

const CODE_LABEL: Record<string, string> = {
  "REQUIREMENT-DRIFT": "需求漂移",
  "LATE-CONSTRAINT": "迟到约束",
  "CONTEXT-FRAGMENTATION": "上下文碎片化",
};

export function CollabView({
  data, selected, theme,
}: {
  data: AppData;
  selected: number;
  theme: ResolvedTheme;
}): React.ReactNode {
  const t = theme.tokens;
  const items = data.collab;
  if (items.length === 0) {
    const s = data.stats;
    return (
      <Box flexDirection="column">
        <Text dimColor>协作复盘 · 样本不足，暂不复盘</Text>
        <Text dimColor>
          会话 {s.sessions} · 用户消息 {s.collab.userMessages}（需要 ≥5 会话 / ≥30 条消息）
        </Text>
      </Box>
    );
  }
  const idx = ((selected % items.length) + items.length) % items.length;
  const c = items[idx];
  return (
    <Box flexDirection="column">
      <Text dimColor>
        协作复盘 · {idx + 1}/{items.length}  [j/k] 切换
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text color={t.brand} bold>
          {CODE_LABEL[c.code] ?? c.code}
        </Text>
        <Text dimColor>{c.code}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text color={t.muted} dimColor>观察</Text>
        <Text>{c.title}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text color={t.muted} dimColor>摩擦</Text>
        <Text dimColor>{c.observation}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text color={t.signal}>可以尝试</Text>
        <Text>{c.suggestion}</Text>
      </Box>
    </Box>
  );
}
