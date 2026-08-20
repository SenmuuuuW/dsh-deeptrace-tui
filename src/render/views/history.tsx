/**
 * 历史趋势 v3：一屏可比。
 *   · 指标切换条常显（哪个键切到哪个指标，不用记）；
 *   · 主图：当前指标 × 各周期比例条，条宽跟着主区宽度走；
 *   · 全指标一览：四个指标各一条 sparkline + 当期值，横向对比不用来回切；
 *   · 本期按日活跃：sparkline + 峰值/最忙日。
 * 数据全部来自 vm/history + stats，不新增任何统计口径。
 */
import { Box, Text } from "ink";
import type { AppData } from "../../data/report.js";
import { HISTORY_METRICS, buildHistoryVm, historyRows, metricText, type HistoryMetric } from "../../vm/history.js";
import { arrowOf, dashOf, padStartWidth, padWidth, sepOf, sparkline, truncateWidth } from "../../vm/format.js";
import { PaneTitle } from "../chrome.js";
import type { Layout } from "../geometry.js";
import type { ResolvedTheme } from "../theme.js";

/** 指标切换条：当前项反显，其余给键位。 */
function MetricTabs({
  metric, theme, width,
}: {
  metric: HistoryMetric;
  theme: ResolvedTheme;
  width: number;
}): React.ReactNode {
  const t = theme.tokens;
  return (
    <Text>
      {"  "}
      {HISTORY_METRICS.map((m) => {
        const active = m.key === metric;
        return (
          <Text key={m.key} color={active ? t.text : t.muted} bold={active} dimColor={!active}>
            {active ? `[${m.keyHint} ${m.label}]` : ` ${m.keyHint} ${m.label} `}
          </Text>
        );
      })}
      <Text color={t.muted} dimColor>{truncateWidth("", Math.max(0, width - 40), theme.ascii)}</Text>
    </Text>
  );
}

export function HistoryView({
  data, metric, theme, layout,
}: {
  data: AppData;
  metric: HistoryMetric;
  theme: ResolvedTheme;
  layout: Layout;
}): React.ReactNode {
  const t = theme.tokens;
  const w = layout.mainWidth;
  const vm = buildHistoryVm(data, metric, theme.ascii);
  const current = HISTORY_METRICS.find((m) => m.key === metric)!;
  // 条宽跟屏宽走：宽屏就该用上宽度，而不是留白。
  const barWidth = Math.max(10, Math.min(48, w - 26));
  const rows = historyRows(data, metric, barWidth, theme.ascii);

  return (
    <Box flexDirection="column" height={layout.bodyHeight} overflow="hidden">
      <PaneTitle theme={theme} width={w} title="历史趋势" right={`${current.label} ${sepOf(theme.ascii)} 近 ${rows.length} 期`} />
      <MetricTabs metric={metric} theme={theme} width={w} />

      <Box flexDirection="column" flexShrink={0} marginTop={1}>
        {rows.map((r) => (
          <Text wrap="truncate" key={r.label} bold={r.live}>
            {"  "}
            <Text color={r.live ? t.signal : t.muted}>{padWidth(r.label, 6, theme.ascii)}</Text>
            <Text color={r.live ? t.signal : t.text}>{padStartWidth(r.valueText, 10, theme.ascii)}</Text>
            {"  "}
            <Text color={r.live ? t.signal : t.brand} dimColor={!r.live}>
              {r.bar}
            </Text>
            {r.live ? <Text color={t.signal}>{"  LIVE"}</Text> : null}
          </Text>
        ))}
      </Box>

      {layout.bodyHeight >= 18 ? (
        <Box flexDirection="column" flexShrink={0} marginTop={1}>
          <PaneTitle theme={theme} width={w} title="全指标一览" right="横向对比" tone="muted" />
          {HISTORY_METRICS.map((m) => {
            const nums = data.trend.map((p) =>
              m.key === "cost" ? p.cost : m.key === "sessions" ? p.sessions : m.key === "tokens" ? p.totalTokens : p.cacheRate,
            );
            const last = data.trend[data.trend.length - 1];
            return (
              <Text wrap="truncate" key={m.key}>
                {"  "}
                <Text color={m.key === metric ? t.text : t.muted} bold={m.key === metric}>
                  {padWidth(m.label, 8, theme.ascii)}
                </Text>
                <Text color={m.key === metric ? t.brand : t.muted}>{sparkline(nums, Math.max(8, Math.min(24, w - 30)), theme.ascii)}</Text>
                <Text color={t.text}>{"  "}{last !== undefined ? metricText(last, m.key) : dashOf(theme.ascii)}</Text>
              </Text>
            );
          })}
        </Box>
      ) : null}

      <Box flexDirection="column" flexShrink={0} marginTop={1}>
        <PaneTitle
          theme={theme}
          width={w}
          title="本期按日活跃"
          right={`近 ${vm.daily.length} 天 ${sepOf(theme.ascii)} 峰值 ${vm.maxDaily} 条/天`}
          tone="muted"
        />
        <Text color={t.brand}>{"  "}{sparkline(vm.daily.map((d) => d.count), Math.max(12, Math.min(48, w - 6)), theme.ascii)}</Text>
        <Text color={t.muted} dimColor>
          {"  "}
          {vm.daily.length > 0
            ? `${vm.daily[0].date} ${arrowOf(theme.ascii)} ${vm.daily[vm.daily.length - 1].date}`
            : "无按日数据"}
          {data.stats.busiestDay ? ` ${sepOf(theme.ascii)} 最忙日 ${data.stats.busiestDay.date}（${data.stats.busiestDay.events} 条）` : ""}
        </Text>
      </Box>
    </Box>
  );
}
