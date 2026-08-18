# 像素小鲸鱼 mascot 素材规格（WHALE ASSET SPEC v3）

> DeepTrace TUI 右侧装饰是**一只 Q 版像素小鲸鱼 mascot**（不是人形、不是 🐋 emoji、
> 不是 ASCII 棒人）。低矮、简洁、可爱，一眼是鲸鱼。
> 6 张 `assets/whale/*.json` 由 `scripts/make-sprites.mjs` 生成：同一只鲸鱼、只换表情/装饰。

## 0. 角色设计（v3，超简洁小鲸鱼）

| 设定 | 值 |
| --- | --- |
| 尺寸 | **16×12 逻辑像素**（终端 half-block 渲染 = 16 列 × 6 行，低矮装饰） |
| 视角 | 正面 3/4：圆身体 + 可见翘尾，识别度优先 |
| 身体 | 圆润椭圆 + 统一深蓝轮廓 + 浅蓝肚皮 |
| 鲸鱼元素 | 右上翘尾（浅蓝叉尖）、左侧小鳍、头顶喷气孔 |
| 装饰 | 喷泉 / ? / 感叹号 / 火苗 / zZ / 汗滴 —— 每状态一个，克制 |
| 气质 | 冷静、深海感、DeepTrace 观察员，但可爱 |

**调色（6 色，含透明共 7 键）**：

| 键 | 色值 | 用途 |
| --- | --- | --- |
| `d` | `#0B1B4D` | 深蓝：轮廓 / 喷气孔 |
| `b` | `#4D6BFE` | 中蓝（DeepSeek Blue）：身体 |
| `l` | `#7B9BE8` | 浅蓝：肚皮 / 尾尖 / 鳍 / 汗滴 |
| `w` | `#FFFFFF` | 白：眼高光 / 喷泉 / zZ / ? |
| `e` | `#101828` | 近黑：眼睛 / 嘴 / 眉毛 |
| `y` | `#F5A623` | 琥珀：感叹号 / 火苗 / 腮（仅 warning / angry，克制） |

## 1. 6 个状态

| 文件 | 状态 | 特征 | 与 core 规则的关系 |
| --- | --- | --- | --- |
| `idle.json` | 待机 | 平静 2px 嘴、圆眼双高光 | TUI 专用 UI 状态（数据未加载） |
| `happy.json` | 开心 | 张嘴笑、头顶小喷泉 | `whaleMood() === "happy"` |
| `thinking.json` | 思考 | 上视眼、小圆嘴、「?」气泡 | TUI 专用 UI 状态（加载/刷新） |
| `warning.json` | 提醒 | 平眉、平嘴、汗滴 | `whaleMood() === "dazed"`（无语态） |
| `angry.json` | 生气 | 外高内低斜眉、撇嘴、琥珀腮 + 小火苗 | `whaleMood() === "angry"`（仅红级危险操作） |
| `sleepy.json` | 困困 | 闭眼线、O 嘴、z z | `whaleMood() === "sleepy"`（深夜活跃） |

表情阈值**必须**继续由 `dsh-whale-report/core` 的 `whaleMood()` 决定（同一套规则），
sprite 只负责"长什么样"。

## 2. 终端渲染方式

- 渲染器：`src/render/whale/render.ts` —— **Unicode half-block**（▀/▄），
  每个终端格上下半格各一个颜色（truecolor / 256 降级由终端处理）；
- no-color：按亮度映射 ░▒▓█ 单色剪影（轮廓/眼睛深、肚皮浅，剪影仍可辨）；
- 尺寸约束：**16×12 到 18×14 之间，总高度不要更高**（TUI 右侧装饰，低矮优先）；
- 极矮终端（内容 <14 行）自动只显示上半（头部）。

## 3. 交付格式（二选一）

### 方式 A：直接给 JSON（推荐，无需工具）

```json
{
  "name": "idle",
  "w": 16,
  "h": 12,
  "palette": { "d": "#0B1B4D", "b": "#4D6BFE", "l": "#7B9BE8", "w": "#FFFFFF", "e": "#101828", "y": "#F5A623" },
  "grid": [
    "................",
    "................",
    ".......dd....ll.",
    "... (h 行字符串，每行必须恰好 w 个字符) ...",
    "................"
  ]
}
```

- `grid` 行数必须 = `h`，每行字符数必须 = `w`；
- 字符只能是 palette 键或 `.`（透明）；未知键会直接报错（有校验）；
- 同一只鲸鱼只换表情：以 `idle` 为基础，只改眼睛/嘴/眉毛/头顶装饰。

### 方式 B：PNG → 转换

- 格式：**透明背景 PNG**，16×12（严格像素画，不要插值）；
- palette 限制：≤7 色（含透明），主色 #4D6BFE；
- 提供转换脚本 `scripts/png-to-sprite.mjs`（Phase 2 交付，输入 PNG 输出 JSON）。

## 4. 替换步骤

```sh
# 1. 把新素材放入 assets/whale/<name>.json（覆盖现有文件）
# 2. 本地验证
node bin/deeptrace.mjs --render overview --no-color
pnpm test          # renderer 校验（validateSprite + 尺寸约束）自动检查全部 6 张
```

不需要改任何代码：loader 只按文件名加载；渲染器对尺寸无硬编码。

## 5. 素材生成与工具

- `scripts/make-sprites.mjs`：mascot 生成器（v3 设计源，修改后重跑即可再生成 6 张）；
- `scripts/whale-debug.mts`：结构化字符图调试（`pnpm exec tsx scripts/whale-debug.mts`）；
- `scripts/whale-preview.mts`：终端 half-block 预览（`pnpm exec tsx scripts/whale-preview.mts`）；
- `scripts/sprite-png.mjs`：JSON → PNG 大图（×10 + 棋盘透明底，输出 /tmp/whale-art/）。

## 6. 验收标准

1. 一眼是鲸鱼：圆身体 + 翘尾 + 喷气孔，无方头、无机器人感；
2. 6 个状态一眼可辨（嘴/眼/眉 + 头顶装饰）；
3. 16×6 终端格显示下轮廓清晰、无锯齿噪点；
4. no-color 模式下剪影可辨识（靠明暗不是靠颜色）；
5. 尺寸 16×12（≤18×14），低矮适合 TUI 右侧装饰；
6. `pnpm test` 的 `validateSprite` 与尺寸约束通过。
