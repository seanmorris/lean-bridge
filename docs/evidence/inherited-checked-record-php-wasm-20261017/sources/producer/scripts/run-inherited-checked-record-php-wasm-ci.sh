#!/usr/bin/env bash
# Reproduce every inherited checked-record PHP-Wasm selection, then authenticate it.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-inherited-checked-record-php-wasm-ci.sh' >&2
  exit 2
fi
for name in \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_TEST \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_ROUTES \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_MODES \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_OUTPUT \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted inherited checked-record PHP-Wasm acceptance selects all routes, modes, and the default load ceiling.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/inherited-checked-record-php-wasm-ci
mkdir -p build
# Refuse stale output before starting a producer or opening an original log.
mkdir "$output_root"
export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_TEST=1
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for route in ordinary reviewed; do
  for mode in full result-only; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_ROUTES="$route"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_MODES="$mode"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PHP_WASM_OUTPUT="$output/records"
    node scripts/snapshot-nominal-subtype-php-wasm-ci.mjs > "$output/runtime-before.json" 2> "$output/runtime-before.log"
    name="installed inherited checked-record PHP-Wasm packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/inherited-checked-record-php-wasm-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/snapshot-nominal-subtype-php-wasm-ci.mjs > "$output/runtime-after.json" 2> "$output/runtime-after.log"
    cmp "$output/runtime-before.json" "$output/runtime-after.json"
    test "$(git rev-parse HEAD)" = "$revision"
    git diff --quiet HEAD --
    node scripts/check-inherited-checked-record-php-wasm-ci.mjs \
      --route "$route" --mode "$mode" --producer "$revision" \
      --directory "$output/records/$route/$mode" --tap "$output/run.tap" \
      --runtime "$output/runtime-before.json" 2>&1 | tee "$output/verification.json"
  done
done
