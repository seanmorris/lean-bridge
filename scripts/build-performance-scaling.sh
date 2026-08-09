#!/usr/bin/env bash

set -euo pipefail

LEAN_BRIDGE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_BRIDGE_ROOT/scripts/env.sh"
# shellcheck source=lean-runtime-config.sh
source "$LEAN_BRIDGE_ROOT/scripts/lean-runtime-config.sh"

"$LEAN_BRIDGE_ROOT/scripts/build-lean-runtime.sh"
node "$LEAN_BRIDGE_ROOT/scripts/generate-performance-scale-fixtures.mjs"

SOURCE_DIR="$LEAN_BRIDGE_ROOT/poc/performance/scale"
BUILD_DIR="$LEAN_BRIDGE_ROOT/build/performance-scale"
GENERATED_DIR="$BUILD_DIR/generated"
MODULE_DIR="$BUILD_DIR/modules"
LAZY_DIR="$BUILD_DIR/lazy"
RUNTIME_ROOT="$LEAN_BRIDGE_ROOT/build/lean-runtime/$LEAN_WASM_RUNTIME_BUILD_ID"
RUNTIME_BUILD="$RUNTIME_ROOT/cmake"
RUNTIME_SOURCE="$RUNTIME_ROOT/source"
LEAN_RUNTIME="$RUNTIME_BUILD/lib/lean/libleanrt.a"
LEAN_INIT="$RUNTIME_BUILD/lib/lean/libInit.a"
GRAPH_COUNTS=(1 3 10 50)

mkdir -p "$MODULE_DIR" "$LAZY_DIR" "$BUILD_DIR/audit" "$BUILD_DIR/static-objects"

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

for ordinal in $(seq 1 50); do
  suffix=$(printf '%03d' "$ordinal")
  module="Scale$suffix"
  name="scale-$suffix"
  LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$GENERATED_DIR" \
    -o "$GENERATED_DIR/$module.olean" \
    -c "$GENERATED_DIR/$module.c" \
    "$GENERATED_DIR/$module.lean"
  emcc "$GENERATED_DIR/$module.c" "$GENERATED_DIR/${name}_shim.c" \
    "${SIDE_FLAGS[@]}" -Wl,-Map="$BUILD_DIR/audit/${name}.link.map" \
    -o "$MODULE_DIR/${name}.so.wasm"
  cp "$MODULE_DIR/${name}.so.wasm" "$LAZY_DIR/${name}.so.wasm"
  emcc "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" \
    -c "$GENERATED_DIR/$module.c" -o "$BUILD_DIR/static-objects/$module.o"
  emcc "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" \
    -c "$GENERATED_DIR/${name}_shim.c" -o "$BUILD_DIR/static-objects/${name}_shim.o"
done

emcc "${TARGET_FLAGS[@]}" -DBRIDGE_LEAN_RUNTIME_TEST_HOOKS=1 "${INCLUDES[@]}" \
  -c "$SOURCE_DIR/main.c" -o "$BUILD_DIR/main.o"
em++ "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" -I"$RUNTIME_SOURCE/src" \
  -c "$LEAN_BRIDGE_ROOT/poc/lean-link-spike/runtime_lifecycle.cpp" \
  -o "$BUILD_DIR/runtime_lifecycle.o"

BRIDGE_EXPORTS=(
  _bridge_scale_runtime_init
  _bridge_scale_component_init
  _bridge_scale_call
  _bridge_scale_runtime_shutdown
  _bridge_scale_runtime_state
  _bridge_scale_runtime_init_runs
  _bridge_scale_registration_runs
  _bridge_scale_library_init_runs
  _bridge_scale_rejected_calls
)
SIDE_IMPORTS="$BUILD_DIR/audit/side-function-imports.txt"
SIDE_PROVIDED="$BUILD_DIR/audit/side-provided-symbols.txt"
EXPORT_MANIFEST="$BUILD_DIR/audit/main-export-manifest.txt"

for module in "$MODULE_DIR"/*.so.wasm; do
  wasm-objdump -x "$module"
done \
  | sed -n '/ - func\[/s/.*<env\.\([^>]*\)>.*/_\1/p' \
  | sort -u > "$SIDE_IMPORTS"

for map in "$BUILD_DIR"/audit/scale-*.link.map; do
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
    -sEXPORTED_RUNTIME_METHODS=loadDynamicLibrary,HEAPU32 \
    -sEXPORTED_FUNCTIONS="$(IFS=,; printf '%s' "${MAIN_EXPORTS[*]}")" \
    -Wl,--no-entry \
    "${INCLUDES[@]}" \
    -o "$output"
}

link_dynamic_main "$LAZY_DIR/main.mjs"

for count in "${GRAPH_COUNTS[@]}"; do
  startup_dir="$BUILD_DIR/startup/$count"
  static_dir="$BUILD_DIR/final-static/$count"
  mkdir -p "$startup_dir" "$static_dir"
  startup_modules=()
  static_objects=()
  for ordinal in $(seq 1 "$count"); do
    suffix=$(printf '%03d' "$ordinal")
    name="scale-$suffix"
    cp "$MODULE_DIR/${name}.so.wasm" "$startup_dir/${name}.so.wasm"
    startup_modules+=("$startup_dir/${name}.so.wasm")
    static_objects+=(
      "$BUILD_DIR/static-objects/Scale$suffix.o"
      "$BUILD_DIR/static-objects/${name}_shim.o"
    )
  done
  link_dynamic_main "$startup_dir/main.mjs" "${startup_modules[@]}"
  em++ \
    "$BUILD_DIR/main.o" \
    "$BUILD_DIR/runtime_lifecycle.o" \
    "${static_objects[@]}" \
    -Wl,--start-group "$LEAN_INIT" "$LEAN_RUNTIME" -Wl,--end-group \
    "${TARGET_FLAGS[@]}" \
    -sMODULARIZE=1 \
    -sEXPORT_ES6=1 \
    -sENVIRONMENT=web,worker,node \
    -sALLOW_MEMORY_GROWTH=1 \
    -sEXPORTED_RUNTIME_METHODS=HEAPU32 \
    -sEXPORTED_FUNCTIONS="$(IFS=,; printf '%s' "${BRIDGE_EXPORTS[*]}")" \
    -Wl,--no-entry \
    "${INCLUDES[@]}" \
    -o "$static_dir/main.mjs"
done

find "$LAZY_DIR" "$BUILD_DIR/startup" "$BUILD_DIR/final-static" \
  -name '*.wasm' -type f -print0 \
  | sort -z \
  | while IFS= read -r -d '' module; do
      wasm-tools validate --features all "$module"
    done

(
  cd "$BUILD_DIR"
  find lazy startup final-static -type f \( -name '*.wasm' -o -name '*.mjs' \) -print0 \
    | sort -z \
    | xargs -0 sha256sum
) > "$BUILD_DIR/audit/sha256.txt"

printf 'Built 1, 3, 10, and 50-library Lean scaling profiles in %s\n' "$BUILD_DIR"
