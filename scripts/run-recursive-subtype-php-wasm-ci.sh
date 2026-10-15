#!/usr/bin/env bash
# Compile both source routes and preserve their complete PHP-Wasm package handoffs.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-recursive-subtype-php-wasm-ci.sh' >&2
  exit 2
fi
for name in \
  LEAN_BRIDGE_RECURSIVE_SUBTYPE_SOURCE_TEST \
  LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_TEST \
  LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_OUTPUT \
  LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_HANDOFF; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted recursive Subtype acceptance selects both source routes and its own output directories.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/recursive-subtype-php-wasm-ci
mkdir -p build
# Refuse stale output before starting a producer or opening an original log.
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1

node --test --test-concurrency=1 --test-reporter=tap \
  tests/recursive-subtype-php-wasm.test.mjs 2>&1 | tee "$output_root/static.tap"

LEAN_BRIDGE_RECURSIVE_SUBTYPE_SOURCE_TEST=1 \
node --test --test-concurrency=1 --test-reporter=tap \
  --test-name-pattern='^fresh Lean compiles the (ordinary|reviewed) recursive Subtype graph adapters$' \
  tests/recursive-subtype-php-wasm.test.mjs 2>&1 | tee "$output_root/source.tap"

for route in ordinary reviewed; do
  output="$output_root/$route"
  mkdir -p "$output/records" "$output/handoffs"
  export LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_OUTPUT="$output/records"
  export LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_HANDOFF="$output/handoffs"
  name="$route recursive Subtype PHP-Wasm packages reproduce, relocate and recover"
  LEAN_BRIDGE_RECURSIVE_SUBTYPE_PHP_WASM_TEST=1 \
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/recursive-subtype-php-wasm.test.mjs 2>&1 | tee "$output/run.tap"
  test -s "$output/records/$route.json"
  test -s "$output/handoffs/$route/package-set-receipt.json"
  test "$(git rev-parse HEAD)" = "$revision"
  git diff --quiet HEAD --
done
