# DSH TUI 生态调研结论（2026-08）

> 本文件记录 DeepTrace TUI 立项时的技术调研结论，作为架构决策依据。

## 1. 官方 TUI 机制

- DSH（DeepSeek Harness）**没有独立的 TUI 框架包**；
- 官方终端接入方式是 **DSH Profile + bundle patch**：`dsh --profile <name>` 启动一个
  profile（`$DSH_HOME/profiles/<name>/`），插件包声明 `dsh.bundle.patch`（cordis patch 层）
  即可成为该 profile 的 bundle 层（`dsh plugin --profile <name> add <pkg>`）；
- CLI 没有 `dsh trace` 之类的子命令——"进入终端 App"的正确姿势是 profile/bundle，
  或者独立 bin（如本项目的 `deeptrace` / `dsh-trace`）。

## 2. 渲染栈：Ink（React）

- 社区事实标准与 DSH 侧先例（[dsh-tui — SONAR/ABYSS](https://github.com/SenmuuuuW/dsh-tui)）
  均为 **Ink 5（React 18）+ ink-testing-library**；
- 理由（dsh-tui ADR-002 已论证）：确定性快照测试（ink-testing-library）、
  与 DSH Web 的 React 心智同构、resize 事件、raw-mode 键盘、CJK 宽度处理；
- blessed 停更、纯 ANSI 自研输入解析风险高、Bubble Tea 跨语言——均否决；
- **本项目沿用同一栈**：Ink 5 + React 18 + ink-testing-library 4。

## 3. 键盘习惯

- dsh-tui 习惯：`?` 帮助、`q`/`Ctrl+C` 退出、raw-mode 输入、列表选择器用 `↑/↓`；
- DeepTrace TUI 采用 `j/k/↑/↓` 列表导航 + `1-5` 视图 + `Enter/Esc` + `r` 刷新 +
  `c` 复制 Session ID，与 dsh-tui 输入区（`/` 命令、Tab 补全）无冲突；
- 帮助页固定 `?` 呼出。

## 4. 颜色 / 布局 / resize

- token 化主题（dsh-tui `settings/themes.ts` 同款语义）：DeepSeek Blue #4D6BFE、
  深海 navy、冷灰 muted、signal cyan、warn amber、error red；
- **no-color 回退**：`NO_COLOR` 环境变量（含空值）、`TERM=dumb`、`--no-color` →
  所有颜色 token → undefined，只保留 bold/dim/underline；
- truecolor/256 降级交给终端与 Ink；无头渲染（非 TTY）Ink 自动剥离 ANSI；
- resize：Ink 事件驱动重渲染；winsize 缺失（0×0 伪终端）时钳制最小布局。

## 5. 会话导航（重要：不伪造）

- 官方 **没有**跨应用"打开会话"机制：dsh-tui 的 `/resume` 是 profile 内自实现
  （同进程持有 session 对象），Web 版 DeepTrace 与 TUI 都只能"复制 Session ID"；
- 结论：Phase 1 提供 `c` 复制（pbcopy/wl-copy/xclip），跳转能力等待官方 client API。

## 6. 数据读取两条路

| 路径 | 说明 | 本项目状态 |
| --- | --- | --- |
| 直读 `~/.dsh/sessions/**/session.jsonl.zstd` | 无 profile 依赖，立即可用；官方持久化格式为多帧 zstd（帧头 28 B5 2F FD 切分） | **Phase 1 采用**（report-now.mjs 已验证同一路线） |
| cordis bundle 内 `ctx.sessionQuery` | 与 Web 插件同接缝，需 profile 安装 | 未来（dsh-tui 集成时） |

- 解压性能：WASM fzstd 43s（97 存档）→ `node:zlib.zstdDecompressSync`（Node ≥23）3.8s；
- 缓存：复用 Web 版 `session_index` 思路（10 分钟分桶 + 指纹），TUI 落盘到
  `$DSH_HOME/deeptrace-cache/`，重复打开 ~1s。

## 7. 结论

DeepTrace TUI 不是新造终端框架，而是**沿用 DSH 生态既有 TUI 技术路线**
（Ink/React + 键盘优先 + token 主题 + no-color 回退 + 只读数据接缝），
把 DeepTrace Core（与 Web 同源）带进终端。
