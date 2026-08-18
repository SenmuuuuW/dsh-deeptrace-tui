<p align="center">
  <code><pre>
     ████  ▓▓▒
 ████▓▓▓▓██▓▓▒
▒█▓██▓██▓██▓█
 ███▒▒▒▒▒▒███
    ██████
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
深迹 DEEPTRACE                                                                                ● LIVE
周报 · W34
----------------------------------------------------------------------------------------------------
¥9.26 ▼ 89%      97                150.32M          99.6%                  ▒▒▒
成本             会话              Tokens           Cache                  ████  ▓▓▒
                                                                       ████▓▓▓▓██▓▓▒
需要关注                                                              ▒█▓██▓██▓██▓█
01  TOOL HEALTH                                                        ███▒▒██▒▒███
    工具 edit 失败 62 次，失败率 10%                                      ██████
02  RETRY                                                            鲸评  [Enter]
    检测到 7 次重试风暴                                              （摆摆尾巴）嗨，我来啦。
03  RISK                                                             呜哇——这期的危险操作，有点多哦
    3 条需留意操作                                                   。

趋势
成本  ▁▁▁▁▁██▂  ¥9.26
会话  ▁▁▁▁▂███  97
Cache ▁▁▁▁████  99.6%
夜间  ▁▁▁▁▁██▅  8%

[1 总览] 2 工具  3 会话  4 协作  5 历史  [?] 帮助                                              09:03
```

数据密度优先：没有卡片堆、没有 Dashboard 方框——像研究终端。

## 工具健康 TOOL HEALTH

```
深迹 DEEPTRACE                                                                                ● LIVE
周报 · W34
----------------------------------------------------------------------------------------------------
工具健康 TOOL HEALTH · 24 个工具 · 449 calls · 17 failed
edit  ATTENTION
90.0%   621 calls   62 failed   66ms
█████████░
FS_NOT_OBSERVED  32   FS_STALE_VERSION  21   FS_EDIT_NOT_FOUND   9

bash              99.6%    3680  15 failed
write             96.6%     414  14 failed
web_search        99.0%     383  4 failed
ask_user_question  88.9%      27  3 failed
structured_output  90.5%      21  2 failed
mc__show_sketch    0.0%       1  1 failed
read              99.8%     570  1 failed
grep             100.0%      89
todo_write       100.0%      75
subagent         100.0%      19
task_output      100.0%      19
list_agents      100.0%      18
glob             100.0%      15
send_message     100.0%      10
read_image       100.0%       4
create_goal      100.0%       3
▼


 1 总览 [2 工具] 3 会话  4 协作  5 历史  [?] 帮助                                              09:03
```
深迹 DEEPTRACE                                                                                      ● LIVE
周报 · W34
----------------------------------------------------------------------------------------------------------------------------------
20 sessions · by cost                       SESSION #01
01 ¥33.14  26 RETRY 7 RISK                  去github dsh-plugin 和dsh topic底下
     去github dsh-plugin 和dsh topic底下
02 ¥13.92  9 RETRY 14 RISK                  Cost     ¥33.14
     你现在位于一个全新的 Git repos         Tokens   573.47M
03 ¥13.47  10 RETRY 1 RISK                  Tools    1423 · turns 125
     我想为 DeepSeek Harness 设计并开       Retry    26 · 7 RISK
04 ¥10.35  14 RETRY                         08-14 09:50 ~ 08-17 18:30
     快帮我手搓一个网站 今天是DSH
05 ¥5.91  3 RETRY 2 RISK                    [c] 复制 Session ID
     你现在要创建一个全新的 DSH
06 ¥4.79  2 RISK
     帮我在GitHub dsh-plugin里找找subag
07 ¥4.31  2 RISK
     你好
08 ¥1.04
     你是 DSH 源码考古员。任务：
09 ¥0.55
     你是社区文化研究员。任务是
10 ¥0.54
     You are doing read-only source
11 ¥0.52
     你是 DSH 源码考古员。任务：
12 ¥0.43
     You are doing read-only source
13 ¥0.40
     You are doing read-only source
14 ¥0.40
     你是 DSH 源码考古员。任务：
15 ¥0.29
     你是品牌研究员。任务是研究
16 ¥0.28  1 RISK
     你是 TUI（终端用户界面）研究
17 ¥0.26
     你是开源生态研究员。任务：
18 ¥0.24
     你是 TUI（终端用户界面）研究
19 ¥0.24
     你是 TUI（终端用户界面）研究
20 ¥0.23
     你是 TUI（终端用户界面）研究

 1 总览  2 工具 [3 会话] 4 协作  5 历史  [?] 帮助                                                   09:03
```

宽屏（≥130 列）左列表右详情常显（profiler 式）；窄屏 Enter 展开会话详情（费用 / Tokens / 重试 / 风险），`c` 复制 Session ID——**不伪造跳转能力**（官方暂无跨应用"打开会话"机制，与 Web 版一致）。
## 小鲸鱼 mascot WHALE

DeepTrace 的观察员 —— **超简洁像素小鲸鱼**（16×12 逻辑像素，终端里只有 16×6 格）：
圆润身体 + 右上翘尾 + 小鳍 + 喷气孔，深蓝 / 中蓝 / 浅蓝 / 白，克制点缀琥珀。
6 个状态与 `dsh-whale-report/core` 的 `whaleMood()` 规则严格同源：

| sprite | 状态 | 关键特征 |
| --- | --- | --- |
| `idle` | 待机 | 平静小嘴、圆眼双高光 |
| `happy` | 开心 | 张嘴笑、头顶小喷泉 |
| `thinking` | 思考 | 上视眼、小圆嘴、「?」气泡 |
| `warning` | 提醒 | 平眉、平嘴、汗滴（无语态，对应 core dazed） |
| `angry` | 生气 | 斜眉、撇嘴、琥珀腮 + 小火苗 |
| `sleepy` | 困困 | 闭眼线、O 嘴、z z |

渲染：Unicode half-block 双色（truecolor / 256 降级）+ no-color 亮度剪影；
低矮装饰不抢内容，小终端自动隐藏 / 只显示头部。素材规格与替换方式见
[docs/WHALE_ASSET_SPEC.md](docs/WHALE_ASSET_SPEC.md)。


## 视图

| # | 视图 | 内容 |
| --- | --- | --- |
| 1 | 总览 | KPI 四指标（成本/会话/Tokens/Cache）+ 需要关注 Top 3（异常优先）+ 趋势 4 行方向感 + 小鲸鱼鲸评 |
| 2 | 工具健康 | 异常工具详情块（ATTENTION）+ 正常工具压缩一行，宽屏双列 |
| 3 | 会话轨迹 | 按费用排序列表 + 风险标记；宽屏左列表右 detail（profiler 式） |
| 4 | 协作复盘 | 单条展示：观察 → 摩擦 → 可以尝试，j/k 切换 |
| 5 | 历史趋势 | 完整趋势在这里：单指标切换（c/s/t/h）+ 比例条形 + 按日活跃 |

## 键盘

| 键 | 动作 |
| --- | --- |
| `1`–`5` | 切换视图 |
| `j` / `↓`、`k` / `↑` | 列表移动 |
| `Enter` | 打开（会话详情 / 需要关注跳转 / 鲸评展开） |
| `Esc` | 返回 |
| `r` | 刷新（增量重读变化存档） |
| `c` | 复制 Session ID（会话详情） |
| `c` / `s` / `t` / `h` | 历史页切换指标（成本 / 会话 / Tokens / Cache） |
| `?` | 快捷键帮助（含 DIAGNOSTICS） |
| `q` | 退出 |

## 响应式

三档宽度 × 三档高度（不做几十个断点）：

| 档位 | 条件 | 行为 |
| --- | --- | --- |
| COMPACT | <90 列 | 单列、隐藏鲸鱼、KPI 四列固定 |
| STANDARD | 90–129 | 主内容 + 右下小鲸鱼 |
| WIDE | ≥130 | 会话轨迹双栏（左列表右 detail）、工具健康正常工具双列 |
| LOW | <26 行 | 需要关注 Top 2、隐藏鲸评、footer 永远可见 |
| NORMAL | 26–39 | — |
| TALL | ≥40 | — |

尺寸实时响应终端 resize（监听 stdout resize 事件，无需重启）；优先级：
显式 `--width/--height` > Ink stdout > process.stdout > 100×40 兜底。

信息层级：KPI（数字）→ 需要关注（异常优先 Top 3）→ 趋势（方向感）→ Trace（深入）。
英文只作小型 metadata（LIVE / TOOL HEALTH / DIAGNOSTICS），中文是主信息。

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
- [ ] dsh-tui 内集成入口（DSH TUI 中打开 DeepTrace）
- [ ] 周期切换快捷键、`@deeptrace/core` 独立包
- [ ] `--render` 输出补全（PNG 终端截图）

## License

MIT — 实现自研；聚合 / 洞察 / 计价 / 协作 / 周期语义来自 `dsh-whale-report`（MIT，同作者），未复制外部项目代码。

---

<p align="center"><em>DeepTrace TUI — SEE → NOTICE → TRACE，不离开终端。</em></p>
