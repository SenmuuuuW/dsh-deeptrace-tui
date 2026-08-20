# 观察员小鲸鱼 mascot 规格（WHALE MASCOT SPEC v4）

> DeepTrace TUI 的 mascot 是**终端原生符号线稿**（terminal-native line-art），
> 不是像素图、不是 🐋 emoji、不是 ASCII 棒人。
> 唯一的真实来源是 `src/render/whale/mascot.ts` —— 没有素材文件、没有生成脚本、
> 没有构建步骤。改外观就是改那一个文件里的字形常量。

## 0. 为什么是线稿而不是像素图

v3 曾用 6 张 16×12 像素 sprite + Unicode half-block 渲染。实测结论是它不适合这个产品：

- 16×12 逻辑像素经 half-block 压成 16 列 × 6 行后，在以文字为主的 TUI 里是
  一整块高饱和色噪点 —— 抢主信息，并且必然在它周围制造大块留白；
- half-block（▀ / ▄）属于 East Asian Ambiguous / Block Elements，
  CJK locale 终端可能按 2 列渲染，宽度不可靠；
- 六张 JSON 素材 + 生成器 + 预览器 + PNG 导出器，为一个装饰件引入了
  完整的资产管线，与"确定性、只读、纯函数"的代码基调不符。

从 web 版继承下来的是**设计语言**而不是像素：正面头像构图、宽间距大眼、
一个字形一种情绪 —— 与 whale-report 的四表情规格（呆萌 / 生气 / 困困 / 无语）
一一对应，两端观感同源。

## 1. 形态契约

```
 ╭───────╮        ← 头顶
─┤ o _ o ├─       ← 胸鳍 + 眼 · 嘴 · 眼
 ╰───────╯        ← 下颌
```

| 项 | 值 |
| --- | --- |
| 尺寸 | **3 行 × 11 列**（`MARK_HEIGHT` / `MARK_WIDTH`） |
| 每行宽度 | `[10, 11, 10]`（`MARK_ROW_WIDTHS`，胸鳍在中行外突一列） |
| 微章尺寸 | 单行 **9 列**（`TICK_WIDTH`） |
| 竖线位置 | 固定第 1 / 9 列 |
| 五官位置 | 固定第 3 / 5 / 7 列 —— 恒在轮廓之内 |

**轮廓在所有状态下完全一致**，状态只改变眼睛字形、嘴字形和颜色。
因此切换状态时 mascot 不跳动、不改变占位、不引起重排。
这些宽度由 `tests/render.test.tsx` 钉死，改字形若破坏宽度会直接测试失败。

## 2. 宽度安全（终端兼容性硬约束）

| 部位 | 字符类 | 理由 |
| --- | --- | --- |
| 外框 | 单线 box-drawing `╭─╮╰╯┤├` | 与 chrome 结构线同一风险档，不额外引入风险 |
| 五官 | **纯 ASCII** `o ^ - . > < _ w ~ ? z` | 任何终端 / locale / ambiguous 设置都恒为 1 格 |

禁用字形：`●`、`‿`、`﹏`、`▀`、`▄` 及一切 East Asian Ambiguous / Wide 字符。

`ascii=true`（`--ascii`，或 `TERM` 为 `dumb` / `linux` / 未设置时自动降级）
整只降级为纯 ASCII，供缺字形终端使用：

```
 .-------.
-| o _ o |-
 '-------'
```

## 3. 六个状态

状态阈值**必须**继续由 `dsh-whale-report/core` 的 `whaleMood()` 决定，
`mascot.ts` 只负责"长什么样"。映射表是 `MOOD_TO_STATE` / `stateForMood()`。

| 状态 | 眼 L | 眼 R | 嘴 | 中文状态词 | tone | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| `idle` | `o` | `o` | `_` | 待机 | brand | TUI 自身 UI 状态（数据未加载） |
| `happy` | `^` | `^` | `w` | 一切顺利 | signal | `whaleMood() === "happy"` |
| `thinking` | `o` | `-` | `?` | 解析中 | brand | TUI 自身 UI 状态（加载 / 刷新） |
| `warning` | `.` | `.` | `~` | 有需要留意 | warn | `whaleMood() === "dazed"`（无语态） |
| `angry` | `>` | `<` | `^` | 有危险操作 | error | `whaleMood() === "angry"`（仅红级危险操作） |
| `sleepy` | `-` | `-` | `z` | 夜间活跃 | muted | `whaleMood() === "sleepy"`（深夜活跃） |

## 4. 颜色语义

颜色**不是**唯一的状态通道 —— 每个状态都带中文状态词，
无色终端（`--no-color`）里颜色失效而状态词仍在。

线稿分三种角色，由 `src/render/whale/Whale.tsx` 的 `colorFor()` 解析成主题 token：

| 角色 | 含义 | 取色规则 |
| --- | --- | --- |
| `body` | 外框轮廓 | tone 主色 |
| `accent` | 胸鳍 | brand 档用中性 `userAccent`，其余跟随 tone |
| `face` | 五官 | brand / muted 档用中性色；warn / error / signal 档跟随 tone |

即"情绪落在五官上，而不是把整只染成警示色"。

## 5. 尺寸档位（谁来决定显示哪种）

由 `src/render/geometry.ts` 的 `layout.mascot` 决定，不在组件里判断：

| 档位 | 触发条件 | 渲染 |
| --- | --- | --- |
| `mark` | 常规 / 高终端 | 3 行线稿 + 中文状态词（`<WhaleMark />`） |
| `tick` | 矮终端 | 单行微章 `─┤ o _ o ├─ 待机`（`<WhaleTick />`） |
| `none` | `bodyHeight < 16` | 不渲染 —— 行数要留给正事 |

原则：**装饰 + 状态提示，不做主角。** 线稿用与 UI 结构线同一套笔画、
与文本同一视觉重量；空间不够时 mascot 先让位，内容不让位。

## 6. 修改方式

改 `src/render/whale/mascot.ts` 里的 `STATES`（五官字形 / 状态词 / tone）
或 `BOX` / `ASCII`（轮廓字形）。不需要动素材、不需要跑生成器。

```sh
# 终端预览六个状态（含 ascii 与 no-color 对照）
pnpm exec tsx scripts/mascot-preview.mts

# 宽度契约与降级校验
pnpm test
```

## 7. 验收标准

1. 3 行 × 11 列，每行宽度恒为 `[10, 11, 10]`；微章恒 9 列；
2. 六个状态轮廓完全一致，仅五官字形与颜色不同 —— 切换不跳动；
3. 五官全部为 ASCII；外框只用单线 box-drawing；无 ambiguous / wide 字符；
4. `ascii=true` 时整只为纯 ASCII 且宽度不变；
5. `--no-color` 下靠中文状态词仍能判断状态（不依赖颜色）；
6. 矮终端降级为 tick、`bodyHeight < 16` 时消失，不挤压内容；
7. `pnpm test` 的宽度契约与字符集测试通过。
