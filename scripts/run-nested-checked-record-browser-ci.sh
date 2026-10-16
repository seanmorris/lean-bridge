#!/usr/bin/env bash
# Reproduce all four nested checked-record npm selections and run every browser context.
set -euo pipefail

if [[ $# != 1 || $1 != /* ]]; then
  printf '%s\n' 'Usage: run-nested-checked-record-browser-ci.sh /absolute/wasm-runtime' >&2
  exit 2
fi
for variable in LEAN_BRIDGE_LAKE_RUNTIME_ROOT LEAN_BRIDGE_NESTED_CHECKED_RECORD_NPM_OUTPUT LEAN_BRIDGE_NESTED_CHECKED_RECORD_NPM_ROUTES LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_OUTPUT LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_ROUTES LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_CONTROL_ROUTES; do
  if [[ -v $variable ]]; then
    printf '%s\n' "Nested checked-record browser CI refuses preset $variable." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/nested-checked-record-browser-ci
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_LAKE_RUNTIME_ROOT="$1"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 EMCC_CORES=1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_NPM_TEST=1
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_TEST=1
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_CONTROLS_TEST=1
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_NPM_OUTPUT="$output_root/records"
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_OUTPUT="$output_root/records"

for route in ordinary-full ordinary-result-only reviewed-full reviewed-result-only; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_NESTED_CHECKED_RECORD_NPM_ROUTES="$route"
  export LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_ROUTES="$route"
  export LEAN_BRIDGE_NESTED_CHECKED_RECORD_BROWSER_CONTROL_ROUTES="$route"
  node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-before.json"
  name="installed nested checked-record npm package reproduces and relocates $route"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/nested-checked-record-npm-installed-tests.mjs 2>&1 | tee "$output/npm.tap"
  node --test --test-concurrency=1 --test-reporter=tap \
    tests/nested-checked-record-browser.test.mjs 2>&1 | tee "$output/browser.tap"
  node --test --test-concurrency=1 --test-reporter=tap \
    tests/nested-checked-record-browser-controls.test.mjs 2>&1 | tee "$output/controls.tap"
  node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-after.json"
  cmp "$output/runtime-before.json" "$output/runtime-after.json"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-nested-checked-record-browser-ci.mjs \
    --route "$route" --producer "$revision" --npm-checker "$revision" \
    --consumer "$revision" --checker "$revision" \
    --directory "$output_root/records/$route" --npm-tap "$output/npm.tap" \
    --browser-tap "$output/browser.tap" --controls-tap "$output/controls.tap" \
    --runtime "$output/runtime-before.json" 2>&1 | tee "$output/verification.json"
done
