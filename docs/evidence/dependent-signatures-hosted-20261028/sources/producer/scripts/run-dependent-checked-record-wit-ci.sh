#!/usr/bin/env bash
# Reproduce all dependent checked-record checked-record WIT packages and authenticate original installed executions.
set -euo pipefail

if [[ $# != 3 || $1 != /* || $2 != /* || $3 != /* ]]; then
  printf '%s\n' 'Usage: run-dependent-checked-record-wit-ci.sh /absolute/cc /absolute/wasm-tools /absolute/wasmtime-capi' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_TEST \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_ROUTES \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_MODES \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_OUTPUT \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted dependent checked-record checked-record WIT acceptance selects all selections and the glibc 2.38 floor itself.' >&2
    exit 2
  fi
done

CC=$(readlink -e -- "$1")
LEAN_BRIDGE_WASM_TOOLS=$(readlink -e -- "$2")
LEAN_BRIDGE_WASMTIME_C_API=$(readlink -e -- "$3")
test -x "$CC"
test -x "$LEAN_BRIDGE_WASM_TOOLS"
test -d "$LEAN_BRIDGE_WASMTIME_C_API"
export CC LEAN_BRIDGE_WASM_TOOLS LEAN_BRIDGE_WASMTIME_C_API
revision=$(git rev-parse HEAD)
output_root=build/dependent-checked-record-wit-ci
# Never overwrite a prior complete or partial attempt.
mkdir -p build
mkdir "$output_root"
mkdir "$output_root/verification"
node scripts/select-nominal-subtype-wit-ci-tools.mjs "$CC" "$LEAN_BRIDGE_WASM_TOOLS" "$LEAN_BRIDGE_WASMTIME_C_API" "$output_root" \
  | tee "$output_root/tools.json"
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_ROUTES="$route"
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_OUTPUT="$output/records"
  case "$route" in
    result-only-*) mode=result-only ;;
    *) mode=full ;;
  esac
  name="installed dependent checked records reproduce and relocate in WIT for $route"
  node --max-old-space-size=3072 --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/dependent-checked-record-wit-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  node --max-old-space-size=3072 scripts/check-dependent-checked-record-wit-ci.mjs --route "$route" --mode "$mode" \
    --producer "$revision" --directory "$output/records/$route" \
    --tap "$output/run.tap" --glibc 2.38 --cc "$CC" \
    --wasm-tools "$LEAN_BRIDGE_WASM_TOOLS" --wasmtime-capi "$LEAN_BRIDGE_WASMTIME_C_API" \
    | tee "$output/verification.json" "$output_root/verification/$route.json"
done
