#!/usr/bin/env bash
set -euo pipefail

DEMO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPOSITORY_ROOT=$(cd "$DEMO_ROOT/../.." && pwd)
source "$REPOSITORY_ROOT/scripts/env.sh"
source "$REPOSITORY_ROOT/scripts/lean-runtime-config.sh"
BUILD_DIR="$REPOSITORY_ROOT/build/demos/lean-lru-cache"
GENERATED_DIR="$BUILD_DIR/generated"
RUNTIME_ROOT="$REPOSITORY_ROOT/build/lean-runtime/$LEAN_WASM_RUNTIME_BUILD_ID"
RUNTIME_BUILD="$RUNTIME_ROOT/cmake"
RUNTIME_SOURCE="$RUNTIME_ROOT/source"
OUTPUT_DIR="$DEMO_ROOT/runtime"

if [[ ! -f "$RUNTIME_BUILD/lib/lean/libInit.a" || ! -f "$RUNTIME_BUILD/lib/lean/libleanrt.a" ]]; then
  bash "$REPOSITORY_ROOT/scripts/build-lean-runtime.sh"
fi
mkdir -p "$GENERATED_DIR" "$OUTPUT_DIR"
LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$DEMO_ROOT" \
  -o "$GENERATED_DIR/LruCore.olean" -c "$GENERATED_DIR/LruCore.c" "$DEMO_ROOT/LruCore.lean"
LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$DEMO_ROOT" \
  -o "$GENERATED_DIR/Lru.olean" "$DEMO_ROOT/Lru.lean"
LEAN_PATH="$GENERATED_DIR:$DEMO_ROOT${LEAN_PATH:+:$LEAN_PATH}" lean -R "$DEMO_ROOT" "$DEMO_ROOT/Tests.lean"
node "$DEMO_ROOT/generate-proof-audit.mjs"
INCLUDES=(-I"$GENERATED_DIR" -I"$RUNTIME_BUILD/include" -I"$RUNTIME_SOURCE/src/include")
emcc -O3 "${LEAN_WASM_PROFILE_CC_FLAGS[@]}" "${INCLUDES[@]}" \
  -c "$GENERATED_DIR/LruCore.c" -o "$BUILD_DIR/LruCore.o"
emcc -O3 "${LEAN_WASM_PROFILE_CC_FLAGS[@]}" "${INCLUDES[@]}" \
  -c "$DEMO_ROOT/bridge.c" -o "$BUILD_DIR/bridge.o"
em++ "$BUILD_DIR/LruCore.o" "$BUILD_DIR/bridge.o" \
  -Wl,--start-group "$RUNTIME_BUILD/lib/lean/libInit.a" "$RUNTIME_BUILD/lib/lean/libleanrt.a" -Wl,--end-group \
  -O3 "${LEAN_WASM_PROFILE_CC_FLAGS[@]}" "${INCLUDES[@]}" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPU32 \
  -sEXPORTED_FUNCTIONS=_lean_lru_runtime_init,_lean_lru_create,_lean_lru_access,_lean_lru_entries,_lean_lru_trace,_lean_lru_prepare_trace,_lean_lru_repeat_trace,_lean_lru_destroy_trace,_lean_lru_destroy,_malloc,_free \
  -Wl,--no-entry -o "$OUTPUT_DIR/lean-lru-cache.mjs"
wasm-tools validate --features all "$OUTPUT_DIR/lean-lru-cache.wasm"
printf 'Built the proven Lean LRU browser module in %s\n' "$OUTPUT_DIR"
