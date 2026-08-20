/**
 * 观察员小鲸鱼线稿预览 —— 肉眼校验用，不参与构建。
 *   pnpm tsx scripts/mascot-preview.mts
 *
 * 校验三件事：
 *   1. 六种状态轮廓完全一致（只有五官变）
 *   2. 每行显示宽度 = MARK_ROW_WIDTHS（不会把布局撑歪）
 *   3. ascii 降级版与 box 版占位一致
 */
import { displayWidth } from "../src/vm/format.ts";
import { MARK_ROW_WIDTHS, TICK_WIDTH, WHALE_STATES, mascotToText, whaleMascot } from "../src/render/whale/mascot.ts";

function ruler(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += (i % 10).toString();
  return s;
}

for (const ascii of [false, true]) {
  console.log(`\n${"═".repeat(46)}\n  ${ascii ? "ASCII 降级版（--ascii）" : "box-drawing 默认版"}\n${"═".repeat(46)}`);
  console.log("    " + ruler(12));
  for (const state of WHALE_STATES) {
    const m = whaleMascot(state, ascii);
    const rows = mascotToText(state, ascii);
    const widths = rows.map(displayWidth);
    const ok = widths.every((w, i) => w === MARK_ROW_WIDTHS[i]);
    const tickText = m.tick.map((s) => s.text).join("");
    const tickOk = displayWidth(tickText) === TICK_WIDTH;
    console.log(`\n  ${state} — ${m.label} [${m.tone}] ${ok ? "宽度 OK" : `!! 宽度 ${widths.join("/")}`}`);
    for (const r of rows) console.log("    " + r + "|");
    console.log(`    tick: ${tickText}| ${tickOk ? "" : `!! ${displayWidth(tickText)}`}`);
  }
}
