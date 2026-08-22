#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${BEBLOG_OCCT_PREFIX:-$ROOT/.cache/occt/install}"
FIXTURE="${BEBLOG_OCCT_TEST_STEP:-$ROOT/.cache/occt/src/data/step/screw.step}"

if [[ ! -f "$FIXTURE" ]]; then
  echo "Keine STEP-Testdatei gefunden: $FIXTURE" >&2
  echo "Zuerst: pnpm native:setup" >&2
  exit 1
fi

export BEBLOG_OCCT_PREFIX="$PREFIX"
export BEBLOG_OCCT_TEST_STEP="$FIXTURE"
export DYLD_LIBRARY_PATH="$PREFIX/lib${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"

cd "$ROOT"
cargo test --manifest-path src-tauri/Cargo.toml --features occt-native occt::tests::loads_real_step_as_brep -- --exact
