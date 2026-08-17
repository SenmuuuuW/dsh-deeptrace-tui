#!/usr/bin/env node
/**
 * sprite JSON → PNG 预览（开发工具）：把 assets/whale/*.json 渲染成大图
 * （×10 缩放 + 棋盘格透明背景），供人工检查像素画。
 *
 * 用法: node scripts/sprite-png.mjs [名字...]  （默认全部 6 张，输出 /tmp/whale-art/*.png 和 sheet.png）
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SPRITES = ["idle", "happy", "thinking", "warning", "angry", "sleepy"];
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "whale");
const OUT = "/tmp/whale-art";
const SCALE = 10;
const CHECK_A = [0xe9, 0xec, 0xf5];
const CHECK_B = [0xff, 0xff, 0xff];

// ── 最小 PNG 编码器（RGBA 8bit，filter 0）──
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 渲染一张 sprite 到 RGBA（×SCALE）。 */
function renderSprite(sprite) {
  const w = sprite.w * SCALE;
  const h = sprite.h * SCALE;
  const rgba = Buffer.alloc(w * h * 4);
  const colors = new Map(Object.entries(sprite.palette).map(([k, v]) => [k, hexToRgb(v)]));
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      const ch = sprite.grid[y][x];
      const color = ch === "." ? null : colors.get(ch) ?? null;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const px = x * SCALE + dx;
          const py = y * SCALE + dy;
          const idx = (py * w + px) * 4;
          if (color === null) {
            const check = ((x + y) & 1) === 0 ? CHECK_A : CHECK_B;
            rgba[idx] = check[0];
            rgba[idx + 1] = check[1];
            rgba[idx + 2] = check[2];
            rgba[idx + 3] = 255;
          } else {
            rgba[idx] = color[0];
            rgba[idx + 1] = color[1];
            rgba[idx + 2] = color[2];
            rgba[idx + 3] = 255;
          }
        }
      }
    }
  }
  return { w, h, rgba };
}

const names = process.argv.slice(2).length > 0 ? process.argv.slice(2) : SPRITES;
mkdirSync(OUT, { recursive: true });

const sheets = [];
for (const name of names) {
  const sprite = JSON.parse(readJson(name));
  const img = renderSprite(sprite);
  writeFileSync(join(OUT, `${name}.png`), encodePNG(img.w, img.h, img.rgba));
  console.log(`wrote ${OUT}/${name}.png (${img.w}x${img.h})`);
  sheets.push(img);
}

// 合成 sheet（横向排列，白底 + 名称标签不可行 → 纯排列）
if (sheets.length > 1) {
  const gap = 8 * SCALE;
  const w = sheets.reduce((a, s) => a + s.w, 0) + gap * (sheets.length - 1);
  const h = Math.max(...sheets.map((s) => s.h));
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = 0x0b;
    rgba[i * 4 + 1] = 0x13;
    rgba[i * 4 + 2] = 0x26;
    rgba[i * 4 + 3] = 255;
  }
  let x = 0;
  for (const s of sheets) {
    for (let y = 0; y < s.h; y++) {
      s.rgba.copy(rgba, ((y * w) + x) * 4, y * s.w * 4, (y + 1) * s.w * 4);
    }
    x += s.w + gap;
  }
  writeFileSync(join(OUT, "sheet.png"), encodePNG(w, h, rgba));
  console.log(`wrote ${OUT}/sheet.png (${w}x${h})`);
}

import { readFileSync } from "node:fs";
function readJson(name) {
  return readFileSync(join(ASSETS, `${name}.json`), "utf8");
}
