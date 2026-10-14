#!/usr/bin/env bash
# Require all four nominal selections and preserve complete or partial originals.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-nominal-subtype-php-wasm-ci.sh' >&2
  exit 2
fi
revision=$(git rev-parse HEAD)
output_root=build/nominal-subtype-php-wasm-ci
mkdir -p build
# Refuse stale output before starting a producer or opening an original log.
mkdir "$output_root"
export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_TEST=1
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1
for route in ordinary reviewed; do
  for mode in full result-only; do
    output="$output_root/$route/$mode"
    mkdir -p "$output"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_OUTPUT="$output/records"
    node scripts/snapshot-nominal-subtype-php-wasm-ci.mjs > "$output/runtime-before.json" 2> "$output/runtime-before.log"
    node --test --test-concurrency=1 --test-reporter=tap \
      tests/helpers/nominal-subtype-php-wasm-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/snapshot-nominal-subtype-php-wasm-ci.mjs > "$output/runtime-after.json" 2> "$output/runtime-after.log"
    cmp "$output/runtime-before.json" "$output/runtime-after.json"
    test "$(git rev-parse HEAD)" = "$revision"
    git diff --quiet HEAD --
    node scripts/check-nominal-subtype-php-wasm-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" --tap "$output/run.tap" \
      --runtime "$output/runtime-before.json" 2>&1 | tee "$output/check.log"
  done
done
