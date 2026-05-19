# GitHub 仓库设置清单

代码已推送到 `main`。若使用 **cndingbo** 主账号登录 GitHub，请在网页端完成以下设置（`gh` 需对该仓库有 **admin** 权限方可自动化）。

## About（右侧「关于」）

| 字段 | 建议值 |
|------|--------|
| **Description** | 开源字形终端：CJK/Unicode 一等公民，Rust 核心 + Tauri 2 桌面，多标签 SSH 与可定制主题。Apache-2.0。 |
| **Website** | `https://github.com/cndingbo/glyphterm#readme` |
| **Topics** | `terminal` `rust` `tauri` `unicode` `cjk` `ssh` `open-source` `desktop-app` `vt100` `monospace` `cross-platform` `macos` `typescript` `developer-tools` `pty` |
| **Releases** | 勾选（有 tag 时展示） |
| **Packages** | 暂不勾选 |
| **License** | 推送完整 [LICENSE](../LICENSE) 后应识别为 **Apache License 2.0**；若仍显示 Other，在 Settings → General → 手动选 Apache-2.0 |

## Features（Settings → General）

- [x] Issues  
- [x] Discussions（建议开启，用于用法与路线图）  
- [ ] Wiki（可选，文档以 `docs/` 为准即可）  
- [ ] Projects（按需）

## 社交预览图（可选）

Settings → General → Social preview → 上传 1280×640 图，建议包含：

- Logo 字样 **GlyphTerm / 字形终端**
- 一句标语：「让每个字形落在正确的格子里」
- 深色主题终端截图

## 使用 admin 账号一键设置（可选）

```bash
gh auth login   # 使用 cndingbo 所有者账号
gh repo edit cndingbo/glyphterm \
  --description "开源字形终端：CJK/Unicode 一等公民，Rust 核心 + Tauri 2 桌面，多标签 SSH 与可定制主题。Apache-2.0。" \
  --homepage "https://github.com/cndingbo/glyphterm#readme" \
  --enable-discussions \
  --add-topic terminal --add-topic rust --add-topic tauri --add-topic unicode --add-topic cjk \
  --add-topic ssh --add-topic open-source --add-topic desktop-app --add-topic vt100 \
  --add-topic monospace --add-topic cross-platform --add-topic macos --add-topic typescript \
  --add-topic developer-tools --add-topic pty
```

## 已随仓库提供的模板

- Issue 模板：Bug / 功能建议  
- PR 模板、CONTRIBUTING、SECURITY、CODE_OF_CONDUCT  
- 许可证 ADR：[LICENSING.md](./LICENSING.md)
