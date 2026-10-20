#!/usr/bin/env bash
# Run both callback Subtype author routes through Node and every browser context.
set -euo pipefail

if [[ $# != 1 || $1 != /* ]]; then
  printf '%s\n' 'Usage: run-callback-subtype-browser-ci.sh /absolute/wasm-runtime' >&2
  exit 2
fi
for variable in LEAN_BRIDGE_LAKE_RUNTIME_ROOT LEAN_BRIDGE_CALLBACK_SUBTYPE_NPM_TEST LEAN_BRIDGE_CALLBACK_SUBTYPE_BROWSER_TEST LEAN_BRIDGE_CALLBACK_SUBTYPE_BROWSER_OUTPUT LEAN_BRIDGE_TYPE_CORPUS_BROWSERS; do
  if [[ -v $variable ]]; then
    printf '%s\n' "Callback Subtype browser CI refuses preset $variable." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output=build/callback-subtype-browser-ci
mkdir -p build
mkdir "$output"
export LEAN_BRIDGE_LAKE_RUNTIME_ROOT="$1"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 EMCC_CORES=1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_CALLBACK_SUBTYPE_NPM_TEST=1
export LEAN_BRIDGE_CALLBACK_SUBTYPE_BROWSER_TEST=1
export LEAN_BRIDGE_CALLBACK_SUBTYPE_BROWSER_OUTPUT="$PWD/$output/records"
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit

node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-before.json"
name='callback Subtypes install from reproducible ordinary and reviewed npm builds'
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/callback-subtype-npm-browser.test.mjs 2>&1 | tee "$output/acceptance.tap"
node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-after.json"
cmp "$output/runtime-before.json" "$output/runtime-after.json"
test "$(git rev-parse HEAD)" = "$revision"
node scripts/check-callback-subtype-browser-ci.mjs \
  --producer "$revision" --tap "$output/acceptance.tap" \
  --runtime "$output/runtime-before.json" --records "$output/records" \
  2>&1 | tee "$output/verification.json"
