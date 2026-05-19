# CJK 与多语言渲染规范

本文档是 GlyphTerm 相对 Wave 等终端的 **核心差异化契约**。所有贡献者修改网格、光标、选区、滚动时必须遵守。

## 1. 问题本质（你在 Wave 里看到的「乱码」）

常见现象：

- 中文变成 tofu（□）或重叠
- 光标位置与文字不对齐
- 一行里同时有中文、Emoji、颜色时整行错位

根因通常 **不是** shell 或 `locale` 错了（`LANG=en_US.UTF-8` 仍可能乱），而是：

1. **列宽算错**：把宽字符当 1 列，或 Ambiguous 字符宽度与渲染不一致  
2. **字体无字形**：等宽字体缺 CJK，回退链未配置  
3. **UI 层重复计量**：后端认为 2 列，前端 canvas 按 1 列画  

GlyphTerm 规定：**只有 `glyphwidth` 可以决定列数**。

## 2. East Asian Width 策略

| 属性 | 默认列数 | 说明 |
|------|----------|------|
| `W` / `F` | 2 | CJK 表意文字等 |
| `Na` / `H` | 1 | 半角、窄形式 |
| `A` (Ambiguous) | **可配置** | 希腊字母、部分符号；默认 **1**（与 WezTerm 一致，避免西方环境错位） |
| `N` | 1 | 中性 |
| Emoji (RI/ZWJ 序列) | 2（可配置） | 遵循 Unicode 15+ emoji 宽度表 |

用户可在设置中开启 `ambiguous_width = wide`（在主要使用中文 CLI 工具时与部分遗留程序对齐）。

**重要**：策略在会话启动时固定，运行中切换需清屏并提示用户。

## 3. 字体

推荐默认栈（按平台）：

| 平台 | 主字体 | 回退 |
|------|--------|------|
| macOS | Sarasa Mono SC | PingFang SC, SF Mono |
| Windows | Sarasa Mono SC | Microsoft YaHei UI, Consolas |
| Linux | Sarasa Mono SC | Noto Sans Mono CJK SC |

安装示例：

```bash
brew install --cask font-sarasa-gothic
```

应用内检测：若主字体缺字形，设置页提示安装，而非静默 tofu。

## 4. 混排规则（同一条逻辑行）

1. ANSI SGR 不改变宽度，只改变样式  
2. 宽字符占 2 格时，**禁止** 在第 2 列起始插入窄字符（应换行或右移）  
3. Tab 展开到下一制表位，以 **列** 计  
4. 组合用字（含 VS、ZWJ）先 **字素簇切分** 再量宽  
5. Emoji + 肤色修饰符 + ZWJ 作为 **一个簇** 量宽  

## 5. UI 国际化（与终端编码分离）

| 层 | 机制 |
|----|------|
| 应用 UI | Fluent / JSON，`ui_locale` 独立配置 |
| 终端 PTY | 尊重用户 `LANG`/`LC_*`，不在应用层转码 |
| 文档 | 中/英 README 同步维护 |

终端内 UTF-8 字节 **永不** 转 GBK/GB2312；若用户需要 legacy 编码，由 shell 工具自行处理。

## 6. 与 Wave 的对照测试

维护 `tests/golden/mixed_line.txt` 等用例，包含：

```
中文English🙂╭──╮
```

期望列宽可机器校验；CI 在 Linux/macOS/Windows 三平台跑 `cargo test`。

## 7. 用户临时规避（迁移期）

在 GlyphTerm 未安装前，Wave 用户可：

- 换 **Sarasa Mono SC** 等等宽 CJK 字体  
- 升级 Wave 到最新版并开启 East Asian wide 相关选项  
- 尽量避免同一行混用框线字符与 CJK（减轻终端 bug）

长期方案仍是使用按本规范实现的终端核心。
