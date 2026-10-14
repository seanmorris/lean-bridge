#!/usr/bin/env bash
# Retain all four source-free selections across all three browser engines.
set -euo pipefail

if [[ $# != 1 || $1 != /* ]]; then
  printf '%s\n' 'Usage: run-nominal-primitive-subtype-browser-ci.sh /absolute/wasm-runtime' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_LAKE_RUNTIME_ROOT ]]; then
  printf '%s\n' 'Nominal browser acceptance requires one explicit runtime path without an environment override.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/nominal-primitive-subtype-browser-ci
mkdir -p build
# Refuse stale outputs before starting a producer or opening an original log.
mkdir "$output_root"
export LEAN_BRIDGE_LAKE_RUNTIME_ROOT="$1"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 EMCC_CORES=1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST=1
export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST=1
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT="$output/records"
    node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-before.json"
    name="installed npm primitive-base nominal Subtypes reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-after.json"
    cmp "$output/runtime-before.json" "$output/runtime-after.json"
    test "$(git rev-parse HEAD)" = "$revision"
    node scripts/check-nominal-primitive-subtype-browser-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --runtime "$output/runtime-before.json" 2>&1 | tee "$output/verification.json"
  done
done
