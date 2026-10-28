#!/usr/bin/env bash
# Build twice, retain closed archives, and execute the relocated WIT package.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-optional-parameter-wit-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_TEST \
  LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_ROUTES \
  LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted optional-parameter WIT acceptance owns its complete selection.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
root=build/optional-parameter-wit-ci
mkdir -p build
mkdir "$root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_TEST=1
: "${LEAN_BRIDGE_WASM_TOOLS:=$PWD/.toolchains/wasm-tools/bin/wasm-tools}"
export LEAN_BRIDGE_WASM_TOOLS

for route in ordinary reviewed; do
  output="$root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_ROUTES="$route"
  export LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^installed optional-parameter WIT package reproduces and relocates $route\$" \
    tests/optional-parameter-wit-installed.test.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-optional-parameter-wit-ci.mjs \
    --route "$route" --producer "$revision" \
    --directory "$output/records" --tap "$output/run.tap" \
    > "$output/verified.json"
done
