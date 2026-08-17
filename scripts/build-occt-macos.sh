#!/usr/bin/env bash
set -euo pipefail

OCCT_TAG="${OCCT_TAG:-V8_0_1}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="${BEBLOG_OCCT_WORKDIR:-$REPO_ROOT/.cache/occt}"
SRC="$ROOT/src"
BUILD="$ROOT/build"
PREFIX="${BEBLOG_OCCT_PREFIX:-$ROOT/install}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Dieses Setup ist für macOS bestimmt." >&2
  exit 1
fi

for tool in git cmake; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Fehlendes Werkzeug: $tool" >&2
    exit 1
  fi
done

mkdir -p "$ROOT"
if [[ ! -d "$SRC/.git" ]]; then
  echo "Lade OCCT $OCCT_TAG …"
  git clone --depth 1 --branch "$OCCT_TAG" https://github.com/Open-Cascade-SAS/OCCT.git "$SRC"
else
  echo "Verwende vorhandene OCCT-Quellen unter $SRC"
fi

cmake -S "$SRC" -B "$BUILD" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX" \
  -DBUILD_MODULE_Visualization=OFF \
  -DBUILD_MODULE_ApplicationFramework=OFF \
  -DBUILD_MODULE_Draw=OFF \
  -DUSE_TK=OFF \
  -DUSE_FREETYPE=OFF \
  -DUSE_TBB=OFF \
  -DBUILD_DOC_Overview=OFF \
  -DBUILD_DOC_RefMan=OFF \
  -DINSTALL_DOC_RefMan=OFF

cmake --build "$BUILD" --parallel "$(sysctl -n hw.logicalcpu)"
cmake --install "$BUILD"

echo "OCCT $OCCT_TAG bereit: $PREFIX"
