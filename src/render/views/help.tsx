/**
 * 帮助 v2：快捷键 + DIAGNOSTICS（LOCAL / READ-ONLY / DETERMINISTIC / 存档信息）。
 * Header 不再堆 meta，这些信息收纳到这里。
 */
import { Box, Text } from "ink";
import type { ResolvedTheme } from "../theme.js";

export function HelpView({
  theme, archiveInfo, updatedAt,
}: {
  theme: ResolvedTheme;
  archiveInfo: string;
  updatedAt: number | null;
}): React.ReactNode {
  const t = theme.tokens;
  const rows: [string, string][] = [
    ["1 - 5", "切换视图：总览 / 工具 / 会话 / 协作 / 历史"],
    ["j / ↓  k / ↑", "移动 / 切换"],
    ["Enter", "打开（会话详情 / 需要关注跳转 / 鲸评展开）"],
    ["Esc", "返回"],
    ["r", "刷新数据（增量重读变化存档）"],
    ["c", "复制 Session ID（会话详情）"],
    ["h / c / s / t", "历史页切换指标（Cache / 成本 / 会话 / Tokens）"],
    ["?", "帮助"],
    ["q", "退出 DeepTrace"],
  ];
  return (
    <Box flexDirection="column">
      <Text bold>快捷键</Text>
      {rows.map(([k, d]) => (
        <Text key={k}>
          <Text color={t.brand} bold>{k.padEnd(16)}</Text>
          {d}
        </Text>
      ))}
      <Box flexDirection="column" marginTop={1}>
        <Text color={t.muted} dimColor>DIAGNOSTICS</Text>
        <Text dimColor>LOCAL · READ-ONLY · DETERMINISTIC · 0 token 生成</Text>
        <Text dimColor>{archiveInfo}</Text>
        <Text dimColor>更新于 {updatedAt !== null ? new Date(updatedAt).toTimeString().slice(0, 8) : "—"}</Text>
      </Box>
    </Box>
  );
}
