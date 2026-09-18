#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${BEBLOG_OCCT_PREFIX:-$ROOT/.cache/occt/install}"
STAGE="$ROOT/.cache/occt/bundle-frameworks"
CONFIG="$ROOT/.cache/tauri.native-bundle.conf.json"

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

rm -rf "$STAGE"
mkdir -p "$STAGE"

# Tauri's macOS bundler copies every configured dylib into Contents/Frameworks
# and fixes the app's runtime search path. Stage the complete OCCT runtime
# dylib set so transitive TK dependencies are self-contained as well.
shopt -s nullglob
occt_dylibs=("$PREFIX"/lib/*.dylib)
shopt -u nullglob
if [[ ${#occt_dylibs[@]} -eq 0 ]]; then
  echo "Keine OCCT dylibs unter $PREFIX/lib gefunden." >&2
  exit 1
fi

for dylib in "${occt_dylibs[@]}"; do
  cp -L "$dylib" "$STAGE/$(basename "$dylib")"
done

python3 - "$ROOT/src-tauri" "$STAGE" "$CONFIG" <<'PY'
import json
import os
import sys

src_tauri, stage, config = sys.argv[1:]
frameworks = [
    os.path.relpath(os.path.join(stage, name), src_tauri)
    for name in sorted(os.listdir(stage))
    if name.endswith(".dylib")
]
with open(config, "w", encoding="utf-8") as handle:
    json.dump({"bundle": {"macOS": {"frameworks": frameworks}}}, handle, indent=2)
    handle.write("\n")
PY

cd "$ROOT"
echo "Baue BeBlog CAM mit nativer STEP/BRep-Unterstützung aus: $BEBLOG_OCCT_PREFIX"
echo "Bündele ${#occt_dylibs[@]} OCCT Runtime-Libraries in Contents/Frameworks."
pnpm tauri build --features occt-native --config "$CONFIG"

APP="$ROOT/src-tauri/target/release/bundle/macos/BeBlog CAM.app"
EXECUTABLE="$APP/Contents/MacOS/beblog-cam"
FRAMEWORKS="$APP/Contents/Frameworks"

if [[ ! -x "$EXECUTABLE" || ! -d "$FRAMEWORKS" ]]; then
  echo "Native macOS bundle is incomplete: $APP" >&2
  exit 1
fi

missing=0
while IFS= read -r dependency; do
  name="${dependency#@rpath/}"
  if [[ ! -e "$FRAMEWORKS/$name" ]]; then
    echo "Fehlende gebündelte Runtime-Library: $name" >&2
    missing=1
  fi
done < <(otool -L "$EXECUTABLE" | awk '/@rpath\// {print $1}')

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

if ! otool -l "$EXECUTABLE" | awk '
  $1 == "cmd" && $2 == "LC_RPATH" { in_rpath=1; next }
  in_rpath && $1 == "path" {
    if ($2 == "@executable_path/../Frameworks") found=1
    in_rpath=0
  }
  END { exit found ? 0 : 1 }
'; then
  echo "App executable has no bundle-local Frameworks rpath." >&2
  exit 1
fi

echo "Native macOS bundle PASS: OCCT Runtime liegt selbständig in Contents/Frameworks."
