# GlyphTerm

[![CI](https://github.com/cndingbo/glyphterm/actions/workflows/ci.yml/badge.svg)](https://github.com/cndingbo/glyphterm/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.85%2B-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)

**GlyphTerm**（字形终端）是一款开源、**AI 友好**的现代终端与工作区。**Unicode / CJK / 多语言** 从设计之初即为一等公民——字符宽度、网格布局、主题与 UI 全链路可验证、可配置。

> 终端里常见的中文错位，多数是 **显示层列宽与字体回退** 问题，而不是 UTF-8 损坏。GlyphTerm 用独立的 `glyphwidth` 引擎 + `glyphgrid` 单元格网格，避免 CJK、Emoji、ANSI、制表符混排时的列错位。

[架构](./docs/ARCHITECTURE.md) · [工作区](./docs/WORKSPACE.md) · [CJK 渲染](./docs/CJK-RENDERING.md) · [开发环境](./docs/DEV_SETUP.md) · [主题](./docs/THEMES.md) · [许可证](./docs/LICENSING.md) · [贡献](./CONTRIBUTING.md)

## 亮点

| 维度 | 说明 |
|------|------|
| **CJK-first** | UAX #11 列宽策略 + 黄金回归测试 |
| **Rust 核心** | PTY / VT / 网格与 UI 解耦，可复用 crate |
| **桌面应用** | Tauri 2 + Canvas，多标签本地与 SSH |
| **主题系统** | 7 套预设（字形 / Nord / Tokyo Night 等），持久化到本地 |
| **本地优先** | 会话与数据默认留在本机，无需账号 |
| **开源许可** | [Apache-2.0](./LICENSE) — 企业友好、含专利授权 |

## 截图与主题

标题栏 **主题** 下拉可切换配色；终端 ANSI / 真彩色会映射到当前主题盘，降低刺眼的高饱和色。

详见 [docs/THEMES.md](./docs/THEMES.md)。

## 为什么叫 GlyphTerm

| 维度 | 含义 |
|------|------|
| **Glyph** | 强调「字形」正确显示：码点、宽度、连字、回退字体 |
| **Term** | 终端 + 工作区（分屏、远程、预览、编辑） |
| 中文名 | **字形终端** — 每个字符在网格里占几列，由引擎说了算 |

## 当前能力

| 能力 | 状态 |
|------|------|
| Unicode 列宽引擎 + 黄金测试 | ✅ M0 |
| 单元格网格 + VT 解析 + CLI | ✅ M1 |
| Tauri 桌面 + 滚动缓冲 + 选区复制 | ✅ M2 / M2.1 |
| 多标签 + SSH + OSC 过滤 | ✅ M3.1 |
| 可定制主题 + UI 变量 | ✅ |
| **Wave 工作区** + Monaco 编辑器 | ✅ M3.2 α |
| 动态分屏 / LSP / AI 块 | 🔜 M3.3+ |
| 主机配置、GPU 渲染 | 🔜 |

## 技术栈

```
┌─────────────────────────────────────────────────────────┐
│  UI: Tauri 2 + TypeScript (Canvas 终端视图)              │
├─────────────────────────────────────────────────────────┤
│  Host: glyphterm-core — PTY、SSH、多标签会话             │
├─────────────────────────────────────────────────────────┤
│  Core: glyphvt → glyphgrid ← glyphwidth                 │
└─────────────────────────────────────────────────────────┘
```

宽度与网格在 **Rust** 中统一实现；前端只负责主题映射与绘制，不参与列宽计算。详见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)。

## 快速开始

```bash
# Rust 1.85+ — https://rustup.rs
git clone https://github.com/cndingbo/glyphterm.git
cd glyphterm
cargo test --workspace

# 开发 CLI
cargo run -p glyphterm-cli

# 桌面应用（推荐）
cd apps/glyphterm-desktop
npm install
npm run tauri dev
```

**快捷键**：⌘T 新本地标签 · ⌘⇧N SSH · ⌘C 复制选区 · ⌘V 粘贴 · 编辑器内 ⌘S 保存

Default UI is **English**; switch **Language** in the title bar (简体中文 / English). Workspace mode starts with terminal + Monaco side by side; use **Layout → Classic** for the single-pane terminal.

SSH 需系统 `libssh2`（macOS：`brew install libssh2`），见 [docs/SSH.md](./docs/SSH.md)。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `crates/glyphwidth` | Unicode 列宽引擎 + 黄金测试 |
| `crates/glyphgrid` | 终端单元格网格 |
| `crates/glyphvt` | VT/xterm 解析（含 OSC 过滤） |
| `crates/glyphterm-core` | PTY / SSH 会话与帧序列化 |
| `apps/glyphterm-cli` | Crossterm 开发 CLI |
| `apps/glyphterm-desktop` | Tauri 2 桌面应用 |
| `apps/glyphterm-desktop/src/themes/` | 主题预设与色彩映射 |
| `docs/` | 架构、CJK、主题、CI、Runner 文档 |

## 路线图

1. **M0–M1** — 宽度引擎、网格、VT、CLI ✅  
2. **M2–M2.1** — 桌面、真彩色、选区、字体提示 ✅  
3. **M3.1** — 多标签、SSH ✅  
4. **M3.2** — 分屏、主机配置持久化  
5. **M4** — 预览、远程编辑、AI 块  

## 参与与合规

- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)  
- 行为准则：[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)  
- 安全披露：[SECURITY.md](./SECURITY.md)  
- **许可证**：[Apache-2.0](./LICENSE) — 选型理由见 [docs/LICENSING.md](./docs/LICENSING.md)  

## 社区

- **Issues**：[报告 Bug / 提议功能](https://github.com/cndingbo/glyphterm/issues/new/choose)  
- **Discussions**：欢迎在 GitHub Discussions 交流用法与路线图（若已开启）  

---

<p align="center">
  <sub>GlyphTerm — 让每个字形落在正确的格子里。</sub>
</p>
