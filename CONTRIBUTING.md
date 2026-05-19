# 参与贡献

感谢你对 GlyphTerm（字形终端）的关注。本项目以 **正确性、CJK 可验证性、本地优先** 为优先原则。

## 开始之前

1. 阅读 [README.md](./README.md) 与 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
2. 开发环境见 [docs/DEV_SETUP.md](./docs/DEV_SETUP.md)
3. 许可证：所有合并进 `main` 的代码均在 [Apache-2.0](./LICENSE) 下发布；提交 PR 即表示你同意该许可

## 开发流程

```bash
git clone https://github.com/cndingbo/glyphterm.git
cd glyphterm
cargo test --workspace
```

桌面端：

```bash
cd apps/glyphterm-desktop
npm install
npm run tauri dev
```

## 提交规范

- **分支**：`feat/…`、`fix/…`、`docs/…` 从 `main` 拉出
- **提交信息**：英文或中文均可，建议 `type: summary`（如 `fix: filter OSC 1337 sequences`）
- **测试**：涉及 `glyphwidth` / `glyphgrid` / `glyphvt` 的改动必须带测试；UI 主题改动请附截图

## Pull Request 检查清单

- [ ] `cargo test --workspace`（或 PR 中说明为何跳过）通过
- [ ] 未提交 `target/`、`node_modules/`、`dist/`
- [ ] 文档与行为一致（API、快捷键、主题 ID 等）
- [ ] 不引入与 Apache-2.0 不兼容的依赖（如有疑问请在 PR 说明）

## 代码风格

- **Rust**：`cargo fmt`、`cargo clippy`（零 warning 为目标）
- **TypeScript**：与现有 `apps/glyphterm-desktop` 风格一致，避免无关重构

## CJK / 宽度相关改动

凡影响列宽、网格、VT 解析的 PR，请：

1. 在 `crates/glyphwidth/tests/golden/` 增加或更新黄金样例（如适用）
2. 在 PR 描述中说明 Unicode 版本或策略假设

## 行为准则

请遵守 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。骚扰、歧视或人身攻击不容忍。

## 问题与讨论

- **Bug / 功能**：使用 [GitHub Issues](https://github.com/cndingbo/glyphterm/issues)
- **安全漏洞**：勿公开 Issue，见 [SECURITY.md](./SECURITY.md)
