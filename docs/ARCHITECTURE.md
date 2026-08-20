# 深迹 DeepTrace TUI · 架构文档

> 终端版 DeepTrace。中文优先、数据确定性、只读。
> 核心原则：**stats / insights / tool-health / collaboration / pricing / period 语义与 Web 版同源**（dsh-whale-report/core），TUI 不复制任何聚合算法。

## 1. 总览

```
DSH 本机会话存档（~/.dsh/sessions/**/session.jsonl.zstd）
        ↓ SessionStore（原生 zstd + chunk 预过滤 + 持久化分桶缓存）
分桶视图（10 分钟粒度，与 Web 版 session_index 同构）
        ↓ statsForRange = aggregateBuckets（core，与 Web collectEvents 同路径）
ReportStats
        ↓ computeCost / computeInsights / computeCollaborationInsights / buildWhaleNote（core）
AppData（controller 编排）
        ↓ 纯函数 view-model（vm/）
Frame（Ink 5 / React，纯展示，无副作用）
        ↓
交互式 TUI（DeepTraceApp：键盘导航 + 低频刷新）
 或 无头渲染（--render，CI/截图/文档）
```

## 2. 模块职责

| 文件 | 职责 | 关键约束 |
| --- | --- | --- |
| `src/core/index.ts` | DeepTrace Core 唯一入口（re-export `dsh-whale-report/core`） | 未来拆 `@deeptrace/core` 只改此文件 |
| `src/data/archive.ts` | 存档读取：原生 zstd 多帧解压、chunk 行预过滤、宽松 JSON 解析 | 只做 IO，无统计逻辑 |
| `src/data/store.ts` | SessionStore：分桶视图缓存（mtime+size 指纹）、增量刷新、缓存修剪 | 只读；缓存为派生视图 |
| `src/data/report.ts` | 报告控制器：周期范围、趋势、prev 基线、会话费用折算编排 | 全部算法来自 core |
| `src/controller.ts` | TUI 状态机：加载 / 刷新 / 进度广播 | 与 UI 解耦 |
| `src/vm/*` | 视图模型（纯函数）：overview / tools / trace / history / format | 无 Ink 依赖，可直接单测 |
| `src/render/Frame.tsx` | 框架壳：响应式档位 + 视图路由（presentational） | 无副作用，交互 App 与无头渲染共用 |
| `src/render/layout.tsx` | Header / Footer / KPI / 分隔线（极简壳） | 全屏仅 1 条分隔线 |
| `src/render/views/*` | 五视图 + Help 独立组件 | 纯展示，数据来自 vm |
| `src/render/app.tsx` | DeepTraceApp：键盘导航、状态订阅、复制、低频 watch | 不虚构状态 |
| `src/render/whale/` | 观察员小鲸鱼：`mascot.ts` 纯函数线稿（3×11，无素材文件）+ Ink 组件 | mood 与 core whaleMood 严格同源；五官纯 ASCII |
| `src/cli.tsx` | CLI：交互 / 无头渲染 / 参数解析 | — |

## 3. 数据流（一次打开）

1. `SessionStore.load()`：发现存档（递归 `*.jsonl.zstd`）→ 每文件指纹（mtime+size）→
   命中 `$DSH_HOME/deeptrace-cache/<sha1(路径)>.json`（`INDEX_VERSION=1` 校验）直接复用分桶；
   未命中 → 原生 zstd 解压（node:zlib，fzstd 回退）→ 行级预过滤 chunk 类事件
   （`DROP_EVENT_TYPES`，占总行数 85%）→ `bucketizeOwnEvents`（core）→ 异步写缓存。
   并发 12，进度回调。
2. `buildReport()`：
   - 当前周期 `presetRange`（core，本地日历语义）；
   - `statsForRange` = 候选过滤（`createdAt < period.to`，与 Web `collectEvents` 一致）→ `aggregateBuckets`（core）；
   - `fillSessionCosts`：会话级折算（`getPrices`/`modelCost`/`modelTier`/`OPENCODE_GO_PRICES`，core，6h 价格缓存）→ 排序 Top 20；
   - prev 基线 = 前一个完整周期（`periodRanges`）；
   - `computeInsights`（core，9 条确定性规则）+ `computeCollaborationInsights`（core）+ 趋势 5 周期；
   - 鲸鱼娘：`triggerNotes` / `whaleMood` / `buildWhaleNote`（core 同规则同文案）。
3. 视图模型（vm）→ Frame 渲染。

## 4. 周期语义

- 与 Web 完全同源：`presetRange`（日报=今天 0:00 / 24h=滚动 / 周=周一 0:00 / 月=1 日 / 年=1 月 1 日）；
- `periodKey` / `previousPeriodKey` 来自 core（TUI 的 prev 基线 = 前一个完整周期，24h 无 prev）；
- 趋势 = 最近 4 个完整周期 + 当前周期（`○ LIVE` 标记，与完整周期区分）；
- 周标签按**本地时区**计算 ISO 周（与用户感知一致；core 的存储 key 仍按 UTC 语义，两者仅用于不同用途）。

## 5. 性能设计

| 场景 | 机制 | 实测（97 存档） |
| --- | --- | --- |
| 首次打开 | 原生 zstd + 并发 12 + 进度条 | ~4-6s |
| 再次打开 | 持久化分桶缓存（指纹匹配） | **~1s** |
| 刷新 | 只重读指纹变化的文件 | 增量 |

- 原生 zstd：`node:zlib.zstdDecompressSync`（Node ≥23），fzstd（WASM）自动回退——实测 43s → 3.8s；
- 缓存：`$DSH_HOME/deeptrace-cache/`，结构与 Web 版 whale 存储域 `session_index` 同构
  （10 分钟分桶、标题、lastSeq/lastMs、INDEX_VERSION 语义）；
- `--watch N` 低频自动刷新（默认关闭），`r` 手动刷新，不轮询。

## 6. 键盘

遵循 dsh-tui 习惯（`?` 帮助、`q` 退出、raw-mode 输入）：

`1-5` 视图 · `j/↓ k/↑` 移动 · `Enter` 打开（会话详情 / 需要关注跳转 / 鲸评展开）· `Esc` 返回 ·
`r` 刷新 · `c` 复制 Session ID（会话详情）· 历史页 `c/s/t/h` 切换指标 ·
`?` 帮助（含 DIAGNOSTICS）· `q` 退出 · `Ctrl+C` 退出

**会话跳转不伪造**：官方 DSH 没有跨应用"打开会话"机制（dsh-tui 的 resume 是 profile 内自实现），
因此与 Web 版一致提供"复制 Session ID"（`pbcopy`/`wl-copy`/`xclip`，缺失时在状态行展示 ID 本体）。

## 7. 颜色与响应式（v2）

**颜色角色**（统一，不做彩虹）：brand=蓝 → 身份/激活 · signal=cyan → 信息 ·
warn=amber → 注意 · error=red → 仅真危险 · muted=灰 → 元数据 · text=白 → 主内容。

- no-color：全部 token → undefined，只保留 bold/dim（`NO_COLOR` / `TERM=dumb` / `--no-color` 自动降级）；
- **响应式三档宽度 × 三档高度**（`widthBandOf` / `heightBandOf`，不做几十个断点）：

| 档位 | 条件 | 行为 |
| --- | --- | --- |
| COMPACT | <90 列 | 单列、隐藏鲸鱼、KPI 四列固定 |
| STANDARD | 90–129 | 主内容 + 右下小鲸鱼 |
| WIDE | ≥130 | Trace 双栏（左列表右 detail）、Tools 正常工具双列 |
| LOW | <26 行 | 需要关注 Top 2、隐藏鲸评、footer 永远可见 |
| NORMAL | 26–39 | — |
| TALL | ≥40 | — |

- 信息架构：KPI（数字）→ 需要关注（异常优先 Top 3）→ 趋势（方向感）→ Trace（深入）；
  Overview 不重复 History 的完整趋势；全屏分隔线仅 Header 下 1 条，其余靠空白/缩进/颜色分层；
- 布局文件：`src/render/layout.tsx`（Header/Footer/KPI）+ `src/render/views/*`（五视图 + Help）；
  winsize 缺失（0×0 伪终端）时钳制到最小布局。

## 8. 隐私与安全边界

- 只读：不写回任何会话文件；缓存是本地派生视图（与 Web 版存储域同性质）；
- Secret Scan 只报模式标签 + 次数，不打印原文（core `SECRET_PATTERNS` 语义）；
- 危险命令只存首行（core 语义）；工具错误只存错误码枚举（core 语义）；
- 复制只涉及 Session ID；API key 完全不涉及（Provider Balance 属 Phase 2，key 仅宿主进程内使用）。

## 9. 与 Web 版的关系与未来拆分

- 当前：TUI 依赖 `github:SenmuuuuW/dsh-whale-report`（`./core` 导出子路径）；
- 未来：`@deeptrace/core` 独立包（core 导出已就绪，拆分零成本）；
- Web 客户端鲸评文案（`src/client/index.tsx` 内嵌）尚未迁移到 `whale-copy.ts`——TUI 使用 canonical 副本，
  Web 迁移是独立小步（不动现有稳定客户端）。

## 10. Roadmap

- [x] Phase 1：repo / 真实数据 / 总览 / 工具健康 / 会话轨迹 / 键盘导航 / 中文 UI / 像素鲸鱼娘占位 / tests / README
- [x] Phase 1+（core 免费能力）：协作复盘 / 历史趋势
- [ ] Provider Balance（core `balance.ts` 已导出）
- [ ] 正式像素素材（docs/WHALE_ASSET_SPEC.md）
- [ ] dsh-tui 内集成入口
- [ ] 周期切换（`p` 键 / `--preset` 交互切换）
