# SSH 远程终端

GlyphTerm 桌面版支持通过 **SSH** 打开远程 shell（与本地标签并存）。

## 连接方式

1. 点击 **+ SSH**，或按 **⌘⇧N**
2. 输入主机、用户名、端口
3. 密码可留空，将依次尝试：
   - `ssh-agent`
   - `~/.ssh/id_ed25519`

## 依赖（macOS）

SSH 功能需要系统安装 **libssh2**：

```bash
brew install libssh2
```

## 技术说明

- 后端：`ssh2`（libssh2）+ xterm-256color PTY
- 与本地会话共用 `glyphwidth` / `glyphgrid` / `glyphvt` 渲染链
- 每个 SSH 连接对应独立标签页

## 后续（M3.2）

- `~/.config/glyphterm/hosts.toml` 保存常用主机
- 分屏中并排本地 + 远程
- 跳板机 / ProxyJump
