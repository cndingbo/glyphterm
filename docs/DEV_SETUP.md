# 本地开发环境

## 1. Rust（必须）

终端里若报 `cargo: No such file or directory`，说明 PATH 未加载 rustup。

**一次性配置**（写入 `~/.zshrc`）：

```bash
echo '' >> ~/.zshrc
echo '# Rust' >> ~/.zshrc
echo '[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"' >> ~/.zshrc
source ~/.zshrc
```

验证：

```bash
cargo --version
rustc --version
```

若未安装 Rust，或 `cargo` / `rustc` 报 `No such file or directory`（`~/.cargo/bin/rustup` 丢失）：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

若仍有编译错误 `State::Osc not covered`，请同步最新代码：

```bash
cd ~/projects/glyphterm && git pull
```

## 2. Node.js（必须）

```bash
brew install node
```

## 3. libssh2（SSH 功能）

```bash
brew install libssh2
```

## 4. 启动桌面版

```bash
cd apps/glyphterm-desktop
npm install
npm run tauri dev
```

## 5. GitHub CLI（可选）

```bash
brew install gh
gh auth login
```

若网页验证码过期，重新执行 `gh auth login` 并在浏览器中尽快完成授权。
