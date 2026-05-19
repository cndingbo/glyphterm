# 在 Mac 上配置 Self-Hosted Runner

你的机器是 **Apple Silicon（arm64）**，请在 GitHub 页面选择 **macOS → ARM64**，不要选 x64。

## 1. 获取注册 Token

打开：

https://github.com/cndingbo/glyphterm/settings/actions/runners/new

选择 **macOS** → **ARM64**，在 **Configure** 步骤复制一次性 token。

## 2. 一键安装（推荐）

```bash
cd /path/to/glyphterm
export RUNNER_TOKEN='从 GitHub 页面复制的 token'
./scripts/setup-self-hosted-runner.sh --install-service
```

- 安装目录默认：`~/actions-runner-glyphterm`
- 标签：`self-hosted`, `macOS`, `arm64`, `glyphterm`（与 CI 工作流一致）

## 3. 手动启动（不装系统服务）

```bash
export RUNNER_TOKEN='...'
./scripts/setup-self-hosted-runner.sh
cd ~/actions-runner-glyphterm && ./run.sh
```

## 4. 验证

1. 打开 https://github.com/cndingbo/glyphterm/settings/actions/runners  
   应看到 **glyphterm-mac** 状态为 **Idle**（绿色）
2. 推送任意 commit 或 **Actions → CI → Re-run jobs**

## 5. 安全提示

公开仓库上的 self-hosted runner 可能被恶意 PR 利用。若仓库为 **public**，建议：

- 仅对 `main` 分支推送触发 CI，或
- 在 Settings → Actions → General 中限制 fork PR 使用 self-hosted runner

## 6. 卸载

```bash
cd ~/actions-runner-glyphterm
./svc.sh stop || true
./svc.sh uninstall || true
./config.sh remove --token "$REMOVAL_TOKEN"
```

`REMOVAL_TOKEN` 在 Runners 页面点击 runner → **Remove** 时获取。
