#!/usr/bin/env bash
# Reproduce both npm archives, then check source-free installation and relocation.
set -euo pipefail

if [[ $# != 1 || $1 != /* ]]; then
  printf '%s\n' 'Usage: run-nominal-primitive-subtype-npm-ci.sh /absolute/wasm-runtime' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_LAKE_RUNTIME_ROOT ]]; then
  printf '%s\n' 'Nominal npm acceptance requires one explicit runtime path without an environment override.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/nominal-primitive-subtype-npm-ci
# Refuse stale or partial output before starting a producer or opening its log.
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_LAKE_RUNTIME_ROOT="$1"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 EMCC_CORES=1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST=1
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT="$output/records"
    name="installed npm primitive-base nominal Subtypes reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nominal-primitive-subtype-npm-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" | tee "$output/verification.json"
  done
done
