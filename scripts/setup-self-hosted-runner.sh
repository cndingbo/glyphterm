#!/usr/bin/env bash
# Setup GitHub Actions self-hosted runner on macOS (Apple Silicon).
# Usage:
#   1. Open https://github.com/cndingbo/glyphterm/settings/actions/runners/new
#   2. Select macOS → ARM64 (not x64 on Apple Silicon Macs)
#   3. Copy the registration token from the Configure step
#   4. Run:
#        export RUNNER_TOKEN='paste-token-here'
#        ./scripts/setup-self-hosted-runner.sh
#
# Optional: install as login service (starts on boot):
#        ./scripts/setup-self-hosted-runner.sh --install-service

set -euo pipefail

REPO_URL="https://github.com/cndingbo/glyphterm"
RUNNER_NAME="${RUNNER_NAME:-glyphterm-mac}"
RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner-glyphterm}"
INSTALL_SERVICE=false

for arg in "$@"; do
  case "$arg" in
    --install-service) INSTALL_SERVICE=true ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
  esac
done

ARCH="$(uname -m)"
case "$ARCH" in
  arm64) RUNNER_ARCH="arm64" ;;
  x86_64) RUNNER_ARCH="x64" ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

if [[ -z "${RUNNER_TOKEN:-}" ]]; then
  echo "Error: set RUNNER_TOKEN from GitHub → Settings → Actions → Runners → New self-hosted runner" >&2
  echo "  export RUNNER_TOKEN='....'" >&2
  exit 1
fi

RUNNER_VERSION="${RUNNER_VERSION:-}"
if [[ -z "$RUNNER_VERSION" ]]; then
  RUNNER_VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
    | sed -n 's/.*"tag_name": "v\([^"]*\)".*/\1/p' | head -1)"
fi

PKG="actions-runner-osx-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${PKG}"

echo "==> Runner ${RUNNER_VERSION} (${RUNNER_ARCH}) → ${RUNNER_DIR}"
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [[ ! -f bin/Runner.Listener ]]; then
  echo "==> Downloading ${PKG}"
  curl -fsSL -o "$PKG" -L "$URL"
  echo "==> Extracting"
  tar xzf "./$PKG"
fi

echo "==> Configuring runner '${RUNNER_NAME}' for ${REPO_URL}"
./config.sh \
  --url "$REPO_URL" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "self-hosted,macOS,${RUNNER_ARCH},glyphterm" \
  --unattended \
  --replace

echo ""
echo "Runner configured. Start manually:"
echo "  cd ${RUNNER_DIR} && ./run.sh"
echo ""

if [[ "$INSTALL_SERVICE" == true ]]; then
  echo "==> Installing launchd service (may prompt for password)"
  ./svc.sh install
  ./svc.sh start
  ./svc.sh status
  echo "Service installed. Runner will start at login."
fi
