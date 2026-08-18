/**
 * 终端尺寸 hook —— 真正的 reactive viewport。
 *
 * 背景：Ink 5 的 resize 处理（ink.js resized → calculateLayout + onRender）
 * 只对已渲染的组件树做 yoga 重排，**不触发 React 组件重渲染**；因此
 * 组件在渲染时读取的 stdout.columns/rows 会永远停留在启动时的值。
 * 本 hook 自监听 resize 事件 → setState → 组件重渲染 → 档位重算。
 *
 * 尺寸优先级（standalone 与未来嵌入 dsh-tui 均适用）：
 *   显式 width/height props
 *   → Ink stdout（当前可信的终端对象）
 *   → process.stdout（兜底；两者通常同一对象）
 *   → fallback 100×40（绝不假定 80×24）
 */
import { useEffect, useState } from "react";
import { useStdout } from "ink";

export interface TerminalDims {
  width: number;
  height: number;
  source: "props" | "ink" | "process" | "fallback";
}

export interface DimsInput {
  propW?: number;
  propH?: number;
  inkW?: number;
  inkH?: number;
  procW?: number;
  procH?: number;
}

/** 纯函数：按优先级解析尺寸（可单测）。0/负值视为缺失（0×0 伪终端）。 */
export function resolveDims(input: DimsInput): TerminalDims {
  const pos = (v: number | undefined): number | undefined => (typeof v === "number" && v > 0 ? v : undefined);
  const pW = pos(input.propW);
  const pH = pos(input.propH);
  const iW = pos(input.inkW);
  const iH = pos(input.inkH);
  const cW = pos(input.procW);
  const cH = pos(input.procH);
  const source: TerminalDims["source"] =
    pW !== undefined || pH !== undefined
      ? "props"
      : iW !== undefined || iH !== undefined
        ? "ink"
        : cW !== undefined || cH !== undefined
          ? "process"
          : "fallback";
  return { width: pW ?? iW ?? cW ?? 100, height: pH ?? iH ?? cH ?? 40, source };
}

interface StdoutLike {
  columns?: number;
  rows?: number;
}

function readDims(stdout: StdoutLike, propW?: number, propH?: number): TerminalDims {
  const pos = (v: number | undefined): number | undefined =>
    typeof v === "number" && v > 0 ? v : undefined;
  return resolveDims({
    propW,
    propH,
    inkW: pos(stdout.columns),
    inkH: pos(stdout.rows),
    procW: pos(process.stdout.columns),
    procH: pos(process.stdout.rows),
  });
}

/**
 * Reactive 终端尺寸：
 * - 初始读取实际 stdout 尺寸；
 * - 监听 stdout `resize` 事件 → setState → 重渲染；
 * - 上限防御（超大/异常 winsize 钳制，不设固定 80×24）。
 */
export function useTerminalDimensions(propW?: number, propH?: number): TerminalDims {
  const { stdout } = useStdout();
  const [dims, setDims] = useState<TerminalDims>(() => readDims(stdout, propW, propH));

  useEffect(() => {
    const onResize = (): void => setDims(readDims(stdout, propW, propH));
    stdout.on("resize", onResize);
    // 未来嵌入 dsh-tui 时可能注入不同 stdout：同时监听 process.stdout。
    if (stdout !== process.stdout) process.stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
      if (stdout !== process.stdout) process.stdout.off("resize", onResize);
    };
  }, [stdout, propW, propH]);

  return {
    width: Math.max(40, Math.min(dims.width, 300)),
    height: Math.max(12, Math.min(dims.height, 100)),
    source: dims.source,
  };
}
