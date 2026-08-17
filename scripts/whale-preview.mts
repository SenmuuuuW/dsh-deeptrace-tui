import { loadWhaleSprite, spriteToText } from "../src/render/whale/render.ts";
for (const name of ["idle","happy","thinking","warning","angry","sleepy"]) {
  const s = loadWhaleSprite(name);
  console.log(`── ${name} ──`);
  console.log(spriteToText(s, false).join("\n"));
}
