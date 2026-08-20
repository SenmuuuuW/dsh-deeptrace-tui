/**
 * 观察员小鲸鱼的 Ink 渲染层。
 *
 * 两种尺寸，由 geometry 的 layout.mascot 决定用哪个：
 *   mark —— 3 行线稿，常规/高终端
 *   tick —— 1 行微章 + 中文状态词，矮终端
 *   none —— 不渲染（bodyHeight < 16，行数要留给正事）
 *
 * 状态是双通道表达：颜色 + 中文状态词。
 * 无色终端里颜色通道失效，状态词仍在 —— 不依赖颜色传递信息。
 */
import React from "react";
import { Box, Text } from "ink";
import type { ResolvedTheme } from "../theme.js";
import { whaleMascot, type MarkRole, type MarkSegment, type WhaleState } from "./mascot.js";

/**
 * 线稿分段 → 具体色值。
 *
 * body 走 tone 主色；face（五官）在 brand/muted 档用中性色，
 * 在 warn/error/signal 档跟随 tone —— 让「情绪」落在五官上而不是整只染色。
 */
function colorFor(theme: ResolvedTheme, tone: string, role: MarkRole): string | undefined {
  if (!theme.color) return undefined;
  const t = theme.tokens;
  const toneColor =
    tone === "signal" ? t.signal : tone === "warn" ? t.warn : tone === "error" ? t.error : tone === "muted" ? t.muted : t.brand;
  if (role === "body") return toneColor;
  if (role === "accent") return tone === "brand" ? t.userAccent : toneColor;
  // face
  if (tone === "brand") return t.text;
  if (tone === "muted") return t.muted;
  return toneColor;
}

function Segments({ row, theme, tone }: { row: readonly MarkSegment[]; theme: ResolvedTheme; tone: string }): React.ReactNode {
  return (
    <Text>
      {row.map((seg, i) => (
        <Text key={i} color={colorFor(theme, tone, seg.role)}>
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

export interface WhaleProps {
  state: WhaleState;
  theme: ResolvedTheme;
}

/** 3 行线稿 + 中文状态词。 */
export function WhaleMark({ state, theme }: WhaleProps): React.ReactNode {
  const m = whaleMascot(state, theme.ascii);
  return (
    <Box flexDirection="column" flexShrink={0}>
      {m.rows.map((row, i) => (
        <Segments key={i} row={row} theme={theme} tone={m.tone} />
      ))}
      <Text color={colorFor(theme, m.tone, "body")} dimColor={m.tone === "muted"}>
        {`  ${m.label}`}
      </Text>
    </Box>
  );
}

/** 单行微章：`─┤ o _ o ├─ 待机`。 */
export function WhaleTick({ state, theme, showLabel = true }: WhaleProps & { showLabel?: boolean }): React.ReactNode {
  const m = whaleMascot(state, theme.ascii);
  return (
    <Box flexShrink={0}>
      <Segments row={m.tick} theme={theme} tone={m.tone} />
      {showLabel ? <Text color={colorFor(theme, m.tone, "body")}>{` ${m.label}`}</Text> : null}
    </Box>
  );
}

export {
  MOOD_TO_STATE,
  stateForMood,
  whaleMascot,
  mascotToText,
  markRowWidth,
  WHALE_STATES,
  MARK_WIDTH,
  MARK_HEIGHT,
  MARK_ROW_WIDTHS,
  TICK_WIDTH,
} from "./mascot.js";
export type { WhaleState, MarkRole, MarkSegment, WhaleMascot } from "./mascot.js";
