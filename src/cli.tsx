/**
 * CLI：deeptrace / dsh-trace
 *
 *   deeptrace               交互式 TUI（默认：本周总览）
 *   deeptrace --render <view>   无头渲染指定视图并退出（CI/截图/README）
 *   deeptrace --view <view>     --render 的别名
 *   deeptrace --preset weekly|daily|24h|monthly|yearly
 *   deeptrace --watch 60    低频自动刷新（秒）
 *   deeptrace --no-color     单色模式
 *   deeptrace --dsh-home <path>  覆盖 DSH_HOME（默认 ~/.dsh）
 *   deeptrace --width/--height N  固定视口尺寸（无头渲染用）
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { render } from "ink";
import { render as testRender } from "ink-testing-library";
import { Controller } from "./controller.js";
import type { ReportPreset } from "./core/index.js";
import { SessionStore } from "./data/store.js";
import { buildReport } from "./data/report.js";
import { DeepTraceApp } from "./render/app.js";
import { Frame, VIEW_LABELS, type View } from "./render/Frame.js";
import { detectColorSupport, resolveTheme } from "./render/theme.js";

const PRESETS: ReportPreset[] = ["weekly", "daily", "24h", "monthly", "yearly"];

export const USAGE = `深迹 DeepTrace TUI · Your Agent, in numbers.

用法:
  deeptrace                      交互式 TUI（默认本周总览）
  deeptrace --render overview    无头渲染指定视图后退出（CI/截图用）
  deeptrace --view trace         同上（别名）

选项:
  --render <view>   视图: overview | tools | trace | collab | history
  --view <view>     --render 的别名
  --preset <p>      周期: ${PRESETS.join(" | ")}（默认 weekly）
  --watch <sec>     低频自动刷新（默认关闭）
  --no-color        单色模式（兼容 no-color 终端）
  --dsh-home <path> 会话存档根（默认 $DSH_HOME 或 ~/.dsh）
  --width/--height  固定视口（无头渲染用，默认 100x40）
  --help            显示帮助

键盘:
  1-5 视图 · j/k/↑↓ 移动 · Enter 打开 · Esc 返回 · r 刷新
  c 复制 Session ID（会话详情）· 历史页 c/s/t/h 切换指标
  ? 帮助 · q 退出
`;

export interface CliArgs {
  renderView: View | null;
  preset: ReportPreset;
  watchSec: number;
  color: boolean;
  dshHome: string;
  width: number;
  height: number;
  help: boolean;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    renderView: null,
    preset: "weekly",
    watchSec: 0,
    color: true,
    dshHome: process.env.DSH_HOME ?? join(homedir(), ".dsh"),
    width: 100,
    height: 40,
    help: false,
  };
  const value = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i === -1 || i + 1 >= argv.length ? undefined : argv[i + 1];
  };
  for (const flag of ["--help", "-h"]) {
    if (argv.includes(flag)) args.help = true;
  }
  const renderFlag = value("--render") ?? value("--view");
  if (renderFlag !== undefined) {
    if (!(renderFlag in VIEW_LABELS)) throw new Error(`未知视图：${renderFlag}（可选 ${Object.keys(VIEW_LABELS).join("/")}）`);
    args.renderView = renderFlag as View;
  }
  const preset = value("--preset");
  if (preset !== undefined) {
    if (!PRESETS.includes(preset as ReportPreset)) throw new Error(`未知周期：${preset}（可选 ${PRESETS.join("/")}）`);
    args.preset = preset as ReportPreset;
  }
  const watch = value("--watch");
  if (watch !== undefined) {
    const n = Number(watch);
    if (!Number.isFinite(n) || n <= 0) throw new Error("--watch 需要正数秒");
    args.watchSec = n;
  }
  const width = value("--width");
  if (width !== undefined) {
    const n = Number(width);
    if (!Number.isFinite(n) || n < 40) throw new Error("--width 需要 >=40");
    args.width = n;
  }
  const height = value("--height");
  if (height !== undefined) {
    const n = Number(height);
    if (!Number.isFinite(n) || n < 12) throw new Error("--height 需要 >=12");
    args.height = n;
  }
  const dshHome = value("--dsh-home");
  if (dshHome !== undefined) args.dshHome = dshHome;
  args.color = detectColorSupport(process.env, argv);
  return args;
}

/** 无头渲染：真实数据 → 单帧文本（不含 ANSI 时用于截图/CI）。 */
export async function renderHeadless(args: CliArgs): Promise<string> {
  const store = new SessionStore(args.dshHome);
  const data = await buildReport(store, args.preset);
  const theme = resolveTheme(args.color);
  const frame = testRender(
    <Frame
      view={args.renderView ?? "overview"}
      data={data}
      theme={theme}
      width={args.width}
      height={args.height}
      selected={0}
      detail={null}
      noteOpen={false}
      helpOpen={false}
      loading={false}
      progress={null}
      error={null}
      flash={null}
      updatedAt={data.generatedAt}
      archiveInfo={`${data.archive.files} 存档 · ${data.archive.events.toLocaleString()} 事件`}
      historyMetric="cost"
    />,
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  const text = frame.lastFrame() ?? "";
  frame.unmount();
  return text;
}

export async function main(argv: readonly string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(USAGE);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.renderView !== null) {
    const text = await renderHeadless(args);
    process.stdout.write(text + "\n");
    return 0;
  }
  const theme = resolveTheme(args.color);
  render(<DeepTraceApp dshHome={args.dshHome} preset={args.preset} theme={theme} watchSec={args.watchSec} />);
  return 0;
}
