<p align="center">
  <code><pre>
       ▄▄▄▄▄
     ▄██████▄
    █ ▀█ █▀ █
    █   ▄   █
     ▀█████▀
       ███
      ▀   ▀
  </pre></code>
</p>

<h1 align="center">深迹 · DeepTrace TUI</h1>

<p align="center"><b>Your Agent, in numbers.</b></p>

<p align="center">不离开终端，复盘你的 Agent。</p>

<p align="center">
  <a href="https://github.com/SenmuuuuW/dsh-deeptrace-tui/actions/workflows/ci.yml"><img src="https://github.com/SenmuuuuW/dsh-deeptrace-tui/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-4d6bfe.svg" alt="license"></a>
</p>

---

## Why TUI

你本来就在终端里用 DSH / Agent。当任务出问题时——成本突然变高、retry 变多、工具一直失败、Agent 卡住、想找最值得复盘的 Session——不应该再打开浏览器找 Dashboard。

**深迹 DeepTrace TUI** 把 DeepTrace 带进终端工作流：

> Agent 出问题时，第一反应就是打开 DeepTrace TUI。

## 总览 OVERVIEW

```
深迹 DEEPTRACE                                            ● LIVE · LOCAL · DETERMINISTIC · READ-ONLY
周报 · wk-2026-W34 · 08-17 ~ 08-17                  [1]总览 2工具健康 3会话轨迹 4协作复盘 5历史趋势
----------------------------------------------------------------------------------------------------
成本 ¥6.01（▼ 93%）   会话 97  回合 21  Tokens 97.94M            ▒▒▒▒
Cache 99.8%  夜间 13%                                         ██████████
                                                            ██▓▒▒▒▒▒▒▒▒▓██
趋势 · TREND（近 5 周期）                                   █▓▓▓▓▓▓▓▓▓▓▓▓█
成本  W30   ¥0.00  ▁▁▁▁▁██▂                                 █▓▓░██░░██░▓▓█
成本  W31   ¥0.00  ▁▁▁▁▁██▂                                 █▓▓░██░░██░▓▓█
成本  W32   ¥1.38  ▁▁▁▁▁██▂                                ▓█▓▓░░█░░█░░▓▓█▓
成本  W33  ¥82.26  ▁▁▁▁▁██▂                                ▓█▓▓▓▓▓██▓▓▓▓▓█▓
成本 LIVE   ¥6.01  ▁▁▁▁▁██▂  ○ LIVE                          ████████████
会话  W30   0  ▁▁▁▁▂███
会话  W31   0  ▁▁▁▁▂███
会话  W32  12  ▁▁▁▁▂███
会话  W33  97  ▁▁▁▁▂███                                    鲸评 WHALE NOTE / OBSERVER
会话 LIVE  97  ▁▁▁▁▂███  ○ LIVE                            （摆摆尾巴）嗨，我来啦。
Cache  W30   0.0%  ▁▁▁▁████                                呜哇——这期的危险操作，有点多哦。
Cache  W31   0.0%  ▁▁▁▁████                                （认真检查）删库、强推、格式化……你是想给
Cache  W32  95.5%  ▁▁▁▁████                                运维上强度吗？
Cache  W33  99.4%  ▁▁▁▁████                                重要目录记得先备份，这个真的不是开玩笑的
Cache LIVE  99.8%  ▁▁▁▁████  ○ LIVE                        。
夜间  W30   0%  ▁▁▁▁▁███                                   下次动手之前，先让我看一眼，好不好？
夜间  W31   0%  ▁▁▁▁▁███                                   安全第一，我们一起把项目养得好好的。
夜间  W32   0%  ▁▁▁▁▁███                                   我数着数着，都快给你配上背景音乐了。
夜间  W33  13%  ▁▁▁▁▁███                                   以上，就是本期小评。
夜间 LIVE  13%  ▁▁▁▁▁███  ○ LIVE

发现 · FINDINGS（本期洞察）
01 提示 检测到 7 次重试风暴
02 信息 缓存命中率 99.8%
03 提示 3 条需留意操作
04 提示 会话碎片化：平均每会话仅 0.2 回合
05 提示 费用较上一周期下降 93%
06 警告 工具 edit 失败 56 次，失败率 9.6%
  同一命令连续重复 ≥3 次，共 7 次，占总命令约 11%。
  建议：检查失败命令的前置条件（路径/依赖/权限）。
----------------------------------------------------------------------------------------------------
[j/k] 移动  [Enter] 跳转  [r] 刷新  [?] 帮助  [q] 退出       更新于 19:20:25 · 97 存档 · 77,856 事件
```

数据密度优先：没有卡片堆、没有 Dashboard 方框——像研究终端。

## 工具健康 TOOL HEALTH

```
工具健康 TOOL HEALTH · 按关注度排序（异常优先）· 共 9 个工具 · 调用 221 · 失败 7
01 bash 成功 95.6% · 调用 136 · 失败 5 · 未配对 1 平均 3.6s · P95 16.1s
██████████  TOOL_OUTCOME_UNKNOWN ×5
02 edit 成功 90.5% · 调用 21 · 失败 2 平均 27ms · P95 36ms
█████████░  FS_NOT_OBSERVED ×2
03 write 成功 100.0% · 调用 32 · 失败 0 平均 29ms · P95 57ms
██████████  无失败记录
```

异常工具优先：门槛与 Web 版第 9 条洞察完全同源（≥30 调用、≥5 失败、失败率 ≥8%），只存错误码枚举，不存 error body。

## 会话轨迹 TRACE

```
按费用排序 · Top 3 / 共 3 会话
01 ¥3.86 4 RETRY 1 RISK   69.75M tokens · 107 工具
     (无标题)  08-17 18:21
02 ¥1.05  11.40M tokens · 115 工具
     你现在要创建一个全新的 DSH  08-17 18:54
03 ¥0.00  0 tokens · 0 工具
     (无标题)  08-17 12:25
```

Enter 展开会话详情（费用 / Tokens / 重试 / 风险 / 主要指标），`c` 复制 Session ID——**不伪造跳转能力**（官方暂无跨应用"打开会话"机制，与 Web 版一致）。

## 视图

| # | 视图 | 内容 |
| --- | --- | --- |
| 1 | 总览 | 成本 / 会话 / Tokens / Cache / 夜间 + 5 周期趋势 + 本期发现 + 鲸评 |
| 2 | 工具健康 | 成功率 / 调用 / 失败 / 耗时 / P95 / 错误码，异常优先 |
| 3 | 会话轨迹 | 按费用排序 Top 20，风险标记（RETRY / RED / RISK / SECRET） |
| 4 | 协作复盘 | 需求漂移 / 迟到约束 / 上下文碎片化（确定性规则，样本不足不展示） |
| 5 | 历史趋势 | 近 5 周期成本 / 会话 / Cache / 夜间 / Tokens + 本期按日活跃 |

## 键盘

| 键 | 动作 |
| --- | --- |
| `1`–`5` | 切换视图 |
| `j` / `↓`、`k` / `↑` | 列表移动 |
| `Enter` | 打开（会话详情 / 发现跳转） |
| `Esc` | 返回 |
| `r` | 刷新（增量重读变化存档） |
| `c` | 复制 Session ID（会话详情） |
| `?` | 快捷键帮助 |
| `q` | 退出 |

快捷键遵循 dsh-tui 习惯（`?` 帮助、`q` 退出、列表导航），不与 DSH 核心快捷键冲突。

## 数据架构：DeepTrace Core 同源

```
DeepTrace Core（dsh-whale-report/core —— 与 Web 版同一实现）
       │
 ┌─────┼─────────┐
 │     │         │
Web   TUI      Export
```

- stats / insights / tool-health / collaboration / pricing / period 语义全部来自 [`dsh-whale-report/core`](https://github.com/SenmuuuuW/dsh-whale-report)（`github:SenmuuuuW/dsh-whale-report` 依赖，Web 与 TUI 共用一份实现，**不复制两套业务逻辑**）；
- 唯一入口：`src/core/index.ts`，未来拆 `@deeptrace/core` 只需改这一个文件；
- 鲸鱼娘表情（`whaleMood`）、鲸评文案（`buildWhaleNote`）与 Web 同一触发规则、同一模板。

## 性能

| 场景 | 耗时 |
| --- | --- |
| 首次打开（冷启动，97 存档全量扫描） | ~4-6s（原生 zstd，进度条展示） |
| 再次打开（命中持久化分桶缓存） | **~1s** |
| 刷新（只重读变化存档） | 增量 |

- **原生 zstd**（`node:zlib.zstdDecompressSync`，Node ≥23）替代 WASM 解压：43s → 3.8s；旧 Node 自动回退 fzstd；
- **持久化分桶缓存**：`$DSH_HOME/deeptrace-cache/`（复用 Web 版 `session_index` 的 10 分钟分桶方案，指纹 mtime+size 匹配，只读派生视图）；
- chunk 类事件（assistant/chunk、reasoning-chunks 等，占总行数 85%）解析前预过滤；
- 刷新手动 `r` 或 `--watch N` 低频，绝不轮询。

## 隐私 / 只读

- **只读**：绝不改写任何会话文件；
- 不自动执行任何修复 / shell / 配置修改；
- Secret Scan 只报标签与次数，**不打印原文**；危险命令只存首行；
- 分桶缓存是派生视图（与 Web 版存储域 `session_index` 同性质），不改变任何会话数据；
- 复制只涉及 Session ID，绝不复制 key / secret。

## 安装与启动

需要 Node `^22.19 || >=24`（推荐 ≥23，原生 zstd）。

```sh
git clone https://github.com/SenmuuuuW/dsh-deeptrace-tui
cd dsh-deeptrace-tui
pnpm install && pnpm build

# 直接跑（也可 alias 成 dsh trace）
node bin/deeptrace.mjs
# 或全局链接
npm link            # 提供 deeptrace / dsh-trace 两个命令
dsh-trace
```

无头渲染（CI / 截图 / 文档）：

```sh
deeptrace --render overview --no-color --width 100 --height 40
deeptrace --render trace --preset daily
```

选项：`--preset weekly|daily|24h|monthly|yearly`（默认 weekly）· `--watch N` 低频自动刷新 · `--no-color` · `--dsh-home <path>`。

## 开发

```sh
pnpm typecheck
pnpm test       # 单元 + 视图模型 + 渲染快照 + 真实存档集成（无存档自动跳过）
pnpm build
```

## 与 Web 版的关系

| | Web 版 DeepTrace | DeepTrace TUI |
| --- | --- | --- |
| 数据 | 同一引擎 / 同一周期语义 | 同一引擎 / 同一周期语义 |
| 入口 | dsh web 面板 / 对话工具 | 终端内 `deeptrace` |
| 导出 | PDF / PNG / HTML | 无头渲染帧（`--render`） |
| 会话跳转 | 复制 Session ID | 复制 Session ID（同等待官方机制） |

## Roadmap（下一阶段）

- [ ] Provider Balance（core 已就绪，作为 instrumentation 一行展示）
- [ ] 正式像素鲸鱼娘素材（见 [docs/WHALE_ASSET_SPEC.md](docs/WHALE_ASSET_SPEC.md)，当前为占位 sprite）
- [ ] dsh-tui 内集成入口（DSH TUI 中打开 DeepTrace）
- [ ] 周期切换快捷键、`@deeptrace/core` 独立包
- [ ] `--render` 输出补全（PNG 终端截图）

## License

MIT — 实现自研；聚合 / 洞察 / 计价 / 协作 / 周期语义来自 `dsh-whale-report`（MIT，同作者），未复制外部项目代码。

---

<p align="center"><em>DeepTrace TUI — SEE → NOTICE → TRACE，不离开终端。</em></p>
