#!/bin/sh
# slopmop CLI installer.
#
# Usage:
#   curl -sf https://slopmop.io/cli/install.sh | sh
#   curl -sf https://slopmop.io/cli/install.sh | sh -s -- --host https://example.com
#
# The CLI is a single Bun-runnable JS file. Bun is required at runtime.
# We download the bundle from the same host that served this script and
# drop it into ~/.local/bin/slopmop.

set -eu

HOST="${SLOPMOP_HOST:-https://slopmop.io}"
INSTALL_DIR="${SLOPMOP_INSTALL_DIR:-$HOME/.local/bin}"

# Allow overriding the host via --host flag for self-hosted / dev.
while [ $# -gt 0 ]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v bun >/dev/null 2>&1; then
  cat <<'EOF' >&2
slopmop: bun is required but not installed.
install bun first: https://bun.com/docs/installation
or:               curl -fsSL https://bun.com/install | bash
EOF
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "slopmop: curl is required" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
TARGET="$INSTALL_DIR/slopmop"

echo "downloading slopmop from $HOST/cli/slopmop.js -> $TARGET"
curl -fsSL "$HOST/cli/slopmop.js" -o "$TARGET"
chmod +x "$TARGET"

VERSION="$("$TARGET" --version 2>/dev/null || echo unknown)"
echo "installed: $VERSION"
echo "make sure $INSTALL_DIR is on your PATH."
