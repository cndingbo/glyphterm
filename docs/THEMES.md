# GlyphTerm 主题系统

桌面端通过 **主题预设 + CSS 变量 + 前端色彩映射** 统一控制界面与终端配色，避免纯黑底 + 高饱和青色的刺眼组合。

## 内置主题

| ID | 名称 | 说明 |
|----|------|------|
| `glyph` | 字形 | 品牌默认：暖墨底 + 青绿点缀 |
| `nord` | 北欧霜 | 低对比冷色，长时间编码友好 |
| `tokyo-night` | 东京夜 | 流行深色开发主题 |
| `dracula` | 德古拉 | 鲜明但平衡的紫调 |
| `solarized-dark` | 日光暗 | 经典 Solarized 深色 |
| `paper` | 纸本 | 浅色日间阅读 |
| `mono` | 单色 | 高对比黑白基调 |

在标题栏 **主题** 下拉框中切换；选择会写入 `localStorage`（键：`glyphterm-theme-id`）。

## 架构

```
presets.ts     → TerminalTheme（ui / terminal / font / render）
manager.ts     → applyTheme() 设置 CSS 变量 + 当前主题
colors.ts      → createColorMapper() 将 Rust 默认笔色与引擎 ANSI 映射到主题盘
terminal.ts    → Canvas 绘制：背景、斑马纹、选区、光标、单元格
styles.css     → 使用 var(--*) 的壳层 UI
```

### 色彩映射

后端 `glyphgrid` 默认前景/背景为 `0xF5F3EE` / `0x08090B`；`glyphvt` 使用标准 16 色 ANSI。前端 `createColorMapper` 将这些 RGB 值替换为当前主题的 `terminal.ansi` / `ansiBright`，并对接近的 truecolor 做最近邻匹配，从而柔化 `ls`、zsh 提示符等的高亮青色。

### 渲染细节

- **行条纹**：`render.rowStripeAlpha` 控制交替行淡色（0 为关闭）
- **光标**：半透明块，颜色来自 `terminal.cursor`
- **字体**：默认 `Sarasa Mono SC` 等 CJK 等宽栈

## 扩展自定义主题

1. 在 `apps/glyphterm-desktop/src/themes/presets.ts` 增加 `TerminalTheme` 对象
2. 加入 `THEME_PRESETS` 数组
3. 重启或热重载桌面应用

后续可支持 JSON 导入/导出（`TerminalTheme` 已是纯数据结构）。

## 相关文件

- `apps/glyphterm-desktop/src/themes/`
- `apps/glyphterm-desktop/src/terminal.ts`
- `apps/glyphterm-desktop/src/styles.css`
