#!/usr/bin/env bash
# Reproduce every closed value-index route and run all browser contexts.
set -euo pipefail

if [[ $# != 1 || $1 != /* ]]; then
  printf '%s\n' 'Usage: run-checked-record-value-index-browser-ci.sh /absolute/wasm-runtime' >&2
  exit 2
fi
for variable in LEAN_BRIDGE_LAKE_RUNTIME_ROOT LEAN_BRIDGE_VALUE_INDEX_NPM_TEST LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST LEAN_BRIDGE_VALUE_INDEX_ROUTES LEAN_BRIDGE_VALUE_INDEX_BROWSER_OUTPUT LEAN_BRIDGE_TYPE_CORPUS_BROWSERS; do
  if [[ -v $variable ]]; then
    printf '%s\n' "Value-index browser CI refuses preset $variable." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/checked-record-value-index-browser-ci
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_LAKE_RUNTIME_ROOT="$1"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 EMCC_CORES=1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_VALUE_INDEX_NPM_TEST=1
export LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST=1
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit
export LEAN_BRIDGE_VALUE_INDEX_BROWSER_OUTPUT="$output_root/records"

for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_VALUE_INDEX_ROUTES="$route"
  node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-before.json"
  name="installed value-index records reproduce, relocate and reach browsers for $route"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/checked-record-value-index-browser-installed-tests.mjs \
    2>&1 | tee "$output/acceptance.tap"
  env -u LEAN_BRIDGE_VALUE_INDEX_NPM_TEST \
    -u LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST \
    -u LEAN_BRIDGE_VALUE_INDEX_ROUTES \
    -u LEAN_BRIDGE_VALUE_INDEX_BROWSER_OUTPUT \
    -u LEAN_BRIDGE_TYPE_CORPUS_BROWSERS \
    node --test --test-concurrency=1 --test-reporter=tap \
    tests/checked-record-value-index-browser.test.mjs \
    2>&1 | tee "$output/controls.tap"
  node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-after.json"
  cmp "$output/runtime-before.json" "$output/runtime-after.json"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-checked-record-value-index-browser-ci.mjs \
    --route "$route" --producer "$revision" --npm-checker "$revision" \
    --consumer "$revision" --checker "$revision" \
    --directory "$output_root/records/$route" \
    --acceptance-tap "$output/acceptance.tap" \
    --controls-tap "$output/controls.tap" --runtime "$output/runtime-before.json" \
    2>&1 | tee "$output/verification.json"
done
