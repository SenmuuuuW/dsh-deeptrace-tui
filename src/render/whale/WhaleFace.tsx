/**
 * 鲸鱼娘 Ink 组件：全像素角色（half-block 双色渲染 / no-color 剪影）。
 * mood 与 core whaleMood 严格同源（happy/angry/sleepy/dazed → warning sprite
 * 对应 dazed 无语态）；idle/thinking 为 TUI 专用 UI 状态（数据未到/加载中）。
 */
import { Box, Text } from "ink";
import { loadWhaleSprite, spriteCells, type WhaleSprite } from "./render.js";

export type WhaleState = "idle" | "happy" | "thinking" | "warning" | "angry" | "sleepy";

/** core mood → sprite 名（dazed 无语 = warning sprite；表情阈值仍由 core 决定）。 */
export const MOOD_TO_SPRITE: Record<string, WhaleState> = {
  happy: "happy",
  angry: "angry",
  sleepy: "sleepy",
  dazed: "warning",
};

export function spriteNameFor(state: WhaleState): string {
  return state;
}

export interface WhaleFaceProps {
  state: WhaleState;
  color: boolean;
  /** 小终端：只显示上半身（头部），裁掉下半部分。 */
  clipped?: boolean;
}

const spriteCache = new Map<string, WhaleSprite>();

export function getSprite(state: WhaleState): WhaleSprite {
  const name = spriteNameFor(state);
  let sprite = spriteCache.get(name);
  if (sprite === undefined) {
    sprite = loadWhaleSprite(name);
    spriteCache.set(name, sprite);
  }
  return sprite;
}

export function WhaleFace({ state, color, clipped = false }: WhaleFaceProps): React.ReactNode {
  const sprite = getSprite(state);
  const cells = spriteCells(sprite, color);
  const rows = clipped ? cells.slice(0, Math.ceil(cells.length / 2)) : cells;
  return (
    <Box flexDirection="column">
      {rows.map((row, y) => (
        <Box key={y} flexDirection="row">
          {row.map((cell, x) => (
            <Text key={x} color={cell.fg} backgroundColor={cell.bg}>
              {cell.char}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
