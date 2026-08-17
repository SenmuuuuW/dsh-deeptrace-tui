/**
 * 会话存档读取层：直接读取 DSH 本机会话存档（~/.dsh/sessions 下的 session.jsonl.zstd）。
 *
 * 性能（关键约束：打开 TUI 不能全量扫描十几秒）：
 * 1. 优先用 Node 内置原生 zstd（node:zlib.zstdDecompressSync，Node ≥23）；
 *    旧 Node 自动回退 fzstd（WASM，约慢 9 倍）。实测 97 存档全量扫描
 *    43s（fzstd）→ 3.8s（原生）。
 * 2. 解析前用正则预过滤 chunk 类行（assistant/chunk、reasoning-chunks、
 *    tool-call-chunks、text-chunks —— 占总行数 85% 且聚合引擎从不消费），
 *    避免 JSON.parse 它们的大载荷。
 * 3. 上层 SessionStore 另有持久化分桶缓存（复用 Web 版 session_index 思路，
 *    见 docs/ARCHITECTURE.md），重复打开秒级返回。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import zlib from "node:zlib";
import { decompress } from "fzstd";

/** zstd 帧魔数（28 B5 2F FD），用于多帧切分。 */
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

/**
 * 原生 zstd（node:zlib，Node ≥23 提供）。用属性访问而非具名 import：
 * 旧 Node 的 node:zlib 没有该导出，具名 import 会直接链接失败。
 */
const nativeZstdSync = (zlib as unknown as { zstdDecompressSync?: (buf: Buffer) => Buffer }).zstdDecompressSync;
const NATIVE_ZSTD = typeof nativeZstdSync === "function";

/** 会话头部信息（session.jsonl 第一行）。 */
export interface SessionFileHeader {
  id: string;
  createdAt: number;
  cwd?: string;
  delegationDepth?: number;
  /** 继承事件边界（seedLength）；归档行里存在时保留，供分桶对齐。 */
  seedLength?: number;
}

export interface SessionFileEvent {
  type: string;
  seq: number;
  time: number;
  data?: unknown;
}

export interface SessionFile {
  path: string;
  /** 缓存键：mtime+size，变了才重读。 */
  mtimeMs: number;
  size: number;
  header: SessionFileHeader | null;
  events: SessionFileEvent[];
}

/** 解压单个 zstd 帧。 */
export function decompressFrame(buf: Buffer): Buffer {
  if (NATIVE_ZSTD) return nativeZstdSync(buf);
  return Buffer.from(decompress(buf));
}

/**
 * 聚合引擎不消费的高频事件类型（chunk 流 + 运行时噪音）。
 * 引擎语义仍是权威（未知类型一律跳过）；此集合只是避免解析大载荷。
 */
export const DROP_EVENT_TYPES: ReadonlySet<string> = new Set([
  "assistant/chunk",
  "reasoning-chunks",
  "tool-call-chunks",
  "text-chunks",
  "request/context",
  "step/end",
  "turn/end",
  "permission/preset",
  "sandbox/mode",
  "approval/policy",
  "agent/inbox/spliced",
  "session/end-seed",
  "todo/write",
  "llm/retry",
  "llm/retry-started",
  "compaction/prune",
  "compaction/start",
  "compaction/summary",
  "compaction/end",
  "web/deepseek-search-llm-request",
]);

/** 行级预过滤：chunk 类行直接跳过，不 JSON.parse。 */
export function shouldParseLine(line: string): boolean {
  // 只检查行首的 type 字段（所有事件行都以此开头），避免正则扫全行大载荷。
  return !/^\{"type":"(assistant|reasoning|tool-call|text)-chunks"/.test(line);
}

/** zstd 多帧解压：按帧头魔数切分，尾部损坏帧跳过。 */
export function decompressFrames(buf: Buffer): string {
  const starts: number[] = [];
  for (let i = 0; i <= buf.length - 4; i++) {
    if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) starts.push(i);
  }
  let out = "";
  for (let k = 0; k < starts.length; k++) {
    const end = k + 1 < starts.length ? starts[k + 1] : buf.length;
    try {
      out += decompressFrame(buf.subarray(starts[k], end)).toString("utf8");
    } catch {
      /* 尾部损坏帧直接跳过 */
    }
  }
  return out;
}

/** 递归找出所有会话存档文件。 */
export function findSessionFiles(root: string): string[] {
  const files: string[] = [];
  if (!existsSync(root)) return files;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".jsonl.zstd")) files.push(p);
    }
  };
  walk(root);
  return files.sort();
}

/** 解析单个存档文件：header（session 行）+ 事件数组（宽容解析 + chunk 预过滤）。 */
export function readSessionFile(path: string): { header: SessionFileHeader | null; events: SessionFileEvent[] } {
  const lines = decompressFrames(readFileSync(path)).trim().split("\n").filter(Boolean);
  let header: SessionFileHeader | null = null;
  const events: SessionFileEvent[] = [];
  for (const line of lines) {
    if (!shouldParseLine(line)) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (parsed.type === "session") {
      header = {
        id: typeof parsed.id === "string" ? parsed.id : "",
        createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0,
        cwd: typeof parsed.cwd === "string" ? parsed.cwd : undefined,
        delegationDepth: typeof parsed.delegationDepth === "number" ? parsed.delegationDepth : undefined,
        seedLength: typeof parsed.seedLength === "number" ? parsed.seedLength : undefined,
      };
    } else if (typeof parsed.time === "number") {
      events.push({
        type: String(parsed.type),
        seq: typeof parsed.seq === "number" ? parsed.seq : 0,
        time: parsed.time,
        data: parsed.data,
      });
    }
  }
  return { header, events };
}

/** 会话存档根目录（$DSH_HOME/sessions，默认 ~/.dsh/sessions）。 */
export function sessionsRoot(dshHome: string): string {
  return join(dshHome, "sessions");
}

/** 统计文件基本信息（用于 mtime+size 缓存键）。 */
export function fileFingerprint(path: string): { mtimeMs: number; size: number } | null {
  try {
    const st = statSync(path);
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return null;
  }
}
