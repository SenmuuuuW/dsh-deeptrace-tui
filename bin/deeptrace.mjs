#!/usr/bin/env node
/**
 * deeptrace / dsh-trace —— 深迹 DeepTrace TUI 入口。
 */
import { main } from "../lib/cli.js";

main(process.argv.slice(2))
  .then((code) => {
    if (code !== 0) process.exit(code);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
