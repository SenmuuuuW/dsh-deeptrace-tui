/**
 * 像素鲸鱼娘 renderer —— 全像素角色（Unicode half-block 渲染）。
 *
 * - Sprite = JSON（assets/whale/*.json）：16×16 像素网格 + palette；
 * - 渲染 = 每 2 像素行压缩为 1 个半块字符（▀/▄），上下半格各一个颜色；
 * - 色彩模式：truecolor ANSI（经 Ink <Text> fg/bg）；no-color：按亮度
 *   映射 ░▒▓█ 单色剪影；
 * - 素材规格见 docs/WHALE_ASSET_SPEC.md —— 用户后续提供正式像素素材时，
 *   只需按该格式放入 assets/whale/，无需改代码。
 */
export interface WhaleSprite {
  name: string;
  w: number;
  h: number;
  palette: Record<string, string>;
  grid: string[];
}

export interface SpriteCell {
  char: string;
  fg?: string;
  bg?: string;
}

/** 从 assets/whale/*.json 加载 sprite（构建后 lib/ 与源码 src/ 都能解析到根目录）。 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SPRITE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "assets", "whale");

const spriteCache = new Map<string, WhaleSprite>();

export function loadWhaleSprite(name: string): WhaleSprite {
  const cached = spriteCache.get(name);
  if (cached !== undefined) return cached;
  const raw = readFileSync(join(SPRITE_DIR, `${name}.json`), "utf8");
  const sprite = JSON.parse(raw) as WhaleSprite;
  validateSprite(sprite);
  spriteCache.set(name, sprite);
  return sprite;
}

export function validateSprite(sprite: WhaleSprite): void {
  if (sprite.grid.length !== sprite.h) {
    throw new Error(`sprite ${sprite.name}: grid rows ${sprite.grid.length} != h ${sprite.h}`);
  }
  for (const [i, row] of sprite.grid.entries()) {
    if (row.length !== sprite.w) {
      throw new Error(`sprite ${sprite.name}: row ${i} width ${row.length} != w ${sprite.w}`);
    }
    for (const ch of row) {
      if (ch !== "." && !(ch in sprite.palette)) {
        throw new Error(`sprite ${sprite.name}: row ${i} unknown palette key "${ch}"`);
      }
    }
  }
}

function colorOf(sprite: WhaleSprite, key: string): string | undefined {
  if (key === "." || key === " " || key === "") return undefined;
  return sprite.palette[key];
}

/** 十六进制 → 相对亮度（0..1，浮点误差取整）。 */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (m === null) return 0.5;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const v = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return Math.min(1, Math.max(0, Math.round(v * 1e9) / 1e9));
}

const SHADES = [" ", "░", "▒", "▓", "█"];

function shadeOf(hex: string | undefined): string {
  if (hex === undefined) return " ";
  const lum = luminance(hex);
  if (lum < 0.2) return "█";
  if (lum < 0.45) return "▓";
  if (lum < 0.75) return "▒";
  return "░";
}

/**
 * 把 sprite 转成逐终端格单元（纯函数，可单测）。
 * @param color - true，half-block + 双色；false，单色亮度剪影。
 */
export function spriteCells(sprite: WhaleSprite, color: boolean): SpriteCell[][] {
  const cells: SpriteCell[][] = [];
  for (let y = 0; y < sprite.h; y += 2) {
    const row: SpriteCell[] = [];
    const topRow = sprite.grid[y];
    const botRow = sprite.grid[y + 1] ?? undefined;
    for (let x = 0; x < sprite.w; x++) {
      const top = topRow[x] ?? ".";
      const bot = botRow?.[x] ?? ".";
      if (!color) {
        const topC = colorOf(sprite, top);
        const botC = colorOf(sprite, bot);
        const topShade = shadeOf(topC);
        const botShade = shadeOf(botC);
        const darker = top === "." ? botShade : bot === "." ? topShade : (luminance(topC ?? "#000") <= luminance(botC ?? "#000") ? topShade : botShade);
        row.push({ char: top === "." && bot === "." ? " " : darker });
        continue;
      }
      if (top === "." && bot === ".") {
        row.push({ char: " " });
      } else if (top !== "." && bot !== ".") {
        row.push({ char: "▀", fg: colorOf(sprite, top), bg: colorOf(sprite, bot) });
      } else if (top !== ".") {
        row.push({ char: "▀", fg: colorOf(sprite, top) });
      } else {
        row.push({ char: "▄", fg: colorOf(sprite, bot) });
      }
    }
    cells.push(row);
  }
  return cells;
}

/** 文本预览（测试/调试用）：无颜色时输出剪影，有颜色时输出 ANSI truecolor 文本。 */
export function spriteToText(sprite: WhaleSprite, color: boolean): string[] {
  return spriteCells(sprite, color).map((row) =>
    row
      .map((c) => {
        if (!color || (c.fg === undefined && c.bg === undefined)) return c.char;
        const fg = c.fg !== undefined ? `\u001b[38;2;${hexToRgb(c.fg).join(";")}m` : "";
        const bg = c.bg !== undefined ? `\u001b[48;2;${hexToRgb(c.bg).join(";")}m` : "";
        return `${fg}${bg}${c.char}`;
      })
      .join("") + "\u001b[0m",
  );
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (m === null) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
