# GlyphTerm

[![GitHub](https://img.shields.io/github/stars/cndingbo/glyphterm?style=social)](https://github.com/cndingbo/glyphterm)

**GlyphTerm**（字形终端）是一款开源、AI 友好的现代终端与工作区，功能定位对标 [Wave Terminal](https://www.waveterm.dev/)，但在 **Unicode / CJK / 多语言** 上作为一等公民设计——从字符宽度计算、网格布局到 UI 国际化，全链路可验证、可配置。

> 你在 Wave 里看到的中文「乱码」，多数是 **显示层宽度与字体回退** 问题，而不是 UTF-8 数据损坏。GlyphTerm 用独立的宽度引擎 + 单元格网格渲染，从根上避免混排（CJK + Emoji + ANSI + 制表符）时的列错位。

## 为什么叫 GlyphTerm

| 维度 | 含义 |
|------|------|
| **Glyph** | 强调「字形」正确显示：码点、宽度、连字、回退字体 |
| **Term** | 终端 + 工作区（分屏、远程、预览、编辑） |
| 中文名 | **字形终端** — 每个字符在网格里占几列，由引擎说了算，不靠 UI 猜 |

备选名（若你更喜欢 Wave 隐喻）：**PolyWave**（多语波浪）、**UniTide**（Unicode 潮汐）、**KaiShell**（开壳，开源之意）。

## 与 Wave Terminal 的功能对标

| 能力 | Wave | GlyphTerm（目标） |
|------|------|-------------------|
| 分屏 / 工作区布局 | ✅ | ✅ Block + Tile 模型 |
| SSH / 远程机器 | ✅ | ✅ |
| 远程文件浏览与编辑 | ✅ | ✅ |
| 内联文件预览（MD/图/CSV…） | ✅ | ✅ |
| 内嵌浏览器 | ✅ | ✅ |
| AI / Widget 块 | ✅ | ✅ 可选模块 |
| **CJK 宽字符 / 混排** | ⚠️ 已知问题 | ✅ **核心差异化** |
| **UI 多语言** | 英文为主 | ✅ 中/英/日 首发 |
| 本地优先、无需账号 | ✅ | ✅ |

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

Wave 使用 Go + Electron + xterm.js；GlyphTerm 将 **宽度与网格留在 Rust**，避免 JS 层与 xterm 对 East Asian Width 理解不一致。

## 仓库结构

```
glyphterm/
├── apps/glyphterm-host/     # 桌面宿主（Tauri，后续）
├── crates/
│   ├── glyphwidth/          # Unicode 显示宽度引擎（可单独发布）
│   └── glyphgrid/           # 终端单元格网格
├── docs/
│   ├── ARCHITECTURE.md
│   └── CJK-RENDERING.md
└── scripts/
```

## 快速开始（开发）

```bash
# 需要 Rust 1.78+
cd glyphterm
cargo test --workspace
```

## 许可证

Apache-2.0 — 与 Wave 相同，便于企业采用与贡献。

## 路线图

1. **M0** — `glyphwidth` + 黄金测试集（CJK/Emoji/组合符）✅ 进行中  
2. **M1** — `glyphgrid` + VT100 子集 + 本地 PTY  
3. **M2** — Tauri 最小可运行终端窗口  
4. **M3** — 分屏 / Tab / SSH  
5. **M4** — 文件预览、远程编辑、AI 块  

详见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 与 [docs/CJK-RENDERING.md](./docs/CJK-RENDERING.md)。
