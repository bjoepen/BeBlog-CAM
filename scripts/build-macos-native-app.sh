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
export BEBLOG_OCCT_BUNDLE=1
export DYLD_LIBRARY_PATH="$PREFIX/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"

rm -rf "$STAGE"
mkdir -p "$STAGE"

# Start from exactly the OCCT libraries linked by the Rust/native bridge and
# recursively follow their @rpath OCCT dependencies. This produces the runtime
# dependency closure without bundling unrelated OCCT modules or symlink aliases.
roots=(
  TKernel TKMath TKG2d TKG3d TKGeomBase TKBRep
  TKGeomAlgo TKTopAlgo TKMesh TKXSBase TKDE TKDESTEP
)

queue=()
for library in "${roots[@]}"; do
  candidate="$(find "$PREFIX/lib" -maxdepth 1 -type f -name "lib${library}.*.dylib" | sort | tail -n 1)"
  if [[ -z "$candidate" ]]; then
    echo "OCCT Runtime-Library fehlt: lib${library}.*.dylib" >&2
    exit 1
  fi
  queue+=("$candidate")
done

seen_file="$STAGE/.seen"
: > "$seen_file"

while [[ ${#queue[@]} -gt 0 ]]; do
  current="${queue[0]}"
  queue=("${queue[@]:1}")
  name="$(basename "$current")"

  if grep -Fxq "$name" "$seen_file"; then
    continue
  fi
  printf '%s\n' "$name" >> "$seen_file"
  cp -L "$current" "$STAGE/$name"

  while IFS= read -r dependency; do
    dep_name="${dependency#@rpath/}"
    if grep -Fxq "$dep_name" "$seen_file"; then
      continue
    fi
    dep_path="$PREFIX/lib/$dep_name"
    if [[ ! -f "$dep_path" ]]; then
      echo "Transitive OCCT Runtime-Library fehlt: $dep_name (benötigt von $name)" >&2
      exit 1
    fi
    queue+=("$dep_path")
  done < <(otool -L "$current" | awk '/@rpath\/libTK/ {print $1}')
done

framework_count="$(wc -l < "$seen_file" | tr -d '[:space:]')"
rm -f "$seen_file"

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
echo "Bündele $framework_count benötigte OCCT Runtime-Libraries in Contents/Frameworks."
pnpm tauri build --features occt-native --config "$CONFIG"

APP="$ROOT/src-tauri/target/release/bundle/macos/BeBlog CAM.app"
EXECUTABLE="$APP/Contents/MacOS/beblog-cam"
FRAMEWORKS="$APP/Contents/Frameworks"

if [[ ! -x "$EXECUTABLE" || ! -d "$FRAMEWORKS" ]]; then
  echo "Native macOS bundle is incomplete: $APP" >&2
  exit 1
fi

missing=0
for binary in "$EXECUTABLE" "$FRAMEWORKS"/*.dylib; do
  while IFS= read -r dependency; do
    name="${dependency#@rpath/}"
    if [[ ! -e "$FRAMEWORKS/$name" ]]; then
      echo "Fehlende gebündelte Runtime-Library: $name (benötigt von $(basename "$binary"))" >&2
      missing=1
    fi
  done < <(otool -L "$binary" | awk '/@rpath\/libTK/ {print $1}')
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

rpaths="$(otool -l "$EXECUTABLE" | awk '
  $1 == "cmd" && $2 == "LC_RPATH" { in_rpath=1; next }
  in_rpath && $1 == "path" { print $2; in_rpath=0 }
')"

if ! grep -Fxq '@executable_path/../Frameworks' <<<"$rpaths"; then
  echo "App executable has no bundle-local Frameworks rpath." >&2
  exit 1
fi

if grep -Fq "$PREFIX/lib" <<<"$rpaths"; then
  echo "Release bundle contains machine-local OCCT rpath: $PREFIX/lib" >&2
  exit 1
fi

echo "Native macOS bundle PASS: $framework_count OCCT Runtime-Libraries, vollständige Dependency-Closure, kein lokaler OCCT-RPath."
