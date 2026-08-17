/**
 * Controller：TUI 与数据层的桥。持有 SessionStore + 当前周期，负责
 * 初始加载 / 增量刷新，并通过订阅向 UI 广播状态（loading/progress/data/error）。
 */
import type { ReportPreset } from "./core/index.js";
import { SessionStore } from "./data/store.js";
import { buildReport, type AppData, type BuildProgress } from "./data/report.js";

export interface ControllerSnapshot {
  data: AppData | null;
  loading: boolean;
  progress: BuildProgress | null;
  error: string | null;
}

export class Controller {
  readonly store: SessionStore;
  data: AppData | null = null;
  loading = false;
  progress: BuildProgress | null = null;
  error: string | null = null;

  private readonly listeners = new Set<() => void>();

  constructor(readonly dshHome: string, readonly preset: ReportPreset = "weekly") {
    this.store = new SessionStore(dshHome);
  }

  snapshot(): ControllerSnapshot {
    return { data: this.data, loading: this.loading, progress: this.progress, error: this.error };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** 首次加载。 */
  async init(): Promise<void> {
    await this.build();
  }

  /** 增量刷新：只重读变化的存档，再重算当前周期。 */
  async refresh(): Promise<void> {
    this.loading = true;
    this.progress = { phase: "archive", message: "增量刷新会话存档…" };
    this.emit();
    try {
      await this.store.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.loading = false;
      this.progress = null;
      this.emit();
      return;
    }
    await this.build();
  }

  private async build(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.progress = null;
    this.emit();
    try {
      const data = await buildReport(this.store, this.preset, Date.now(), (p) => {
        this.progress = p;
        this.emit();
      });
      this.data = data;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
      this.progress = null;
      this.emit();
    }
  }
}
