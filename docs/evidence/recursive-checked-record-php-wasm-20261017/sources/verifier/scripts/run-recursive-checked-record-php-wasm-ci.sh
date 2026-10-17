#!/usr/bin/env bash
# Reproduce every recursive checked-record PHP-Wasm selection, then authenticate it.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-recursive-checked-record-php-wasm-ci.sh' >&2
  exit 2
fi
for name in \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_TEST \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_ROUTES \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_FIXTURES \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_OUTPUT \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted recursive checked-record PHP-Wasm acceptance selects all routes, fixtures, and the default load ceiling.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/recursive-checked-record-php-wasm-ci
mkdir -p build
# Refuse stale output before starting a producer or opening an original log.
mkdir "$output_root"
export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_TEST=1
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for fixture in recursive mutual; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$fixture"
    mkdir "$output"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_ROUTES="$route"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_FIXTURES="$fixture"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_WASM_OUTPUT="$output/records"
    node scripts/snapshot-nominal-subtype-php-wasm-ci.mjs > "$output/runtime-before.json" 2> "$output/runtime-before.log"
    name="installed recursive checked-record PHP-Wasm packages reproduce and relocate $route $fixture"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/recursive-checked-record-php-wasm-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/snapshot-nominal-subtype-php-wasm-ci.mjs > "$output/runtime-after.json" 2> "$output/runtime-after.log"
    cmp "$output/runtime-before.json" "$output/runtime-after.json"
    test "$(git rev-parse HEAD)" = "$revision"
    git diff --quiet HEAD --
    node scripts/check-recursive-checked-record-php-wasm-ci.mjs \
      --route "$route" --fixture "$fixture" --producer "$revision" \
      --directory "$output/records/$route/$fixture" --tap "$output/run.tap" \
      --runtime "$output/runtime-before.json" 2>&1 | tee "$output/verification.json"
  done
done
