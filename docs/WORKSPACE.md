# Wave 式工作区（M3.2）

GlyphTerm 工作区将终端、编辑器、侧栏组合为可扩展的 **Block** 布局，对标现代终端工作区的交互模型，同时保持 Rust 终端核心不变。

## 当前能力（M3.2 α）

| 能力 | 状态 |
|------|------|
| 工作区标签 T1/T2/T3… | ✅ |
| 左右/上下分屏（终端 + 编辑器） | ✅ |
| 拖拽分屏条调整比例（持久化） | ✅ |
| 命令面板 ⌘K / Ctrl+K | ✅ |
| 快速打开 ⌘P / Ctrl+P（工作区文件搜索） | ✅ |
| 底部状态栏（工作区 / 当前文件 / 分屏） | ✅ |
| 活动栏：terminal / files / sysinfo / process | ✅（后两者占位） |
| 文件树 + 点击打开 | ✅ |
| **Monaco 编辑器**（VS Code 同源内核） | ✅ |
| ⌘S 保存 | ✅ |
| 经典单终端界面 | ✅（标题栏切换） |
| LSP / AI 块 / 原生文件夹选择器 | 🔜 |

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│ Titlebar · 界面模式 · 主题                                    │
├─────────────────────────────────────────────────────────────┤
│ Workspace tabs (T1, T2, …)                                 │
├───┬──────────────┬──────────────────────────────────────────┤
│ ◉ │  Side panel  │  Split stage                              │
│rail│  (files…)   │  ┌─────────────┬─────────────┐           │
│   │              │  │ Block: Term │ Block: Edit │           │
│   │              │  │  Canvas     │  Monaco     │           │
│   │              │  └─────────────┴─────────────┘           │
└───┴──────────────┴──────────────────────────────────────────┘
```

### 前端模块

| 路径 | 职责 |
|------|------|
| `src/workspace/types.ts` | Block / Pane / Tab 类型 |
| `src/workspace/store.ts` | 状态与 localStorage |
| `src/workspace/split-resize.ts` | 分屏拖拽 |
| `src/ui/command-palette.ts` | 命令面板 |
| `src/app/workspace-app.ts` | 工作区 UI 编排 |
| `src/editor/monaco.ts` | Monaco 封装 |
| `src/terminal/block.ts` | 单块终端视图 |
| `src/fs/client.ts` | Tauri FS 命令客户端 |

### 后端命令

| 命令 | 说明 |
|------|------|
| `workspace_get_root` / `workspace_set_root` | 工作区根目录 |
| `fs_list_dir` / `fs_read_text` / `fs_write_text` | 沙箱内文件 IO |

工作区根默认 `~/projects/glyphterm`（若存在），否则为用户主目录。所有路径必须在根目录之下。

## 编辑器选型

采用 **Monaco Editor**（与 VS Code、Cursor 编辑区同源），原因：

1. 语法高亮、多语言、Minimap、多光标等开箱即用  
2. 与 Tauri WebView 集成成熟  
3. 后续可接 LSP（`monaco-languageclient`）与 AI inline diff  

## 切换界面

标题栏 **界面 → 工作区 / 经典**，写入 `glyphterm-ui-mode` 并刷新。

## 路线图

- **M3.2β** — 可拖拽分屏、块关闭/新增、SSH 块  
- **M3.3** — LSP、Problems 面板、搜索  
- **M4** — AI 块（结构化 Bash/Update 输出，参考 Wave 块）  
- **M4.1** — 远程 FS（SSH SFTP）与编辑器统一  

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
