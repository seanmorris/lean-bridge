#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_WASM_PROJECT_ROOT/scripts/env.sh"

SOURCE_DIR="$LEAN_WASM_PROJECT_ROOT/poc/link-spike"
BUILD_DIR="$LEAN_WASM_PROJECT_ROOT/build/link-spike"
STARTUP_DIR="$BUILD_DIR/startup"
LAZY_DIR="$BUILD_DIR/lazy"
AUDIT_DIR="$BUILD_DIR/audit"

mkdir -p "$STARTUP_DIR" "$LAZY_DIR" "$AUDIT_DIR"

SIDE_FLAGS=(
  -O2
  -sSIDE_MODULE=2
  -Wl,--no-entry
)

MAIN_FLAGS=(
  -O2
  -sMAIN_MODULE=2
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sENVIRONMENT=node
  -sALLOW_MEMORY_GROWTH=1
  -sEXPORTED_RUNTIME_METHODS=loadDynamicLibrary
  -sEXPORTED_FUNCTIONS=_bridge_increment,_bridge_get_counter,_bridge_reset,_bridge_register_alpha,_bridge_register_beta,_bridge_has_alpha,_bridge_has_beta,_bridge_call_alpha,_bridge_call_beta
  -Wl,--no-entry
)

build_sides() {
  local output_dir=$1
  emcc "$SOURCE_DIR/alpha.c" "${SIDE_FLAGS[@]}" -o "$output_dir/alpha.so.wasm"
  emcc "$SOURCE_DIR/beta.c" "${SIDE_FLAGS[@]}" -o "$output_dir/beta.so.wasm"
}

build_sides "$STARTUP_DIR"
build_sides "$LAZY_DIR"

emcc "$SOURCE_DIR/main.c" \
  "$STARTUP_DIR/alpha.so.wasm" \
  "$STARTUP_DIR/beta.so.wasm" \
  "${MAIN_FLAGS[@]}" \
  -o "$STARTUP_DIR/main.mjs"

emcc "$SOURCE_DIR/main.c" \
  "${MAIN_FLAGS[@]}" \
  -o "$LAZY_DIR/main.mjs"

for module in \
  "$STARTUP_DIR/main.wasm" \
  "$STARTUP_DIR/alpha.so.wasm" \
  "$STARTUP_DIR/beta.so.wasm" \
  "$LAZY_DIR/main.wasm" \
  "$LAZY_DIR/alpha.so.wasm" \
  "$LAZY_DIR/beta.so.wasm"; do
  wasm-tools validate "$module"
  name=$(basename "$(dirname "$module")")-$(basename "$module")
  wasm-objdump -x "$module" > "$AUDIT_DIR/$name.objdump.txt"
done

sha256sum \
  "$STARTUP_DIR/main.wasm" \
  "$STARTUP_DIR/alpha.so.wasm" \
  "$STARTUP_DIR/beta.so.wasm" \
  "$LAZY_DIR/main.wasm" \
  "$LAZY_DIR/alpha.so.wasm" \
  "$LAZY_DIR/beta.so.wasm" \
  > "$AUDIT_DIR/sha256.txt"

printf 'Built link spike in %s\n' "$BUILD_DIR"
