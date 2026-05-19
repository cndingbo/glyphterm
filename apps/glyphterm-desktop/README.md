# GlyphTerm Desktop

Tauri 2 桌面宿主：Rust 侧运行 PTY + `glyphterm-core`，前端 Canvas 渲染（CJK 字体栈优先）。

## 开发

```bash
npm install
npm run tauri dev
```

需要：

- Rust 1.78+
- Node.js 20+
- macOS：Xcode CLT；Linux：webkit2gtk 等（见 [Tauri 文档](https://v2.tauri.app/start/prerequisites/)）

## 架构

```
WebView (Canvas)  ←terminal-frame→  glyphterm-core  →  glyphvt  →  glyphgrid
       ↑ invoke terminal_write / resize
```
