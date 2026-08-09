#!/usr/bin/env bash

set -euo pipefail

LEAN_WASM_PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
# shellcheck source=env.sh
source "$LEAN_WASM_PROJECT_ROOT/scripts/env.sh"
# shellcheck source=lean-runtime-config.sh
source "$LEAN_WASM_PROJECT_ROOT/scripts/lean-runtime-config.sh"

RUNTIME_ROOT="$LEAN_WASM_PROJECT_ROOT/build/lean-runtime/$LEAN_WASM_RUNTIME_BUILD_ID"
RUNTIME_BUILD="$RUNTIME_ROOT/cmake"
RUNTIME_SOURCE="$RUNTIME_ROOT/source"
LEAN_RUNTIME="$RUNTIME_BUILD/lib/lean/libleanrt.a"
LEAN_INIT="$RUNTIME_BUILD/lib/lean/libInit.a"

"$LEAN_WASM_PROJECT_ROOT/scripts/build-lean-runtime.sh"

SOURCE_DIR="$LEAN_WASM_PROJECT_ROOT/poc/lean-link-spike"
GRAPH_LOCK="$SOURCE_DIR/graph-lock.json"
BUILD_DIR="$LEAN_WASM_LINK_SPIKE_DIR"
GENERATED_DIR="$BUILD_DIR/generated"
STARTUP_DIR="$BUILD_DIR/startup"
LAZY_DIR="$BUILD_DIR/lazy"
FINAL_STATIC_DIR="$BUILD_DIR/final-static"
AUDIT_DIR="$BUILD_DIR/audit"
mkdir -p \
  "$GENERATED_DIR" \
  "$STARTUP_DIR" \
  "$LAZY_DIR" \
  "$FINAL_STATIC_DIR" \
  "$AUDIT_DIR"

locked_lean_commit=$(jq -er '.runtime.leanCommit' "$GRAPH_LOCK")
locked_patch_set=$(jq -er '.runtime.patchSetSha256' "$GRAPH_LOCK")
if [[ "$locked_lean_commit" != "$LEAN_WASM_LEAN_COMMIT" ]]; then
  echo "Graph lock Lean commit mismatch: $locked_lean_commit" >&2
  exit 1
fi
if [[ "$locked_patch_set" != "$LEAN_WASM_PATCH_SET_SHA" ]]; then
  echo "Graph lock patch-set mismatch: $locked_patch_set" >&2
  exit 1
fi

while IFS=$'\t' read -r relative_path expected_sha; do
  actual_sha=$(sha256sum "$SOURCE_DIR/$relative_path" | awk '{print $1}')
  if [[ "$actual_sha" != "$expected_sha" ]]; then
    echo "Graph lock content mismatch for $relative_path" >&2
    exit 1
  fi
done < <(
  jq -r '.libraries[] | .capsule, .source, .shim | [.path, .sha256] | @tsv' \
    "$GRAPH_LOCK"
)

mapfile -t LEAN_LIBRARIES < <(
  node "$LEAN_WASM_PROJECT_ROOT/scripts/resolve-lean-graph.mjs" \
    --lock "$GRAPH_LOCK" \
    --profile side-lazy \
    --format modules
)
for composition_profile in side-startup side-lazy final-static; do
  node "$LEAN_WASM_PROJECT_ROOT/scripts/resolve-lean-graph.mjs" \
    --lock "$GRAPH_LOCK" \
    --profile "$composition_profile" \
    --format json \
    > "$AUDIT_DIR/resolved-$composition_profile.json"
done
for library in "${LEAN_LIBRARIES[@]}"; do
  LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean \
    -R "$SOURCE_DIR" \
    -o "$GENERATED_DIR/$library.olean" \
    -c "$GENERATED_DIR/$library.c" \
    "$SOURCE_DIR/$library.lean"
done

INCLUDES=(
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

BRIDGE_EXPORTS=(
  _bridge_lean_runtime_init
  _bridge_lean_runtime_status
  _bridge_lean_runtime_init_runs
  _bridge_lean_library_init_runs
  _bridge_lean_runtime_shutdown
  _bridge_test_lean_runtime_force_init_error
  _bridge_test_lean_heap_size
  _bridge_test_lean_grow_heap
  _bridge_has_lean_alpha
  _bridge_has_lean_beta
  _bridge_has_lean_gamma
  _bridge_lean_alpha_make
  _bridge_lean_alpha_read
  _bridge_lean_alpha_round_trip
  _bridge_lean_active_frames
  _bridge_lean_handle_identity
  _bridge_lean_cross_library_identity
  _bridge_lean_release
  _bridge_lean_live_handles
  _bridge_lean_rejected_handles
  _bridge_lean_retired_handle_slots
  _bridge_lean_handle_capacity
  _malloc
  _free
)

build_side() {
  local output_dir=$1
  local library=$2
  local module_name=${library,,}
  emcc \
    "$GENERATED_DIR/$library.c" \
    "$SOURCE_DIR/${module_name}_shim.c" \
    "${SIDE_FLAGS[@]}" \
    -Wl,-Map="$output_dir/$module_name.link.map" \
    -o "$output_dir/$module_name.so.wasm"
}

compile_main_objects() {
  local output_dir=$1
  emcc "${TARGET_FLAGS[@]}" \
    -DBRIDGE_LEAN_RUNTIME_TEST_HOOKS=1 \
    "${INCLUDES[@]}" \
    -c "$SOURCE_DIR/main.c" -o "$output_dir/main.o"
  em++ "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" \
    -I"$RUNTIME_SOURCE/src" \
    -c "$SOURCE_DIR/runtime_lifecycle.cpp" -o "$output_dir/runtime_lifecycle.o"
}

build_main() {
  local output_dir=$1
  shift
  compile_main_objects "$output_dir"
  em++ \
    "$output_dir/main.o" \
    "$output_dir/runtime_lifecycle.o" \
    -Wl,--start-group \
    "$LEAN_INIT" \
    "$LEAN_RUNTIME" \
    -Wl,--end-group \
    "$@" \
    "${MAIN_FLAGS[@]}" \
    -o "$output_dir/main.mjs"
}

for library in "${LEAN_LIBRARIES[@]}"; do
  build_side "$STARTUP_DIR" "$library"
  build_side "$LAZY_DIR" "$library"
done

SIDE_IMPORTS="$AUDIT_DIR/side-function-imports.txt"
SIDE_PROVIDED_SYMBOLS="$AUDIT_DIR/side-provided-symbols.txt"
EXPORT_MANIFEST="$AUDIT_DIR/main-export-manifest.txt"
for library in "${LEAN_LIBRARIES[@]}"; do
  module_name=${library,,}
  wasm-objdump -x "$LAZY_DIR/$module_name.so.wasm"
done \
  | sed -n '/ - func\[/s/.*<env\.\([^>]*\)>.*/_\1/p' \
  | sort -u > "$SIDE_IMPORTS"

for library in "${LEAN_LIBRARIES[@]}"; do
  module_name=${library,,}
  awk 'NR > 1 { print "_" $NF }' "$LAZY_DIR/$module_name.link.map"
done \
  | sed -n '/^_[A-Za-z_][A-Za-z0-9_]*$/p' \
  | sort -u > "$SIDE_PROVIDED_SYMBOLS"

{
  printf '%s\n' "${BRIDGE_EXPORTS[@]}"
  sed -n '/^_/p' "$SIDE_IMPORTS"
} \
  | sort -u \
  | grep -Fvx -f "$SIDE_PROVIDED_SYMBOLS" \
  > "$EXPORT_MANIFEST"
mapfile -t MAIN_EXPORTS < "$EXPORT_MANIFEST"

MAIN_FLAGS=(
  "${TARGET_FLAGS[@]}"
  -sMAIN_MODULE=2
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sENVIRONMENT=node
  -sALLOW_MEMORY_GROWTH=1
  -sEXPORTED_RUNTIME_METHODS=loadDynamicLibrary,HEAP8
  -sEXPORTED_FUNCTIONS="$(IFS=,; printf '%s' "${MAIN_EXPORTS[*]}")"
  -Wl,--no-entry
  "${INCLUDES[@]}"
)
if [[ "$LEAN_WASM_RUNTIME_PROFILE" == threaded ]]; then
  MAIN_FLAGS+=(-sPTHREAD_POOL_SIZE=0)
fi

build_main \
  "$STARTUP_DIR" \
  "$STARTUP_DIR/alpha.so.wasm" \
  "$STARTUP_DIR/beta.so.wasm" \
  "$STARTUP_DIR/gamma.so.wasm"
build_main "$LAZY_DIR"

compile_main_objects "$FINAL_STATIC_DIR"
FINAL_STATIC_OBJECTS=()
PROJECT_GENERATED_DIR=${GENERATED_DIR#"$LEAN_WASM_PROJECT_ROOT/"}
PROJECT_SOURCE_DIR=${SOURCE_DIR#"$LEAN_WASM_PROJECT_ROOT/"}
for library in "${LEAN_LIBRARIES[@]}"; do
  module_name=${library,,}
  (
    cd "$LEAN_WASM_PROJECT_ROOT"
    emcc "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" \
      -c "$PROJECT_GENERATED_DIR/$library.c" \
      -o "$FINAL_STATIC_DIR/$module_name.generated.o"
    emcc "${TARGET_FLAGS[@]}" "${INCLUDES[@]}" \
      -c "$PROJECT_SOURCE_DIR/${module_name}_shim.c" \
      -o "$FINAL_STATIC_DIR/$module_name.shim.o"
  )
  FINAL_STATIC_OBJECTS+=(
    "$FINAL_STATIC_DIR/$module_name.generated.o"
    "$FINAL_STATIC_DIR/$module_name.shim.o"
  )
done

FINAL_STATIC_FLAGS=(
  "${TARGET_FLAGS[@]}"
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sENVIRONMENT=node
  -sALLOW_MEMORY_GROWTH=1
  -sEXPORTED_RUNTIME_METHODS=HEAP8
  -sEXPORTED_FUNCTIONS="$(IFS=,; printf '%s' "${BRIDGE_EXPORTS[*]}")"
  -Wl,--export-table
  -Wl,--no-entry
  -Wl,-Map="$FINAL_STATIC_DIR/main.link.map"
  "${INCLUDES[@]}"
)
if [[ "$LEAN_WASM_RUNTIME_PROFILE" == threaded ]]; then
  FINAL_STATIC_FLAGS+=(-sPTHREAD_POOL_SIZE=0)
fi

em++ \
  "$FINAL_STATIC_DIR/main.o" \
  "$FINAL_STATIC_DIR/runtime_lifecycle.o" \
  "${FINAL_STATIC_OBJECTS[@]}" \
  -Wl,--start-group \
  "$LEAN_INIT" \
  "$LEAN_RUNTIME" \
  -Wl,--end-group \
  "${FINAL_STATIC_FLAGS[@]}" \
  -o "$FINAL_STATIC_DIR/main.mjs"

MODULES=(
  "$STARTUP_DIR/main.wasm"
  "$LAZY_DIR/main.wasm"
  "$FINAL_STATIC_DIR/main.wasm"
)
for profile_dir in "$STARTUP_DIR" "$LAZY_DIR"; do
  for library in "${LEAN_LIBRARIES[@]}"; do
    module_name=${library,,}
    MODULES+=("$profile_dir/$module_name.so.wasm")
  done
done

for module in "${MODULES[@]}"; do
  # Lean's pinned Emscripten path currently emits legacy exception opcodes.
  wasm-tools validate --features all "$module"
  name=$(basename "$(dirname "$module")")-$(basename "$module")
  wasm-objdump -x "$module" > "$AUDIT_DIR/$name.objdump.txt"
done

(
  cd "$BUILD_DIR"
  RELATIVE_MODULES=()
  for module in "${MODULES[@]}"; do
    RELATIVE_MODULES+=("${module#"$BUILD_DIR/"}")
  done
  sha256sum "${RELATIVE_MODULES[@]}"
) > "$AUDIT_DIR/sha256.txt"
node "$LEAN_WASM_PROJECT_ROOT/scripts/verify-lean-artifacts.mjs" \
  --lock "$GRAPH_LOCK" \
  --build-root "$BUILD_DIR" \
  --target "$LEAN_WASM_RUNTIME_PROFILE" \
  > "$AUDIT_DIR/artifact-manifest.json"

printf 'Built Lean link spike profile %s in %s\n' "$LEAN_WASM_RUNTIME_PROFILE" "$BUILD_DIR"
