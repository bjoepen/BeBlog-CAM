#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${BEBLOG_OCCT_PREFIX:-$ROOT/.cache/occt/install}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "BeBlog CAM native build currently targets macOS." >&2
  exit 1
fi

if [[ ! -d "$PREFIX/include/opencascade" || ! -d "$PREFIX/lib" ]]; then
  echo "OCCT ist noch nicht eingerichtet. Baue jetzt die gepinnte native Version einmalig."
  BEBLOG_OCCT_PREFIX="$PREFIX" bash "$ROOT/scripts/build-occt-macos.sh"
fi

export BEBLOG_OCCT_PREFIX="$PREFIX"
export DYLD_LIBRARY_PATH="$PREFIX/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"

cd "$ROOT"
echo "Baue BeBlog CAM mit nativer STEP/BRep-Unterstützung aus: $BEBLOG_OCCT_PREFIX"
exec pnpm tauri build --features occt-native
