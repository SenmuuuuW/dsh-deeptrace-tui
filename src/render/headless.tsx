/**
 * 无头渲染：把任意 Ink 组件渲染成指定宽高的单帧纯文本。
 *
 * 为什么不用 ink-testing-library：它内部的假 stdout 把 columns 硬编码成 100，
 * 于是 `--width 160` 会被静默截断成 100 列，截图和测试都不可信。
 * 这里自己造 stdout/stdin，columns/rows 完全按调用方给的来。
 */
import { EventEmitter } from "node:events";
import { render } from "ink";
import type React from "react";

class FakeStdout extends EventEmitter {
  readonly frames: string[] = [];
  constructor(
    public columns: number,
    public rows: number,
  ) {
    super();
  }
  write(data: string): boolean {
    this.frames.push(data);
    return true;
  }
  get lastFrame(): string {
    return this.frames.at(-1) ?? "";
  }
}

class FakeStdin extends EventEmitter {
  isTTY = false;
  setEncoding(): this {
    return this;
  }
  setRawMode(): this {
    return this;
  }
  resume(): this {
    return this;
  }
  pause(): this {
    return this;
  }
  read(): null {
    return null;
  }
  unref(): this {
    return this;
  }
  ref(): this {
    return this;
  }
}

export interface HeadlessOptions {
  width: number;
  height: number;
}

/** 渲染一帧并返回文本。debug 模式下 Ink 每次都把完整画面写入 stdout。 */
export async function renderToText(
  node: React.ReactElement,
  { width, height }: HeadlessOptions,
): Promise<string> {
  const stdout = new FakeStdout(width, height);
  const stdin = new FakeStdin();
  const instance = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    stderr: stdout as unknown as NodeJS.WriteStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  // 让 effect / setState 落地后再取帧。
  await new Promise((resolve) => setTimeout(resolve, 30));
  const text = stdout.lastFrame;
  instance.unmount();
  instance.cleanup();
  return text.replace(/\n$/, "");
}
