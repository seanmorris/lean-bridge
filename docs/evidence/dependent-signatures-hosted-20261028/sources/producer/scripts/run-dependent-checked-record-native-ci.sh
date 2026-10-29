#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-dependent-checked-record-native-ci.sh' >&2
  exit 2
fi
for variable in LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_TEST LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_ROUTES LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_OUTPUT LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR; do
  if [[ -v $variable ]]; then
    printf '%s\n' "Dependent checked-record native CI refuses preset $variable." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/dependent-checked-record-native-ci
records="$output_root/records"
mkdir -p build
mkdir "$output_root"
mkdir "$output_root/verification"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_TEST=1
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_OUTPUT="$records"
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38

for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_ROUTES="$route"
  node --test --test-concurrency=1 --test-reporter=tap \
    tests/helpers/dependent-checked-record-native-installed-tests.mjs \
    2>&1 | tee "$output_root/$route.tap"
  test -s "$records/$route/report.json"
  node scripts/check-dependent-checked-record-native-ci.mjs \
    --route "$route" --producer "$revision" --checker "$revision" \
    --directory "$records/$route" --tap "$output_root/$route.tap" \
    --floor 2.38 >"$output_root/verification/$route.json"
  test "$(git rev-parse HEAD)" = "$revision"
done
