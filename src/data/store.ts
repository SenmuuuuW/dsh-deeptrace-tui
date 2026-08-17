/**
 * SessionStore：会话存档 → 分桶视图（10 分钟粒度，复用 Web 版 session_index
 * 思路）的缓存层。
 *
 * 性能设计（对齐"打开 TUI 不重新全量扫描"要求）：
 * - 首次加载：原生 zstd 全量扫描 + 分桶（实测 ~4s，进度条展示）；
 * - 持久化缓存：$DSH_HOME/deeptrace-cache/<sha1(路径)>.json，指纹
 *   （mtime+size）匹配直接复用 → 重复打开 <300ms；
 * - refresh：只重读指纹变化的存档，删除已消失存档的缓存；
 * - 只读：不写回任何会话文件，缓存只是本机派生视图（与 Web 版 whale
 *   存储域 session_index 同一性质）。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bucketizeOwnEvents, type HourBucket, type RawSessionHeader, type SessionBucketView } from "../core/index.js";
import { fileFingerprint, findSessionFiles, readSessionFile, sessionsRoot } from "./archive.js";

/** 分桶缓存结构版本：分桶语义变更时 +1，旧缓存自然失效。 */
export const INDEX_VERSION = 1;

export interface LoadProgress {
  done: number;
  total: number;
}

export interface StoreStats {
  files: number;
  events: number;
  sessions: number;
}

interface CacheRecord {
  v: number;
  path: string;
  mtimeMs: number;
  size: number;
  sessionId: string;
  createdAt: number;
  cwd?: string;
  delegationDepth?: number;
  titles: string[];
  buckets: HourBucket[];
}

/** 有限并发映射：与 Web 版 collectEvents 相同的并发策略。 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export class SessionStore {
  private readonly cacheDir: string;
  private readonly views = new Map<string, SessionBucketView>();
  private readonly headerById = new Map<string, RawSessionHeader>();
  private discovered: string[] = [];
  private loaded = false;
  private eventsCached = 0;

  constructor(private readonly dshHome: string) {
    this.cacheDir = join(dshHome, "deeptrace-cache");
  }

  get root(): string {
    return sessionsRoot(this.dshHome);
  }

  private cachePathFor(archivePath: string): string {
    const hash = createHash("sha1").update(archivePath).digest("hex");
    return join(this.cacheDir, `${hash}.json`);
  }

  private readCache(archivePath: string, fingerprint: { mtimeMs: number; size: number }): CacheRecord | null {
    try {
      const raw = readFileSync(this.cachePathFor(archivePath), "utf8");
      const rec = JSON.parse(raw) as CacheRecord;
      if (rec.v !== INDEX_VERSION || rec.path !== archivePath || rec.mtimeMs !== fingerprint.mtimeMs || rec.size !== fingerprint.size) return null;
      return rec;
    } catch {
      return null;
    }
  }

  private writeCache(archivePath: string, fingerprint: { mtimeMs: number; size: number }, record: Omit<CacheRecord, "v" | "path" | "mtimeMs" | "size">): void {
    try {
      if (!existsSync(this.cacheDir)) mkdirSync(this.cacheDir, { recursive: true });
      const rec: CacheRecord = { v: INDEX_VERSION, path: archivePath, mtimeMs: fingerprint.mtimeMs, size: fingerprint.size, ...record };
      writeFileSync(this.cachePathFor(archivePath), JSON.stringify(rec));
    } catch {
      /* 缓存写失败不影响功能 */
    }
  }

  /** 把单个会话的存档变成分桶视图（同步 CPU 密集：解压+解析+分桶）。 */
  private buildView(path: string): SessionBucketView | null {
    const fp = fileFingerprint(path);
    if (fp === null) return null;
    const cached = this.readCache(path, fp);
    if (cached !== null) {
      this.eventsCached += cached.buckets.reduce((a, b) => a + b.total, 0);
      this.rememberHeader({
        id: cached.sessionId,
        createdAt: cached.createdAt,
        cwd: cached.cwd,
        delegationDepth: cached.delegationDepth,
      });
      return { sessionId: cached.sessionId, buckets: cached.buckets, titles: cached.titles };
    }
    const { header, events } = readSessionFile(path);
    if (events.length === 0 && header === null) return null;
    const sessionId = header?.id ?? "";
    const built = bucketizeOwnEvents(sessionId, events, header?.seedLength ?? 0);
    this.writeCache(path, fp, {
      sessionId,
      createdAt: header?.createdAt ?? 0,
      cwd: header?.cwd,
      delegationDepth: header?.delegationDepth,
      titles: built.titles,
      buckets: built.buckets,
    });
    this.eventsCached += built.buckets.reduce((a, b) => a + b.total, 0);
    this.rememberHeader(header);
    return { sessionId, buckets: built.buckets, titles: built.titles };
  }

  private rememberHeader(header: { id: string; createdAt: number; cwd?: string; delegationDepth?: number } | null): void {
    if (header !== null && header.id !== "") {
      this.headerById.set(header.id, { id: header.id, createdAt: header.createdAt, cwd: header.cwd, delegationDepth: header.delegationDepth });
    }
  }

  /** 发现存档文件（每次 refresh 重新发现，兼容新会话目录）。 */
  private discover(): void {
    this.discovered = findSessionFiles(this.root);
  }

  /** 全量加载（首次）。onProgress 用于启动进度显示。 */
  async load(onProgress?: (p: LoadProgress) => void): Promise<StoreStats> {
    this.discover();
    const files = this.discovered;
    let done = 0;
    onProgress?.({ done, total: files.length });
    await mapWithConcurrency(files, 12, async (path) => {
      const view = this.buildView(path);
      if (view !== null) this.views.set(path, view);
      done += 1;
      onProgress?.({ done, total: files.length });
    });
    this.loaded = true;
    return this.stats();
  }

  /** 增量刷新：只重读指纹变化的存档 + 修剪已消失会话的缓存。 */
  async refresh(onProgress?: (p: LoadProgress) => void): Promise<number> {
    this.discover();
    const known = new Set(this.discovered);
    // 已删除的存档：移除视图 + 缓存文件。
    for (const path of [...this.views.keys()]) {
      if (!known.has(path)) {
        this.views.delete(path);
        try {
          rmSync(this.cachePathFor(path), { force: true });
        } catch {
          /* ignore */
        }
      }
    }
    const changed: string[] = [];
    for (const path of this.discovered) {
      const cached = this.views.get(path);
      const fp = fileFingerprint(path);
      if (fp === null) continue;
      const hasView = cached !== undefined;
      const cacheFresh = this.readCache(path, fp) !== null;
      if (!hasView || !cacheFresh) changed.push(path);
    }
    if (changed.length > 0) {
      let done = 0;
      onProgress?.({ done, total: changed.length });
      await mapWithConcurrency(changed, 12, async (path) => {
        const view = this.buildView(path);
        if (view !== null) this.views.set(path, view);
        done += 1;
        onProgress?.({ done, total: changed.length });
      });
    }
    return changed.length;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** 分桶视图（aggregateBuckets 输入，与 Web 版 collectEvents 输出同构）。 */
  viewsList(): SessionBucketView[] {
    return [...this.views.values()];
  }

  headersList(): RawSessionHeader[] {
    return [...this.headerById.values()];
  }

  stats(): StoreStats {
    let events = 0;
    for (const view of this.views.values()) {
      for (const b of view.buckets) events += b.total;
    }
    return { files: this.views.size, events, sessions: this.headerById.size };
  }
}
