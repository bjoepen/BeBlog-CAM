#!/usr/bin/env bash
set -euo pipefail

OCCT_TAG="${OCCT_TAG:-V8_0_0}"
ROOT="${BEBLOG_OCCT_WORKDIR:-$PWD/.cache/occt}"
SRC="$ROOT/src"
BUILD="$ROOT/build"
PREFIX="${BEBLOG_OCCT_PREFIX:-$ROOT/install}"

mkdir -p "$ROOT"
if [[ ! -d "$SRC/.git" ]]; then
  git clone --depth 1 --branch "$OCCT_TAG" https://github.com/Open-Cascade-SAS/OCCT.git "$SRC"
fi

cmake -S "$SRC" -B "$BUILD" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX" \
  -DBUILD_MODULE_FoundationClasses=OFF \
  -DBUILD_MODULE_ModelingData=OFF \
  -DBUILD_MODULE_ModelingAlgorithms=OFF \
  -DBUILD_MODULE_Visualization=OFF \
  -DBUILD_MODULE_ApplicationFramework=OFF \
  -DBUILD_MODULE_DataExchange=OFF \
  -DBUILD_MODULE_Draw=OFF \
  '-DBUILD_ADDITIONAL_TOOLKITS=TKDESTEP;TKMesh' \
  -DUSE_TK=OFF \
  -DUSE_FREETYPE=OFF \
  -DUSE_TBB=OFF \
  -DBUILD_DOC_Overview=OFF \
  -DBUILD_DOC_RefMan=OFF \
  -DINSTALL_DOC_RefMan=OFF

cmake --build "$BUILD" --parallel "$(sysctl -n hw.logicalcpu)"
cmake --install "$BUILD"
printf '%s\n' "$PREFIX"
