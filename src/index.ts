/**
 * 深迹 DeepTrace TUI —— 库入口（测试/嵌入用）。
 * CLI 主入口在 src/cli.ts。
 */
export { Controller, type ControllerSnapshot } from "./controller.js";
export { copyToClipboard } from "./clipboard.js";
export { USAGE, main, parseArgs, renderHeadless, type CliArgs } from "./cli.js";
export * from "./data/archive.js";
export * from "./data/store.js";
export * from "./data/report.js";
export * from "./render/theme.js";
export { Frame, VIEW_LABELS, windowSlice, type FrameProps, type View } from "./render/Frame.js";
export { DeepTraceApp, type AppProps } from "./render/app.js";
export * from "./render/whale/render.js";
export { WhaleFace, MOOD_TO_SPRITE, type WhaleState } from "./render/whale/WhaleFace.js";
export * from "./vm/format.js";
export * from "./vm/overview.js";
export * from "./vm/tools.js";
export * from "./vm/trace.js";
export * from "./vm/history.js";
