/**
 * truncateWidth 的 ASCII 省略号回归。
 *
 * 背景：… (U+2026) 属 East Asian Ambiguous —— 把 ambiguous 判成 2 列的 CJK locale
 * 终端会多占 1 列。旧实现按 max - 1 写死预留，纯 ASCII 截断场景下悲观宽度 = max + 1，
 * 整行溢出换行、把帧顶掉一行。ascii 档改用 "..."（确定 3 列），预留按真实宽度算。
 */
import { describe, expect, it } from "vitest";
import { displayWidth, padStartWidth, padWidth, truncateWidth } from "../src/vm/format.js";

/** 悲观宽度：ambiguous 也按 2 列（CJK locale 最坏情况）。 */
const AMBIGUOUS = /[…—·→←↑↓▲▼●○×≥≤]/;
function pessimisticWidth(s: string): number {
  let n = 0;
  for (const ch of s) n += AMBIGUOUS.test(ch) ? 2 : displayWidth(ch);
  return n;
}

const ASCII_LONG = "abcdefghijklmnopqrstuvwxyz0123456789";
const CJK_LONG = "你现在位于一个全新的仓库需要先读代码再动手";
const MIXED = "session-abcdef 你现在位于一个全新的 Git 仓库";

describe("truncateWidth ASCII 省略号", () => {
  it("ascii 档不产生 …，改用 ...", () => {
    for (const s of [ASCII_LONG, CJK_LONG, MIXED]) {
      for (const max of [6, 10, 20, 33]) {
        const out = truncateWidth(s, max, true);
        expect(out, `${s.slice(0, 8)} max=${max}`).not.toContain("…");
      }
    }
  });

  it("默认档（非 ascii）仍用 …，行为不变", () => {
    expect(truncateWidth(ASCII_LONG, 20)).toBe("abcdefghijklmnopqrs…");
    expect(truncateWidth(ASCII_LONG, 20, false)).toBe("abcdefghijklmnopqrs…");
  });

  it("纯 ASCII 长串：ascii 档悲观宽度 <= max", () => {
    for (const max of [4, 5, 8, 12, 20, 35]) {
      const out = truncateWidth(ASCII_LONG, max, true);
      expect(pessimisticWidth(out), `max=${max} → |${out}|`).toBeLessThanOrEqual(max);
    }
  });

  it("题面给的例子：truncateWidth(ASCII_LONG, 20, true) 悲观宽度 <= 20", () => {
    const out = truncateWidth("abcdefghijklmnopqrstuvwxyz", 20, true);
    expect(pessimisticWidth(out)).toBeLessThanOrEqual(20);
    // 17 个半宽字符 + "..."（3 列）= 恰好 20 列。
    expect(out).toBe("abcdefghijklmnopq...");
  });

  it("CJK 长串：ascii 档悲观 <= max，默认档 displayWidth <= max，都不切半个汉字", () => {
    for (const ascii of [true, false]) {
      for (const max of [5, 8, 11, 20, 30]) {
        const out = truncateWidth(CJK_LONG, max, ascii);
        // ascii 档的保证更强：连 CJK locale 最坏情况也不越界。
        const w = ascii ? pessimisticWidth(out) : displayWidth(out);
        expect(w, `ascii=${ascii} max=${max} → |${out}|`).toBeLessThanOrEqual(max);
        // 汉字要么整个在，要么不在：输出去掉省略号后必须是原串前缀。
        const body = out.replace(/(\.\.\.|…)$/, "");
        expect(CJK_LONG.startsWith(body), `ascii=${ascii} max=${max}`).toBe(true);
      }
    }
  });

  it("混合串：ascii 档悲观 <= max，默认档 displayWidth <= max", () => {
    for (const ascii of [true, false]) {
      for (const max of [6, 9, 14, 20, 28, 40]) {
        const out = truncateWidth(MIXED, max, ascii);
        const w = ascii ? pessimisticWidth(out) : displayWidth(out);
        expect(w, `ascii=${ascii} max=${max} → |${out}|`).toBeLessThanOrEqual(max);
      }
    }
  });

  it("极小 max：容不下省略号就硬截，绝不吐出比 max 更宽的串", () => {
    for (const ascii of [true, false]) {
      for (const s of [ASCII_LONG, CJK_LONG, MIXED]) {
        for (const max of [0, 1, 2, 3, 4]) {
          const out = truncateWidth(s, max, ascii);
          const w = ascii ? pessimisticWidth(out) : displayWidth(out);
          expect(w, `ascii=${ascii} max=${max} → |${out}|`).toBeLessThanOrEqual(max);
        }
      }
    }
    expect(truncateWidth(ASCII_LONG, 0, true)).toBe("");
    // max=2 容不下 "..."（3 列），硬截无省略号。
    expect(truncateWidth(ASCII_LONG, 2, true)).toBe("ab");
    // max=3 刚好等于省略号宽度，也走硬截（否则只剩省略号，没信息量）。
    expect(truncateWidth(ASCII_LONG, 3, true)).toBe("abc");
  });

  it("未超宽时原样返回，不加省略号", () => {
    expect(truncateWidth("abc", 10, true)).toBe("abc");
    expect(truncateWidth("你好", 4, true)).toBe("你好");
  });

  it("padWidth / padStartWidth 继承 ascii 档（内部会截断）", () => {
    for (const w of [8, 12, 20]) {
      const p = padWidth(ASCII_LONG, w, true);
      const q = padStartWidth(ASCII_LONG, w, true);
      expect(p).not.toContain("…");
      expect(q).not.toContain("…");
      expect(pessimisticWidth(p), `padWidth w=${w}`).toBeLessThanOrEqual(w);
      expect(pessimisticWidth(q), `padStartWidth w=${w}`).toBeLessThanOrEqual(w);
    }
  });

  it("回归钉子：旧的写死 max - 1 会让纯 ASCII 截断超宽 1 列", () => {
    // 旧实现等价于「预留 1 列 + 用 …」。这里直接构造它的输出，证明检测有效。
    const oldStyle = `${ASCII_LONG.slice(0, 19)}…`;
    expect(displayWidth(oldStyle)).toBe(20);
    expect(pessimisticWidth(oldStyle)).toBe(21);
    // 新实现在同一 max 下不越界。
    expect(pessimisticWidth(truncateWidth(ASCII_LONG, 20, true))).toBeLessThanOrEqual(20);
  });
});
