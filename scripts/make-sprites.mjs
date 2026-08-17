#!/usr/bin/env node
/**
 * 深迹像素鲸鱼娘 —— 正式占位素材生成器（v2，chibi Q 版）。
 *
 * 设计（同一角色，只换表情/动作）：
 * - 24×36 像素（终端 half-block 渲染 ≈ 24×18 格，视觉接近正方形）
 * - 蓝黑头发 + 浅蓝高光（#1A2854 / #4D6BFE / #7B9BE8）
 * - 大眼睛（3×4，白高光）、小嘴、腮红
 * - 鲸鱼元素：鲸鱼帽（帽身+背鳍+后尾）、头侧小鳍边饰
 * - 圆润轮廓：无方头、无描边硬线，靠配色分层
 * - 透明背景；no-color 剪影按亮度自动映射
 *
 * 用法: node scripts/make-sprites.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 24;
const H = 36;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "whale");

const PALETTE = {
  h: "#1A2854", // 蓝黑头发
  H: "#4D6BFE", // 头发高光（DeepSeek Blue）
  b: "#4D6BFE", // 鲸鱼帽 / 鳍 / 裙子（DeepSeek Blue）
  l: "#7B9BE8", // 浅蓝（帽肚/高光）
  f: "#E8EDFF", // 脸
  s: "#FFB4C8", // 腮红
  e: "#101828", // 眼睛/嘴（深色）
  w: "#FFFFFF", // 眼高光
  t: "#6FE3D5", // 水珠 / z / ?（signal cyan）
};

const empty = () => Array.from({ length: H }, () => Array(W).fill("."));
const put = (g, x, y, ch) => {
  if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch;
};
const rect = (g, x1, y1, x2, y2, ch) => {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) put(g, x, y, ch);
};

/** 左眼区域 (x0..x0+2, y0..y0+3) 绘制眼型。 */
const EYES = {
  open: (g, x0, y0) => {
    rect(g, x0, y0, x0 + 2, y0 + 3, "e");
    put(g, x0, y0, "w");
    put(g, x0 + 2, y0 + 3, "w");
  },
  openSole: (g, x0, y0) => {
    // 单高光（warning / angry）
    rect(g, x0, y0, x0 + 2, y0 + 3, "e");
    put(g, x0, y0, "w");
  },
  up: (g, x0, y0) => {
    // 视线向上（思考）
    rect(g, x0, y0, x0 + 2, y0 + 3, "e");
    rect(g, x0, y0 + 3, x0 + 2, y0 + 3, "w");
    put(g, x0, y0, "w");
  },
  happy: (g, x0, y0) => {
    // 开心闭眼 ∩
    put(g, x0, y0, "e");
    put(g, x0 + 2, y0, "e");
    put(g, x0 + 1, y0 + 1, "e");
  },
  closed: (g, x0, y0) => {
    // 闭眼（困）
    rect(g, x0, y0, x0 + 2, y0, "e");
  },
};

/** 嘴型（中心 x11..12，y25..26）。 */
const MOUTHS = {
  calm: (g) => {
    put(g, 11, 25, "e");
    put(g, 12, 25, "e");
  },
  smile: (g) => {
    // 张嘴笑
    rect(g, 10, 25, 13, 25, "e");
    rect(g, 11, 26, 12, 26, "e");
  },
  omega: (g) => {
    // ω 嘴（开心）
    put(g, 10, 25, "e");
    put(g, 13, 25, "e");
    put(g, 11, 26, "e");
    put(g, 12, 26, "e");
  },
  o: (g) => {
    put(g, 11, 25, "e");
    put(g, 12, 25, "e");
  },
  flat: (g) => rect(g, 10, 25, 13, 25, "e"),
  frown: (g) => {
    // 撇嘴（生气但可爱）
    put(g, 11, 25, "e");
    put(g, 12, 25, "e");
    rect(g, 10, 26, 13, 26, "e");
  },
};

/** 基础角色：头发 + 脸 + 刘海 + 鲸鱼帽 + 侧鳍 + 身体。 */
function baseCharacter() {
  const g = empty();
  // ── 头发（蓝黑，圆润顶部）──
  rect(g, 5, 8, 18, 8, "h");
  rect(g, 4, 9, 19, 13, "h");
  // 侧发（垂下，末端内收）
  rect(g, 3, 12, 6, 23, "h");
  rect(g, 17, 12, 20, 23, "h");
  put(g, 4, 24, "h");
  put(g, 5, 24, "h");
  put(g, 18, 24, "h");
  put(g, 19, 24, "h");
  // ── 脸（先画，刘海后盖）──
  rect(g, 7, 15, 17, 27, "f");
  // ── 刘海（带分叉点）──
  rect(g, 7, 14, 16, 15, "h");
  put(g, 8, 16, "h");
  put(g, 11, 16, "h");
  put(g, 12, 16, "h");
  put(g, 15, 16, "h");
  // 头发高光
  rect(g, 4, 14, 5, 21, "H");
  rect(g, 18, 14, 19, 21, "H");
  rect(g, 9, 11, 10, 13, "H");
  // ── 鲸鱼帽（帽身 + 背鳍 + 后尾）──
  rect(g, 11, 4, 14, 4, "b"); // 帽顶
  rect(g, 10, 5, 15, 5, "b");
  rect(g, 9, 6, 16, 8, "b");
  rect(g, 9, 9, 16, 10, "b");
  rect(g, 11, 9, 14, 10, "l"); // 帽肚浅蓝
  put(g, 14, 7, "e"); // 帽上的小眼睛
  // 背鳍
  rect(g, 13, 2, 14, 3, "b");
  // 后尾（鲸鱼尾，翘在帽后）
  rect(g, 6, 5, 8, 5, "b");
  rect(g, 7, 6, 8, 6, "b");
  put(g, 8, 7, "b");
  put(g, 8, 8, "b");
  // ── 侧鳍边饰（头两侧）──
  put(g, 3, 18, "b");
  rect(g, 2, 19, 3, 20, "b");
  put(g, 3, 21, "b");
  put(g, 20, 18, "b");
  rect(g, 20, 19, 21, 20, "b");
  put(g, 20, 21, "b");
  // ── 身体（chibi 小肩 + 裙子）──
  rect(g, 8, 28, 15, 28, "f"); // 领口
  rect(g, 8, 29, 15, 29, "b");
  rect(g, 9, 30, 14, 30, "b");
  rect(g, 10, 31, 13, 32, "b");
  rect(g, 11, 33, 12, 34, "b");
  put(g, 9, 30, "l");
  put(g, 10, 30, "l");
  return g;
}

/** 腮红。 */
function blush(g, on) {
  if (!on) return;
  rect(g, 7, 24, 8, 25, "s");
  rect(g, 16, 24, 17, 25, "s");
}

/** 眼睛。 */
function eyes(g, style) {
  const fn = EYES[style];
  fn(g, 8, 20);
  fn(g, 13, 20);
}

/** 眉毛。 */
function brows(g, style) {
  if (style === "straight") {
    // 平眉（提醒）：在眼睛上一行，不贴眼
    rect(g, 8, 18, 10, 18, "e");
    rect(g, 13, 18, 15, 18, "e");
  } else if (style === "angry") {
    // 外高内低（可爱生气）：3 像素斜线
    put(g, 8, 17, "e");
    put(g, 9, 18, "e");
    put(g, 10, 19, "e");
    put(g, 15, 17, "e");
    put(g, 14, 18, "e");
    put(g, 13, 19, "e");
  }
}

function mouth(g, style) {
  MOUTHS[style](g);
}

/** 表情小元素。 */
function mark(g, kind) {
  if (kind === "spout") {
    // 帽顶喷水（开心）
    put(g, 11, 1, "f");
    rect(g, 11, 2, 12, 3, "l");
  } else if (kind === "question") {
    // 思考气泡 ?
    put(g, 20, 1, "f");
    put(g, 19, 2, "f");
    put(g, 21, 2, "f");
    put(g, 20, 3, "f");
    put(g, 20, 5, "f");
  } else if (kind === "zzz") {
    // 睡觉 z
    rect(g, 19, 1, 21, 1, "f");
    put(g, 20, 2, "f");
    rect(g, 19, 3, 21, 3, "f");
  } else if (kind === "sweat") {
    // 汗珠（提醒）
    put(g, 21, 13, "t");
    put(g, 21, 14, "t");
    rect(g, 21, 15, 22, 15, "t");
  }
}

function build(name, opts) {
  const g = baseCharacter();
  eyes(g, opts.eyes);
  brows(g, opts.brows ?? "none");
  blush(g, opts.blush ?? true);
  mouth(g, opts.mouth);
  if (opts.mark !== undefined) mark(g, opts.mark);
  return {
    name,
    w: W,
    h: H,
    palette: PALETTE,
    grid: g.map((row) => row.join("")),
  };
}

const sprites = [
  build("idle", { eyes: "open", mouth: "calm", blush: true }),
  build("happy", { eyes: "happy", mouth: "omega", blush: true, mark: "spout" }),
  build("thinking", { eyes: "up", mouth: "o", blush: true, mark: "question" }),
  build("warning", { eyes: "openSole", brows: "straight", mouth: "flat", blush: false, mark: "sweat" }),
  build("angry", { eyes: "openSole", brows: "angry", mouth: "frown", blush: false }),
  build("sleepy", { eyes: "closed", mouth: "o", blush: true, mark: "zzz" }),
];

mkdirSync(OUT, { recursive: true });
for (const sprite of sprites) {
  writeFileSync(join(OUT, `${sprite.name}.json`), JSON.stringify(sprite, null, 2) + "\n");
  console.log(`wrote ${sprite.name}.json`);
}
