/**
 * 剪贴板复制（只复制 Session ID 等非敏感标识；不复制任何 secret/key）。
 * 支持 macOS pbcopy / Linux wl-copy、xclip；都没有时返回 false（由 UI 显示 ID 本身）。
 */
import { spawnSync } from "node:child_process";

export function copyToClipboard(text: string): boolean {
  const cmds: string[][] =
    process.platform === "darwin"
      ? [["pbcopy"]]
      : process.platform === "linux"
        ? [["wl-copy"], ["xclip", "-selection", "clipboard"]]
        : [];
  for (const cmd of cmds) {
    try {
      const r = spawnSync(cmd[0], cmd.slice(1), { input: text, encoding: "utf8", timeout: 2000 });
      if (r.status === 0) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}
