import { loadWhaleSprite } from "../src/render/whale/render.ts";
// 结构化调试视图：每个 palette 键映射到唯一可见字符（按明暗）
const MAP: Record<string, string> = { e: "#", h: "@", H: "B", b: "B", l: "L", s: "S", f: "o", w: "W", t: "~", ".": " " };
for (const name of ["idle","happy","thinking","warning","angry","sleepy"]) {
  const s = loadWhaleSprite(name);
  console.log(`── ${name} (${s.w}x${s.h}) ──`);
  for (const row of s.grid) console.log(row.split("").map((c) => MAP[c] ?? c).join(""));
}
