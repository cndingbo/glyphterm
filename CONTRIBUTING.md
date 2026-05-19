# Contributing to GlyphTerm

感谢关注 **GlyphTerm**（[github.com/cndingbo/glyphterm](https://github.com/cndingbo/glyphterm)）。

## 开发环境

- Rust 1.85+（`rustup` 安装）
- 可选：后续 M2 起需要 Node.js（Tauri UI）

```bash
git clone https://github.com/cndingbo/glyphterm.git
cd glyphterm
cargo test --workspace
```

## 核心原则

1. **列宽只信 `glyphwidth`** — UI 与渲染层不得自行按字节或 code point 算列。
2. **改网格必跑测试** — `crates/glyphwidth` 与 `crates/glyphgrid` 的单元测试必须通过。
3. **CJK 相关改动** — 阅读并遵守 [docs/CJK-RENDERING.md](./docs/CJK-RENDERING.md)。

## Pull Request

1. 从 `main` 拉分支：`feat/...` 或 `fix/...`
2. 小步提交，说明动机（尤其是 Unicode 宽度策略变更）
3. 宽度/网格行为变更请在 PR 中附上测试用例或黄金样例

## 许可证

贡献即表示同意以 [Apache-2.0](./LICENSE) 授权。
