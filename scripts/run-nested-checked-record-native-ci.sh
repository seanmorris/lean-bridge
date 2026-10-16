#!/usr/bin/env bash
# Reproduce both native packages and require C/C++ callers in all four selections.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-nested-checked-record-native-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_TEST \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_PROFILES \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_ROUTES \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_MODES \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_MAX_LOAD \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted nested checked-record acceptance requires both profiles, all selections, load ceiling 12 and the glibc 2.38 floor.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/nested-checked-record-native-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_MAX_LOAD=12
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_ROUTES="$route"
    export LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_MODES="$mode"
    export LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_OUTPUT="$output/records"
    name="installed nested checked-record native packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nested-checked-record-native-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nested-checked-record-native-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 --max-load 12 | tee "$output/verification.json"
  done
done
