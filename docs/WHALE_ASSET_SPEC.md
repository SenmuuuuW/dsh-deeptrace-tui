# 鲸鱼娘素材规格（WHALE ASSET SPEC）

> DeepTrace TUI 的鲸鱼娘是**全像素角色**（不是 🐋 emoji，也不是 ASCII 棒人）。
> 当前内置 6 个 16×24 像素占位 sprite（`assets/whale/*.json`，程序生成、沿用 Web 版
> 鲸鱼娘世界观：圆润鲸鱼脸、DeepSeek Blue #4D6BFE 主体、浅蓝高光、浅色脸、腮红）。
> 本规格说明正式素材的交付格式与要求——**换素材不需要改代码**。

## 1. 需要几张 / 什么状态

**6 张**（文件名固定）：

| 文件 | 状态 | 与 core 规则的关系 | 出现场景 |
| --- | --- | --- | --- |
| `idle.json` | 待机 | TUI 专用 UI 状态 | 数据未加载完成前 |
| `happy.json` | 开心 | `whaleMood() === "happy"` | 数据干净 / 常规周期 |
| `thinking.json` | 思考 | TUI 专用 UI 状态 | 加载 / 刷新中 |
| `warning.json` | 无语/警示 | `whaleMood() === "dazed"`（无语态） | 重试风暴等异常 |
| `angry.json` | 生气 | `whaleMood() === "angry"`（仅红级危险操作） | 致命级操作 |
| `sleepy.json` | 困困 | `whaleMood() === "sleepy"`（深夜活跃） | 凌晨活跃 ≥15% |

表情阈值**必须**继续由 `dsh-whale-report/core` 的 `whaleMood()` 决定（同一套规则），
sprite 只负责"长什么样"。

## 2. 终端渲染方式

- 渲染器：`src/render/whale/render.ts` —— **Unicode half-block**（▀/▄），
  每个终端格上下半格各一个颜色（truecolor / 256 降级由终端处理）；
- no-color：按亮度映射 ░▒▓█ 单色剪影；
- 终端单元纵横比约 1:2（宽:高），所以**像素网格建议 2:3（宽:高）**，
  16×24 像素 ≈ 16×12 终端格 ≈ 视觉正方形脸；
- 建议源图：**32×48 像素**（显示 32×24 终端格）或 **24×36**（显示 24×18 格）。

## 3. 交付格式（二选一）

### 方式 A：直接给 JSON（推荐，无需工具）

```json
{
  "name": "happy",
  "w": 16,
  "h": 24,
  "palette": { "d": "#0A1220", "b": "#4D6BFE", "l": "#7B9BE8", "f": "#DBE4FF", "r": "#FFB4C8", "e": "#101828", "w": "#FFFFFF", "t": "#6FE3D5" },
  "grid": [
    "................",
    "......llll......",
    "...llbbbbbbll...",
    "... (w 行字符串，每行必须恰好 w 个字符) ...",
    "................"
  ]
}
```

- `grid` 行数必须 = `h`，每行字符数必须 = `w`；
- 字符只能是 palette 键或 `.`（透明）；未知键会直接报错（有校验）；
- 颜色建议控制在 **≤8 色**（含透明），保证 no-color 剪影可读。

### 方式 B：PNG → 转换

- 格式：**透明背景 PNG**，32×48 或 24×36（严格像素画，不要插值）；
- palette 限制：≤8 色（含透明），主色沿用 #4D6BFE；
- 提供转换脚本 `scripts/png-to-sprite.mjs`（Phase 2 交付，输入 PNG 输出 JSON）。

## 4. 替换步骤

```sh
# 1. 把新素材放入 assets/whale/<name>.json（覆盖占位文件）
# 2. 本地验证
node bin/deeptrace.mjs --render overview --no-color
pnpm test          # renderer 校验（validateSprite）会自动检查全部 6 个 sprite
```

不需要改任何代码：loader 只按文件名加载。

## 5. 占位素材说明

- 当前 6 个 JSON 由 `scripts/make-sprites.mjs` 生成（开发工具），人设与 Web 版素材
  （assets/whale/*.svg：蓝白卡通、圆脸、腮红）同一世界观，仅作渲染链路占位；
- 换正式素材后建议删除该生成脚本（或保留用于调色板参考）。

## 6. 验收标准

1. 6 个状态一眼可辨（尤其 happy/angry/sleepy/warning 的眼睛与嘴差异）；
2. 32×24 格显示下轮廓清晰、无锯齿噪点；
3. no-color 模式下剪影可辨识（靠明暗不是靠颜色）；
4. `pnpm test` 的 `validateSprite` 通过。
