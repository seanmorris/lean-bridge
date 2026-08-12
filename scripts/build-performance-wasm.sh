#!/usr/bin/env bash

set -euo pipefail

LEAN_BRIDGE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_BRIDGE_ROOT/scripts/env.sh"
# shellcheck source=lean-runtime-config.sh
source "$LEAN_BRIDGE_ROOT/scripts/lean-runtime-config.sh"

bash "$LEAN_BRIDGE_ROOT/scripts/build-lean-runtime.sh"

SOURCE_DIR="$LEAN_BRIDGE_ROOT/poc/performance"
BUILD_DIR="$LEAN_BRIDGE_ROOT/build/performance-wasm"
GENERATED_DIR="$BUILD_DIR/generated"
RUNTIME_ROOT="$LEAN_BRIDGE_ROOT/build/lean-runtime/$LEAN_WASM_RUNTIME_BUILD_ID"
RUNTIME_BUILD="$RUNTIME_ROOT/cmake"
RUNTIME_SOURCE="$RUNTIME_ROOT/source"
LEAN_RUNTIME="$RUNTIME_BUILD/lib/lean/libleanrt.a"
LEAN_INIT="$RUNTIME_BUILD/lib/lean/libInit.a"
mkdir -p "$GENERATED_DIR" "$BUILD_DIR/audit" "$BUILD_DIR/startup" "$BUILD_DIR/final-static"

LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$SOURCE_DIR" \
  -o "$GENERATED_DIR/OrderedSearch.olean" \
  -c "$GENERATED_DIR/OrderedSearch.c" \
  "$SOURCE_DIR/OrderedSearch.lean"
LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$SOURCE_DIR" \
  -o "$GENERATED_DIR/SpatialIndex.olean" \
  -c "$GENERATED_DIR/SpatialIndex.c" \
  "$SOURCE_DIR/SpatialIndex.lean"
LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$SOURCE_DIR" \
  -o "$GENERATED_DIR/SpatialConsumer.olean" \
  -c "$GENERATED_DIR/SpatialConsumer.c" \
  "$SOURCE_DIR/SpatialConsumer.lean"

INCLUDES=(
  -I"$GENERATED_DIR"
  -I"$RUNTIME_BUILD/include"
  -I"$RUNTIME_SOURCE/src/include"
)
TARGET_FLAGS=(
  -O2
  "-ffile-prefix-map=$RUNTIME_ROOT=/workspace/build/lean-runtime/current"
  "-fdebug-prefix-map=$RUNTIME_ROOT=/workspace/build/lean-runtime/current"
  "-fmacro-prefix-map=$RUNTIME_ROOT=/workspace/build/lean-runtime/current"
  "${LEAN_WASM_PROFILE_CC_FLAGS[@]}"
)
SIDE_FLAGS=(
  "${TARGET_FLAGS[@]}"
  -sSIDE_MODULE=2
  -Wl,--no-entry
  "${INCLUDES[@]}"
)

emcc "$GENERATED_DIR/OrderedSearch.c" "$SOURCE_DIR/ordered_search_shim.c" \
  -sEXPORTED_FUNCTIONS=_l_LeanBridge_Performance_comparePoint,_initialize_OrderedSearch \
  "${SIDE_FLAGS[@]}" -Wl,-Map="$BUILD_DIR/ordered-search.link.map" \
  -o "$BUILD_DIR/ordered-search.so.wasm"
emcc "$GENERATED_DIR/SpatialIndex.c" "$SOURCE_DIR/spatial_index_shim.c" \
  -sEXPORTED_FUNCTIONS=_lean_bridge_performance_index_range,_initialize_SpatialIndex \
  "${SIDE_FLAGS[@]}" -Wl,-Map="$BUILD_DIR/spatial-index.link.map" \
  -o "$BUILD_DIR/spatial-index.so.wasm"
emcc "$GENERATED_DIR/SpatialConsumer.c" "$SOURCE_DIR/spatial_consumer_shim.c" \
  "${SIDE_FLAGS[@]}" -Wl,-Map="$BUILD_DIR/spatial-consumer.link.map" \
  -o "$BUILD_DIR/spatial-consumer.so.wasm"

emcc "${TARGET_FLAGS[@]}" -DBRIDGE_LEAN_RUNTIME_TEST_HOOKS=1 "${INCLUDES[@]}" \
  -c "$SOURCE_DIR/main.c" -o "$BUILD_DIR/main.o"
em++ "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" -I"$RUNTIME_SOURCE/src" \
  -c "$LEAN_BRIDGE_ROOT/poc/lean-link-spike/runtime_lifecycle.cpp" \
  -o "$BUILD_DIR/runtime_lifecycle.o"

BRIDGE_EXPORTS=(
  _bridge_perf_runtime_init
  _bridge_perf_lower_bound
  _bridge_perf_index_build
  _bridge_perf_index_size
  _bridge_perf_index_nearest
  _bridge_perf_index_range
  _bridge_perf_index_insert
  _bridge_perf_consumer_range_checksum
  _bridge_perf_index_release
  _bridge_perf_runtime_shutdown
  _bridge_perf_runtime_state
  _bridge_perf_runtime_init_runs
  _bridge_perf_library_init_runs
  _bridge_perf_live_handles
  _bridge_perf_rejected_handles
  _malloc
  _free
)

SIDE_IMPORTS="$BUILD_DIR/audit/side-function-imports.txt"
SIDE_PROVIDED="$BUILD_DIR/audit/side-provided-symbols.txt"
EXPORT_MANIFEST="$BUILD_DIR/audit/main-export-manifest.txt"
for module in \
  "$BUILD_DIR/ordered-search.so.wasm" \
  "$BUILD_DIR/spatial-index.so.wasm" \
  "$BUILD_DIR/spatial-consumer.so.wasm"; do
  wasm-objdump -x "$module"
done \
  | sed -n '/ - func\[/s/.*<env\.\([^>]*\)>.*/_\1/p' \
  | sort -u > "$SIDE_IMPORTS"

for map in \
  "$BUILD_DIR/ordered-search.link.map" \
  "$BUILD_DIR/spatial-index.link.map" \
  "$BUILD_DIR/spatial-consumer.link.map"; do
  awk 'NR > 1 { print "_" $NF }' "$map"
done \
  | sed -n '/^_[A-Za-z_][A-Za-z0-9_]*$/p' \
  | sort -u > "$SIDE_PROVIDED"

{
  printf '%s\n' "${BRIDGE_EXPORTS[@]}"
  sed -n '/^_/p' "$SIDE_IMPORTS"
} \
  | sort -u \
  | grep -Fvx -f "$SIDE_PROVIDED" \
  > "$EXPORT_MANIFEST"
mapfile -t MAIN_EXPORTS < "$EXPORT_MANIFEST"

link_dynamic_main() {
  local output=$1
  shift
  em++ \
    "$BUILD_DIR/main.o" \
    "$BUILD_DIR/runtime_lifecycle.o" \
    -Wl,--start-group "$LEAN_INIT" "$LEAN_RUNTIME" -Wl,--end-group \
    "$@" \
    "${TARGET_FLAGS[@]}" \
    -sMAIN_MODULE=2 \
    -sMODULARIZE=1 \
    -sEXPORT_ES6=1 \
    -sENVIRONMENT=web,worker,node \
    -sALLOW_MEMORY_GROWTH=1 \
    -sEXPORTED_RUNTIME_METHODS=loadDynamicLibrary,HEAP32,HEAPU32 \
    -sEXPORTED_FUNCTIONS="$(IFS=,; printf '%s' "${MAIN_EXPORTS[*]}")" \
    -Wl,--no-entry \
    "${INCLUDES[@]}" \
    -o "$output"
}

link_dynamic_main "$BUILD_DIR/main.mjs"
for artifact in ordered-search.so.wasm spatial-index.so.wasm spatial-consumer.so.wasm; do
  cp "$BUILD_DIR/$artifact" "$BUILD_DIR/startup/$artifact"
done
link_dynamic_main \
  "$BUILD_DIR/startup/main.mjs" \
  "$BUILD_DIR/startup/ordered-search.so.wasm" \
  "$BUILD_DIR/startup/spatial-index.so.wasm" \
  "$BUILD_DIR/startup/spatial-consumer.so.wasm"

STATIC_OBJECTS=()
for component in OrderedSearch SpatialIndex SpatialConsumer; do
  object="$BUILD_DIR/final-static/$component.o"
  emcc "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" \
    -c "$GENERATED_DIR/$component.c" -o "$object"
  STATIC_OBJECTS+=("$object")
done
for shim in ordered_search spatial_index spatial_consumer; do
  object="$BUILD_DIR/final-static/${shim}_shim.o"
  emcc "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" \
    -c "$SOURCE_DIR/${shim}_shim.c" -o "$object"
  STATIC_OBJECTS+=("$object")
done
em++ \
  "$BUILD_DIR/main.o" \
  "$BUILD_DIR/runtime_lifecycle.o" \
  "${STATIC_OBJECTS[@]}" \
  -Wl,--start-group "$LEAN_INIT" "$LEAN_RUNTIME" -Wl,--end-group \
  "${TARGET_FLAGS[@]}" \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sENVIRONMENT=web,worker,node \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_RUNTIME_METHODS=HEAP32,HEAPU32 \
  -sEXPORTED_FUNCTIONS="$(IFS=,; printf '%s' "${BRIDGE_EXPORTS[*]}")" \
  -Wl,--no-entry \
  "${INCLUDES[@]}" \
  -o "$BUILD_DIR/final-static/main.mjs"

for module in \
  "$BUILD_DIR/main.wasm" \
  "$BUILD_DIR/startup/main.wasm" \
  "$BUILD_DIR/final-static/main.wasm" \
  "$BUILD_DIR/ordered-search.so.wasm" \
  "$BUILD_DIR/spatial-index.so.wasm" \
  "$BUILD_DIR/spatial-consumer.so.wasm"; do
  wasm-tools validate --features all "$module"
  wasm-objdump -x "$module" > "$BUILD_DIR/audit/$(basename "$module").objdump.txt"
done

(
  cd "$BUILD_DIR"
  sha256sum \
    main.wasm startup/main.wasm final-static/main.wasm \
    ordered-search.so.wasm spatial-index.so.wasm spatial-consumer.so.wasm
) > "$BUILD_DIR/audit/sha256.txt"

node "$LEAN_BRIDGE_ROOT/scripts/generate-performance-bindings.mjs"

printf 'Built performance Wasm components in %s\n' "$BUILD_DIR"
