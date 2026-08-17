#!/usr/bin/env node
/**
 * 占位像素鲸鱼娘 sprite 生成器（开发工具，非运行时依赖）。
 *
 * 生成 assets/whale/{idle,happy,thinking,warning,angry,sleepy}.json
 * （16×24 像素网格 + palette），人设沿用 Web 版鲸鱼娘世界观：
 * 圆润鲸鱼脸、DeepSeek Blue #4D6BFE 主体、浅蓝高光、浅色脸、腮红。
 *
 * 像素纵横比：终端单元约 1:2（宽:高），half-block 渲染每 2 像素行
 * 压成 1 行字符 → 16×24 像素 ≈ 16×12 终端格 ≈ 视觉正方形脸。
 * 正式素材到位后（docs/WHALE_ASSET_SPEC.md），直接替换 JSON，无需改代码。
 *
 * 用法: node scripts/make-sprites.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 16;
const H = 24;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "whale");

const PALETTE = {
  d: "#0A1220", // 深 navy 描边
  b: "#4D6BFE", // DeepSeek Blue 主体
  l: "#7B9BE8", // 浅蓝高光
  f: "#DBE4FF", // 脸/肚皮
  r: "#FFB4C8", // 腮红
  e: "#101828", // 眼睛
  w: "#FFFFFF", // 眼高光
  t: "#6FE3D5", // signal cyan（水珠/z）
};

const empty = () => Array.from({ length: H }, () => Array(W).fill("."));
const put = (g, x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch; };
function rect(g, x1, y1, x2, y2, ch) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) put(g, x, y, ch);
}
function isSolid(ch) { return ch !== "."; }
function at(g, x, y) { return x < 0 || x >= W || y < 0 || y >= H ? "." : g[y][x]; }

/** 圆润头部：填充 → 描边（透明邻接自动描边）→ 高光/脸区。 */
function baseFace() {
  const g = empty();
  // 主体（圆角梯形）
  rect(g, 3, 3, 12, 3, "b");
  rect(g, 2, 4, 13, 4, "b");
  rect(g, 1, 5, 14, 15, "b");
  rect(g, 2, 16, 13, 16, "b");
  rect(g, 3, 17, 12, 17, "b");
  // 自动描边：任何与透明相邻的实体像素 → 深 navy
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = g[y][x];
      if (!isSolid(ch)) continue;
      if (!isSolid(at(g, x - 1, y)) || !isSolid(at(g, x + 1, y)) || !isSolid(at(g, x, y - 1)) || !isSolid(at(g, x, y + 1))) {
        g[y][x] = "d";
      }
    }
  }
  // 顶部高光带（内部）
  rect(g, 3, 4, 12, 4, "l");
  rect(g, 4, 5, 11, 5, "l");
  // 脸区（浅色 y7..14）
  rect(g, 4, 7, 11, 14, "f");
  // 侧鳍（描边后画，贴住头部）
  put(g, 0, 13, "b");
  put(g, 1, 13, "b");
  put(g, 0, 14, "b");
  put(g, 1, 14, "b");
  put(g, 15, 13, "b");
  put(g, 14, 13, "b");
  put(g, 15, 14, "b");
  put(g, 14, 14, "b");
  return g;
}

/** 眼睛：2×2 大圆眼（y8..10，3 高），可带高光。 */
function eyes(g, highlight = true, highlightAt = "top") {
  rect(g, 5, 8, 6, 10, "e");
  rect(g, 9, 8, 10, 10, "e");
  if (highlight) {
    const hy = highlightAt === "top" ? 8 : 10;
    put(g, 5, hy, "w");
    put(g, 9, hy, "w");
  }
}

function blush(g, on = true) {
  if (on) {
    put(g, 4, 12, "r");
    put(g, 11, 12, "r");
  }
}

/** 喷水柱（y0..2）。 */
function spout(g, style = "full") {
  if (style === "none") return;
  rect(g, 6, 2, 9, 2, "l");
  rect(g, 6, 1, 9, 1, "l");
  if (style === "full") {
    put(g, 6, 0, "f");
    put(g, 7, 0, "f");
    put(g, 8, 0, "l");
    put(g, 9, 0, "l");
  } else {
    put(g, 7, 0, "l");
    put(g, 8, 0, "l");
  }
}

/** 嘴型（y13..14，脸区内）。 */
function mouth(g, kind) {
  switch (kind) {
    case "smile": // 开心微笑 ⌣
      put(g, 6, 13, "d");
      put(g, 9, 13, "d");
      put(g, 7, 14, "d");
      put(g, 8, 14, "d");
      break;
    case "calm": // 平静小嘴
      put(g, 7, 14, "d");
      put(g, 8, 14, "d");
      break;
    case "open": // 打哈欠 O 嘴
      rect(g, 7, 13, 8, 14, "d");
      break;
    case "frown": // 生气撇嘴（倒 ⌣）
      put(g, 6, 14, "d");
      put(g, 9, 14, "d");
      put(g, 7, 13, "d");
      put(g, 8, 13, "d");
      break;
    case "flat": // 无语平嘴
      put(g, 6, 14, "d");
      put(g, 7, 14, "d");
      put(g, 8, 14, "d");
      put(g, 9, 14, "d");
      break;
  }
}

function build(name, fn) {
  const g = baseFace();
  fn(g);
  return {
    name,
    w: W,
    h: H,
    palette: PALETTE,
    grid: g.map((row) => row.join("")),
  };
}

const sprites = [
  build("idle", (g) => {
    eyes(g, true, "top");
    blush(g, true);
    mouth(g, "calm");
    spout(g, "small");
  }),
  build("happy", (g) => {
    eyes(g, true, "top");
    blush(g, true);
    mouth(g, "smile");
    spout(g, "full");
  }),
  build("thinking", (g) => {
    // 视线向上（高光在瞳孔下部）+ 小嘴 + 气泡
    eyes(g, true, "bottom");
    mouth(g, "calm");
    spout(g, "none");
    put(g, 13, 1, "f");
    rect(g, 12, 2, 13, 3, "f");
  }),
  build("warning", (g) => {
    // 无语：豆豆眼 + 平嘴 + 汗珠
    put(g, 5, 9, "e");
    put(g, 10, 9, "e");
    mouth(g, "flat");
    spout(g, "none");
    put(g, 12, 1, "t");
    put(g, 13, 2, "t");
  }),
  build("angry", (g) => {
    eyes(g, false);
    blush(g, false);
    // 倒竖眉（脸区顶缘 y7）
    put(g, 4, 7, "e");
    put(g, 5, 7, "e");
    put(g, 10, 7, "e");
    put(g, 11, 7, "e");
    mouth(g, "frown");
    spout(g, "none");
  }),
  build("sleepy", (g) => {
    // 闭眼（蓝弧线眼睑，白脸上清晰可辨）+ O 嘴 + z
    put(g, 5, 8, "b");
    put(g, 6, 8, "b");
    put(g, 9, 8, "b");
    put(g, 10, 8, "b");
    put(g, 5, 10, "b");
    put(g, 6, 10, "b");
    put(g, 9, 10, "b");
    put(g, 10, 10, "b");
    blush(g, true);
    mouth(g, "open");
    spout(g, "none");
    put(g, 13, 0, "t");
    put(g, 12, 1, "t");
    put(g, 13, 2, "t");
  }),
];

mkdirSync(OUT, { recursive: true });
for (const sprite of sprites) {
  writeFileSync(join(OUT, `${sprite.name}.json`), JSON.stringify(sprite, null, 2) + "\n");
  console.log(`wrote ${sprite.name}.json`);
}
