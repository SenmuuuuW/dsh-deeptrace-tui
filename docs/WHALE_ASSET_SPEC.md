# 鲸鱼娘素材规格（WHALE ASSET SPEC）

> DeepTrace TUI 的鲸鱼娘是**全像素角色**（不是 🐋 emoji，也不是 ASCII 棒人）。
> 内置 6 张 24×36 像素 chibi 鲸鱼娘（`assets/whale/*.json`），由
> `scripts/make-sprites.mjs` 生成：同一角色、只换表情/动作。
> 本规格说明素材设计、交付格式与验收——**换素材不需要改代码**。

## 0. 角色设计（v2，chibi Q 版）

| 设定 | 值 |
| --- | --- |
| 头身比 | 大头 chibi（头 20px : 身体 7px） |
| 头发 | 蓝黑 `#1A2854` + 浅蓝高光 `#4D6BFE` / `#7B9BE8`（侧发 + 刘海分叉） |
| 眼睛 | 大眼睛 3×4，白色双高光；表情差异主要在眼睛/眉毛/嘴 |
| 鲸鱼元素 | 鲸鱼帽（帽身 `#4D6BFE` + 浅蓝肚 + 背鳍 + 后翘尾 + 小眼睛）、头两侧小鳍边饰 |
| 轮廓 | 圆润、无方头、无硬描边；靠配色分层 |
| 气质 | 可爱、聪明、安静，"观察员" |

## 1. 需要几张 / 什么状态

**6 张**（文件名固定）：

| 文件 | 状态 | 与 core 规则的关系 | 出现场景 |
| --- | --- | --- | --- |
| `idle.json` | 待机：大眼 + 平静小嘴 + 腮红 | TUI 专用 UI 状态 | 数据未加载完成前 |
| `happy.json` | 开心：∩ 闭眼 + ω 嘴 + 帽顶喷水 | `whaleMood() === "happy"` | 数据干净 / 常规周期 |
| `thinking.json` | 思考：上视眼 + 小 o 嘴 + 「?」气泡 | TUI 专用 UI 状态 | 加载 / 刷新中 |
| `warning.json` | 提醒：平眉 + 平嘴 + 汗珠（无腮红） | `whaleMood() === "dazed"`（无语态） | 重试风暴等异常 |
| `angry.json` | 生气：外高内低斜眉 + 撇嘴（仍可爱） | `whaleMood() === "angry"`（仅红级危险操作） | 致命级操作 |
| `sleepy.json` | 困困：闭眼线 + O 嘴 + z z z | `whaleMood() === "sleepy"`（深夜活跃） | 凌晨活跃 ≥15% |

表情阈值**必须**继续由 `dsh-whale-report/core` 的 `whaleMood()` 决定（同一套规则），
sprite 只负责"长什么样"。

## 2. 终端渲染方式

- 渲染器：`src/render/whale/render.ts` —— **Unicode half-block**（▀/▄），
  每个终端格上下半格各一个颜色（truecolor / 256 降级由终端处理）；
- no-color：按亮度映射 ░▒▓█ 单色剪影；
- 终端单元纵横比约 1:2（宽:高），所以**像素网格 2:3（宽:高）**：
  **24×36 像素 ≈ 24×18 终端格** ≈ 视觉正方形脸；
- 小终端（高度 <26 行）自动只显示头部（上半 sprite）。

## 3. 交付格式（二选一）

### 方式 A：直接给 JSON（推荐，无需工具）

```json
{
  "name": "happy",
  "w": 24,
  "h": 36,
  "palette": { "h": "#1A2854", "H": "#4D6BFE", "b": "#4D6BFE", "l": "#7B9BE8", "f": "#E8EDFF", "s": "#FFB4C8", "e": "#101828", "w": "#FFFFFF", "t": "#6FE3D5" },
  "grid": [
    "........................",
    "...........f............",
    "...........llbb.........",
    "... (h 行字符串，每行必须恰好 w 个字符) ...",
    "........................"
  ]
}
```

- `grid` 行数必须 = `h`，每行字符数必须 = `w`；
- 字符只能是 palette 键或 `.`（透明）；未知键会直接报错（有校验）；
- 颜色控制在 **≤10 色**（含透明），保证 no-color 剪影可读；
- 同一角色只换表情：建议以 `idle` 为基础，只改眼睛/眉毛/嘴/腮红/小元素。

### 方式 B：PNG → 转换

- 格式：**透明背景 PNG**，24×36（严格像素画，不要插值）；
- palette 限制：≤10 色（含透明），主色沿用 #4D6BFE；
- 提供转换脚本 `scripts/png-to-sprite.mjs`（Phase 2 交付，输入 PNG 输出 JSON）。

## 4. 替换步骤

```sh
# 1. 把新素材放入 assets/whale/<name>.json（覆盖现有文件）
# 2. 本地验证
node bin/deeptrace.mjs --render overview --no-color
pnpm test          # renderer 校验（validateSprite）会自动检查全部 6 个 sprite
```

不需要改任何代码：loader 只按文件名加载。

## 5. 素材生成与工具

- `scripts/make-sprites.mjs`：正式素材生成器（v2 设计源，修改后重跑即可再生成 6 张）；
- `scripts/whale-debug.mts`：结构化字符图调试（`pnpm exec tsx scripts/whale-debug.mts`）；
- `scripts/whale-preview.mts`：终端 half-block 预览（`pnpm exec tsx scripts/whale-preview.mts`）；
- `scripts/sprite-png.mjs`：JSON → PNG 大图（×10 + 棋盘透明底，输出 /tmp/whale-art/）。

## 6. 验收标准

1. 6 个状态一眼可辨（happy ∩ 眼 / thinking 上视 / warning 平眉 / angry 斜眉 / sleepy 闭眼）；
2. 24×18 终端格显示下轮廓清晰、无锯齿噪点；
3. no-color 模式下剪影可辨识（靠明暗不是靠颜色）；
4. `pnpm test` 的 `validateSprite` 通过；
5. 同一角色：只换表情/动作，发型、帽子、配色一致。
