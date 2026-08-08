#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_WASM_PROJECT_ROOT/scripts/env.sh"

LEAN_COMMIT=f3b06c705e6c85f5314019d5d3baab0fec5b580c
LEAN_PATCH="$LEAN_WASM_PROJECT_ROOT/patches/lean4-4.32.2-emscripten-runtime-signatures.patch"
patch_sha=$(sha256sum "$LEAN_PATCH" | awk '{print $1}')
RUNTIME_ROOT="$LEAN_WASM_PROJECT_ROOT/build/lean-runtime/$LEAN_COMMIT-$patch_sha"
RUNTIME_BUILD="$RUNTIME_ROOT/cmake"
RUNTIME_SOURCE="$RUNTIME_ROOT/source"
LEAN_RUNTIME="$RUNTIME_BUILD/lib/lean/libleanrt.a"

"$LEAN_WASM_PROJECT_ROOT/scripts/build-lean-runtime.sh"

SOURCE_DIR="$LEAN_WASM_PROJECT_ROOT/poc/lean-link-spike"
BUILD_DIR="$LEAN_WASM_PROJECT_ROOT/build/lean-link-spike"
GENERATED_DIR="$BUILD_DIR/generated"
STARTUP_DIR="$BUILD_DIR/startup"
LAZY_DIR="$BUILD_DIR/lazy"
AUDIT_DIR="$BUILD_DIR/audit"
mkdir -p "$GENERATED_DIR" "$STARTUP_DIR" "$LAZY_DIR" "$AUDIT_DIR"

lean -c "$GENERATED_DIR/Alpha.c" "$SOURCE_DIR/Alpha.lean"

INCLUDES=(
  -I"$RUNTIME_BUILD/include"
  -I"$RUNTIME_SOURCE/src/include"
)

SIDE_FLAGS=(
  -O2
  -fwasm-exceptions
  -pthread
  -flto
  -sSIDE_MODULE=2
  -Wl,--no-entry
  "${INCLUDES[@]}"
)

BRIDGE_EXPORTS=(
  _bridge_lean_runtime_init
  _bridge_has_lean_alpha
  _bridge_lean_alpha_make
  _bridge_lean_alpha_read
  _bridge_lean_handle_identity
  _bridge_lean_release
  _bridge_lean_live_handles
)

build_side() {
  local output_dir=$1
  emcc \
    "$GENERATED_DIR/Alpha.c" \
    "$SOURCE_DIR/alpha_shim.c" \
    "${SIDE_FLAGS[@]}" \
    -o "$output_dir/alpha.so.wasm"
}

build_main() {
  local output_dir=$1
  shift
  emcc -O2 -fwasm-exceptions -pthread -flto "${INCLUDES[@]}" \
    -c "$SOURCE_DIR/main.c" -o "$output_dir/main.o"
  em++ \
    "$output_dir/main.o" \
    "$LEAN_RUNTIME" \
    "$@" \
    "${MAIN_FLAGS[@]}" \
    -o "$output_dir/main.mjs"
}

build_side "$STARTUP_DIR"
build_side "$LAZY_DIR"

SIDE_IMPORTS="$AUDIT_DIR/alpha-function-imports.txt"
EXPORT_MANIFEST="$AUDIT_DIR/main-export-manifest.txt"
wasm-objdump -x "$LAZY_DIR/alpha.so.wasm" \
  | sed -n '/ - func\[/s/.*<env\.\([^>]*\)>.*/_\1/p' \
  | sort -u \
  > "$SIDE_IMPORTS"

{
  printf '%s\n' "${BRIDGE_EXPORTS[@]}"
  sed -n '/^_/p' "$SIDE_IMPORTS"
} | sort -u > "$EXPORT_MANIFEST"
mapfile -t MAIN_EXPORTS < "$EXPORT_MANIFEST"

MAIN_FLAGS=(
  -O2
  -fwasm-exceptions
  -pthread
  -flto
  -sMAIN_MODULE=2
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sENVIRONMENT=node
  -sALLOW_MEMORY_GROWTH=1
  -sPTHREAD_POOL_SIZE=0
  -sEXPORTED_RUNTIME_METHODS=ccall,loadDynamicLibrary
  -sEXPORTED_FUNCTIONS="$(IFS=,; printf '%s' "${MAIN_EXPORTS[*]}")"
  -Wl,--no-entry
  "${INCLUDES[@]}"
)

build_main "$STARTUP_DIR" "$STARTUP_DIR/alpha.so.wasm"
build_main "$LAZY_DIR"

for module in \
  "$STARTUP_DIR/main.wasm" \
  "$STARTUP_DIR/alpha.so.wasm" \
  "$LAZY_DIR/main.wasm" \
  "$LAZY_DIR/alpha.so.wasm"; do
  # Lean's pinned Emscripten path currently emits legacy exception opcodes.
  wasm-tools validate --features all "$module"
  name=$(basename "$(dirname "$module")")-$(basename "$module")
  wasm-objdump -x "$module" > "$AUDIT_DIR/$name.objdump.txt"
done

sha256sum \
  "$STARTUP_DIR/main.wasm" \
  "$STARTUP_DIR/alpha.so.wasm" \
  "$LAZY_DIR/main.wasm" \
  "$LAZY_DIR/alpha.so.wasm" \
  > "$AUDIT_DIR/sha256.txt"

printf 'Built Lean link spike in %s\n' "$BUILD_DIR"
