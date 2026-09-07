#!/usr/bin/env bash
set -euo pipefail

DEMO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPOSITORY_ROOT=$(cd "$DEMO_ROOT/../.." && pwd)
source "$REPOSITORY_ROOT/scripts/env.sh"
source "$REPOSITORY_ROOT/scripts/lean-runtime-config.sh"
BUILD_DIR="$REPOSITORY_ROOT/build/demos/lean-a-star"
GENERATED_DIR="$BUILD_DIR/generated"
RUNTIME_ROOT="$REPOSITORY_ROOT/build/lean-runtime/$LEAN_WASM_RUNTIME_BUILD_ID"
RUNTIME_BUILD="$RUNTIME_ROOT/cmake"
RUNTIME_SOURCE="$RUNTIME_ROOT/source"
OUTPUT_DIR="$DEMO_ROOT/runtime"

if [[ ! -f "$RUNTIME_BUILD/lib/lean/libInit.a" || ! -f "$RUNTIME_BUILD/lib/lean/libleanrt.a" ]]; then
  bash "$REPOSITORY_ROOT/scripts/build-lean-runtime.sh"
fi
mkdir -p "$GENERATED_DIR" "$OUTPUT_DIR"
# Publish the exact shared graph specification and path lemmas with this demo.
# Their maintained sources are in lean-dijkstra, not these generated copies.
cp "$DEMO_ROOT/../lean-dijkstra/DijkstraCore.lean" "$DEMO_ROOT/DijkstraCore.lean"
cp "$DEMO_ROOT/../lean-dijkstra/Dijkstra.lean" "$DEMO_ROOT/Dijkstra.lean"
MODULES=(DijkstraCore Dijkstra AStarCore AStarPotential AStarChecks AStarTotal AStar)
for module in "${MODULES[@]}"; do
  LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$DEMO_ROOT" \
    -o "$GENERATED_DIR/$module.olean" -c "$GENERATED_DIR/$module.c" "$DEMO_ROOT/$module.lean"
done
LEAN_PATH="$GENERATED_DIR${LEAN_PATH:+:$LEAN_PATH}" lean -R "$DEMO_ROOT" "$DEMO_ROOT/Tests.lean"
node "$DEMO_ROOT/generate-proof-audit.mjs"
INCLUDES=(-I"$GENERATED_DIR" -I"$RUNTIME_BUILD/include" -I"$RUNTIME_SOURCE/src/include")
OBJECTS=()
for module in "${MODULES[@]}"; do
  emcc -O3 "${LEAN_WASM_PROFILE_CC_FLAGS[@]}" "${INCLUDES[@]}" \
    -c "$GENERATED_DIR/$module.c" -o "$BUILD_DIR/$module.o"
  OBJECTS+=("$BUILD_DIR/$module.o")
done
emcc -O3 "${LEAN_WASM_PROFILE_CC_FLAGS[@]}" "${INCLUDES[@]}" \
  -c "$DEMO_ROOT/bridge.c" -o "$BUILD_DIR/bridge.o"
em++ "${OBJECTS[@]}" "$BUILD_DIR/bridge.o" \
  -Wl,--start-group "$RUNTIME_BUILD/lib/lean/libInit.a" "$RUNTIME_BUILD/lib/lean/libleanrt.a" -Wl,--end-group \
  -O3 "${LEAN_WASM_PROFILE_CC_FLAGS[@]}" "${INCLUDES[@]}" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,node -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_RUNTIME_METHODS=HEAPU8,HEAPU32 \
  -sEXPORTED_FUNCTIONS=_lean_astar_runtime_init,_lean_astar_prepare_c,_lean_astar_run,_lean_astar_release,_malloc,_free \
  -Wl,--no-entry -o "$OUTPUT_DIR/lean-a-star.mjs"
wasm-tools validate --features all "$OUTPUT_DIR/lean-a-star.wasm"
printf 'Built the proven Lean A* browser module in %s\n' "$OUTPUT_DIR"
