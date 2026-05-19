# GlyphTerm

[![GitHub](https://img.shields.io/github/stars/cndingbo/glyphterm?style=social)](https://github.com/cndingbo/glyphterm)

**GlyphTerm**（字形终端）是一款开源、AI 友好的现代终端与工作区。**Unicode / CJK / 多语言** 从设计之初即为一等公民——字符宽度计算、网格布局、UI 国际化全链路可验证、可配置。

> 终端里常见的中文显示异常，多数是 **显示层宽度与字体回退** 问题，而不是 UTF-8 数据损坏。GlyphTerm 用独立的宽度引擎 + 单元格网格渲染，避免混排（CJK + Emoji + ANSI + 制表符）时的列错位。

## 为什么叫 GlyphTerm

| 维度 | 含义 |
|------|------|
| **Glyph** | 强调「字形」正确显示：码点、宽度、连字、回退字体 |
| **Term** | 终端 + 工作区（分屏、远程、预览、编辑） |
| 中文名 | **字形终端** — 每个字符在网格里占几列，由引擎说了算，不靠 UI 猜 |

## 核心能力（规划）

| 能力 | 说明 |
|------|------|
| 分屏 / 工作区 | Block + Tile 布局，终端、编辑、预览可组合 |
| 远程连接 | SSH、远程文件浏览与编辑 |
| 内联预览 | Markdown、图片、CSV 等 |
| 内嵌浏览器 | 文档、仪表盘、内网应用 |
| AI / Widget | 可选模块，本地或自托管 API |
| **CJK / 混排** | 独立宽度引擎，宽字符与混排可回归测试 |
| **UI 多语言** | 中 / 英 / 日界面 |
| 本地优先 | 数据默认留在本机，无需账号 |

## 技术栈（建议）

```
┌─────────────────────────────────────────────────────────┐
│  UI Shell: Tauri 2 (Rust) + React/TypeScript            │
│  Blocks: Terminal · Editor · Preview · Web · AI         │
├─────────────────────────────────────────────────────────┤
│  Host: Rust (tokio) — SSH, FS, RPC, session             │
├─────────────────────────────────────────────────────────┤
│  Terminal Core: glyphgrid + glyphwidth (Rust)           │
│  VT parser · PTY · scrollback · selection               │
├─────────────────────────────────────────────────────────┤
│  Render: GPU cells (wgpu) or platform text (Phase 1)    │
└─────────────────────────────────────────────────────────┘
```

宽度与网格在 **Rust 核心** 中统一实现，UI 层只负责展示，不参与列宽计算。

## 仓库结构

```
glyphterm/
├── apps/glyphterm-cli/      # 本地 PTY 终端（开发版）
├── crates/
│   ├── glyphwidth/          # Unicode 显示宽度引擎
│   ├── glyphgrid/           # 终端单元格网格
│   └── glyphvt/             # VT 解析器
├── docs/
│   ├── ARCHITECTURE.md
│   └── CJK-RENDERING.md
└── .github/workflows/ci.yml
```

## 快速开始（开发）

```bash
# 需要 Rust 1.85+（https://rustup.rs）
cd glyphterm
cargo test --workspace

# 本地终端（PTY + 网格渲染，开发用 CLI）
cargo run -p glyphterm-cli
# 退出：Ctrl+C

# 桌面应用（Tauri 2，推荐）
cd apps/glyphterm-desktop
npm install
npm run tauri dev
```

### 仓库结构（当前）

| 路径 | 说明 |
|------|------|
| `crates/glyphwidth` | Unicode 列宽引擎 + 黄金测试 |
| `crates/glyphgrid` | 终端单元格网格（宽字符、换行、擦除） |
| `crates/glyphvt` | VT/xterm 子集解析器 |
| `crates/glyphterm-core` | PTY 会话与 UI 帧序列化 |
| `apps/glyphterm-cli` | 终端 CLI（crossterm） |
| `apps/glyphterm-desktop` | **Tauri 2 桌面应用（M2）** |

## 许可证

[Apache-2.0](./LICENSE)

## 路线图

1. **M0** — `glyphwidth` + 黄金测试集 ✅  
2. **M1** — `glyphgrid` + `glyphvt` + `glyphterm-cli` ✅  
3. **M2** — Tauri 桌面应用 + `glyphterm-core` + 滚动缓冲区 ✅  
4. **M2.1** — 256/真彩色、选区复制、字体提示 ✅  
5. **M2.2** — GPU 渲染、性能优化  
6. **M3** — 分屏 / Tab / SSH  
7. **M4** — 文件预览、远程编辑、AI 块  

详见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 与 [docs/CJK-RENDERING.md](./docs/CJK-RENDERING.md)。
