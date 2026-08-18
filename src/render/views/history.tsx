/**
 * 历史趋势 v2：完整趋势只在这里 —— 单指标切换（c/s/t/h），比例条形。
 */
import { Box, Text } from "ink";
import type { AppData } from "../../data/report.js";
import { HISTORY_METRICS, buildHistoryVm, type HistoryMetric } from "../../vm/history.js";
import type { ResolvedTheme } from "../theme.js";

export function HistoryView({
  data, metric, theme,
}: {
  data: AppData;
  metric: HistoryMetric;
  theme: ResolvedTheme;
}): React.ReactNode {
  const t = theme.tokens;
  const vm = buildHistoryVm(data, metric);
  const current = HISTORY_METRICS.find((m) => m.key === metric)!;
  return (
    <Box flexDirection="column">
      <Text dimColor>
        历史趋势 HISTORY · {current.label}  [c/s/t/h] 切换
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {vm.rows.map((r) => (
          <Text key={r.label} bold={r.live}>
            <Text color={r.live ? t.signal : undefined}>{r.label.padEnd(6)}</Text>
            <Text color={r.live ? t.signal : undefined}>{r.valueText}</Text>
            <Text dimColor>  {r.bar}</Text>
            {r.live ? "  ●" : ""}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>本期按日活跃（近 {vm.daily.length} 天，事件数）</Text>
        <Text>{vm.dailySpark}</Text>
        <Text dimColor>
          峰值 {vm.maxDaily} 条/天
          {data.stats.busiestDay ? ` · 最忙日 ${data.stats.busiestDay.date}` : ""}
        </Text>
      </Box>
    </Box>
  );
}
