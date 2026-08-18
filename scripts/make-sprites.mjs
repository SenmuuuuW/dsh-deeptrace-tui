#!/usr/bin/env node
/**
 * 深迹像素小鲸鱼 mascot —— 素材生成器（v3）。
 *
 * 设计（同一只鲸鱼，只换表情/装饰）：
 * - 16×12 逻辑像素（终端 half-block 渲染 ≈ 16×6 格，低矮装饰）
 * - 圆润椭圆身体 + 统一深蓝轮廓 + 浅蓝肚皮 + 右上翘尾 + 左侧小鳍
 * - 喷气孔在头顶；mood 装饰（喷泉/?/感叹号/火苗/zZ）克制使用
 * - 深蓝 #0B1B4D / 中蓝 #4D6BFE / 浅蓝 #7B9BE8 / 白 #FFFFFF / 近黑 #101828 /
 *   琥珀 #F5A623（仅 warning/angry 点缀）—— 共 6 色，适合 TUI
 * - 正面 3/4 视角：圆身体 + 可见尾巴，一眼是鲸鱼
 *
 * 用法: node scripts/make-sprites.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 16;
const H = 12;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "whale");

const PALETTE = {
  d: "#0B1B4D", // 深蓝（轮廓 / 喷气孔）
  b: "#4D6BFE", // 中蓝（身体，DeepSeek Blue）
  l: "#7B9BE8", // 浅蓝（肚皮 / 尾尖 / 鳍 / 水花）
  w: "#FFFFFF", // 白（眼高光 / 水花 / zZ）
  e: "#101828", // 近黑（眼睛 / 嘴）
  y: "#F5A623", // 琥珀（感叹号 / 火苗 —— 仅提醒/生气）
};

const empty = () => Array.from({ length: H }, () => Array(W).fill("."));
const put = (g, x, y, ch) => {
  if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch;
};
const rect = (g, x1, y1, x2, y2, ch) => {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) put(g, x, y, ch);
};
const isSolid = (ch) => ch !== ".";
const at = (g, x, y) => (x < 0 || x >= W || y < 0 || y >= H ? "." : g[y][x]);

/** 椭圆填充（含边界）。 */
function ellipse(g, cx, cy, rx, ry, ch) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(g, x, y, ch);
    }
  }
}

/** 统一轮廓：与透明相邻的实体像素 → 深蓝。 */
function outline(g) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = g[y][x];
      if (!isSolid(ch)) continue;
      if (!isSolid(at(g, x - 1, y)) || !isSolid(at(g, x + 1, y)) || !isSolid(at(g, x, y - 1)) || !isSolid(at(g, x, y + 1))) {
        g[y][x] = "d";
      }
    }
  }
}

/**
 * 基础小鲸鱼：圆身体 + 肚皮 + 右上翘尾 + 左鳍 + 喷气孔。
 * 眼睛/嘴/眉毛/mood 装饰由调用方叠加。
 * 顺序：身体/肚皮 → 统一轮廓 → 尾/鳍（细结构后画，避免被轮廓吃掉）。
 */
function baseWhale() {
  const g = empty();
  // 身体（圆润椭圆，x1..14, y3..10）
  ellipse(g, 7.5, 6.5, 6.5, 3.6, "b");
  // 肚皮（下半浅蓝）
  ellipse(g, 7.5, 8.6, 4.5, 2.0, "l");
  // 统一轮廓
  outline(g);
  // 右上翘尾（后画：上叉翘起 + 柄 + 下叉，浅蓝尖醒目）
  put(g, 13, 2, "l");
  put(g, 14, 2, "l");
  put(g, 12, 3, "b");
  put(g, 13, 3, "b");
  put(g, 12, 4, "b");
  put(g, 13, 4, "b");
  put(g, 13, 5, "l");
  put(g, 14, 5, "l");
  // 左鳍（后画，浅蓝小三角）
  put(g, 1, 6, "l");
  put(g, 1, 7, "l");
  put(g, 2, 7, "l");
  // 喷气孔（头顶）
  put(g, 7, 2, "d");
  put(g, 8, 2, "d");
  return g;
}

/** 眼睛（2×2，高光可开关 / 位置可调）。 */
function eyes(g, opts = {}) {
  const { highlight = true, style = "open", lookUp = false } = opts;
  for (const x0 of [4, 10]) {
    if (style === "closed") {
      rect(g, x0, 5, x0 + 1, 5, "e"); // 闭眼横线
    } else {
      rect(g, x0, 5, x0 + 1, 6, "e");
      if (highlight) {
        put(g, x0, 5, "w");
        if (lookUp) {
          // 上视：高光在瞳孔下方
          put(g, x0 + 1, 6, "w");
        }
      }
    }
  }
}

/** 嘴（中心 x7..8，y7..8）。 */
function mouth(g, kind) {
  if (kind === "calm") {
    put(g, 7, 7, "e");
    put(g, 8, 7, "e");
  } else if (kind === "smile") {
    // 张嘴笑
    put(g, 7, 7, "e");
    put(g, 8, 7, "e");
    put(g, 7, 8, "e");
    put(g, 8, 8, "e");
  } else if (kind === "o") {
    // 小圆嘴
    rect(g, 7, 7, 8, 8, "e");
  } else if (kind === "flat") {
    // 平嘴（提醒）
    rect(g, 6, 7, 9, 7, "e");
  } else if (kind === "frown") {
    // 撇嘴（生气）
    put(g, 6, 7, "e");
    put(g, 9, 7, "e");
    put(g, 7, 8, "e");
    put(g, 8, 8, "e");
  }
}

/** 眉毛（眼睛上方 y4）。 */
function brows(g, style) {
  if (style === "straight") {
    rect(g, 4, 4, 5, 4, "e");
    rect(g, 10, 4, 11, 4, "e");
  } else if (style === "angry") {
    // 外高内低
    put(g, 4, 3, "e");
    put(g, 5, 4, "e");
    put(g, 11, 3, "e");
    put(g, 10, 4, "e");
  }
}

/** 头顶装饰（y0..2 左侧区域 + 头顶中间，避开右上翘尾）。 */
function topMark(g, kind) {
  if (kind === "spout") {
    // 小喷泉（开心，头顶中间）
    rect(g, 6, 1, 8, 1, "l");
    put(g, 7, 0, "w");
  } else if (kind === "question") {
    // ? 气泡（思考，左上）
    put(g, 4, 0, "w");
    put(g, 3, 1, "w");
    put(g, 5, 1, "w");
    put(g, 4, 2, "w");
    put(g, 4, 3, "w");
  } else if (kind === "exclaim") {
    // 感叹号（提醒，左上，琥珀）
    put(g, 4, 1, "y");
    put(g, 4, 2, "y");
    put(g, 4, 3, "y");
    put(g, 4, 4, "y");
  } else if (kind === "fire") {
    // 小火苗（生气，头顶中间，琥珀）
    put(g, 7, 0, "y");
    put(g, 7, 1, "y");
    put(g, 8, 1, "y");
  } else if (kind === "zzz") {
    // z（困困，左上）
    rect(g, 3, 0, 5, 0, "w");
    put(g, 4, 1, "w");
    rect(g, 3, 2, 5, 2, "w");
  } else if (kind === "sweat") {
    // 汗滴（提醒，浅蓝，左上）
    put(g, 4, 1, "l");
    put(g, 4, 2, "l");
    put(g, 3, 3, "l");
    put(g, 4, 3, "l");
  }
}

/** 脸颊（鼓起/腮红，琥珀点缀 —— angry 用）。 */
function cheek(g, on) {
  if (!on) return;
  put(g, 3, 8, "y");
  put(g, 12, 8, "y");
}

function build(name, opts) {
  const g = baseWhale();
  eyes(g, opts.eyes);
  brows(g, opts.brows ?? "none");
  mouth(g, opts.mouth);
  cheek(g, opts.cheek ?? false);
  if (opts.mark !== undefined) topMark(g, opts.mark);
  return {
    name,
    w: W,
    h: H,
    palette: PALETTE,
    grid: g.map((row) => row.join("")),
  };
}

const sprites = [
  build("idle", { eyes: { highlight: true }, mouth: "calm" }),
  build("happy", { eyes: { highlight: true }, mouth: "smile", mark: "spout" }),
  build("thinking", { eyes: { highlight: true, lookUp: true }, mouth: "o", mark: "question" }),
  build("warning", { eyes: { highlight: true }, brows: "straight", mouth: "flat", mark: "sweat" }),
  build("angry", { eyes: { highlight: false }, brows: "angry", mouth: "frown", cheek: true, mark: "fire" }),
  build("sleepy", { eyes: { highlight: false, style: "closed" }, mouth: "o", mark: "zzz" }),
];

mkdirSync(OUT, { recursive: true });
for (const sprite of sprites) {
  writeFileSync(join(OUT, `${sprite.name}.json`), JSON.stringify(sprite, null, 2) + "\n");
  console.log(`wrote ${sprite.name}.json`);
}
