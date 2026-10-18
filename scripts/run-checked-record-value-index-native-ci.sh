#!/usr/bin/env bash
# Reproduce every closed value-index route in independent C and C++ consumers.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-checked-record-value-index-native-ci.sh' >&2
  exit 2
fi
for variable in LEAN_BRIDGE_VALUE_INDEX_NATIVE_TEST LEAN_BRIDGE_VALUE_INDEX_NATIVE_ROUTES LEAN_BRIDGE_VALUE_INDEX_NATIVE_OUTPUT LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR; do
  if [[ -v $variable ]]; then
    printf '%s\n' "Value-index native CI refuses preset $variable." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/checked-record-value-index-native-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_VALUE_INDEX_NATIVE_TEST=1
export LEAN_BRIDGE_VALUE_INDEX_NATIVE_OUTPUT="$output_root/records"
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38

for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_VALUE_INDEX_NATIVE_ROUTES="$route"
  node scripts/snapshot-checked-record-value-index-native.mjs > "$output/runtime-before.json"
  name="installed value-index records reproduce and relocate in C/C++ for $route"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^${name//+/\\+}$" \
    tests/helpers/checked-record-value-index-native-installed-tests.mjs \
    2>&1 | tee "$output/acceptance.tap"
  env -u LEAN_BRIDGE_VALUE_INDEX_NATIVE_TEST \
    -u LEAN_BRIDGE_VALUE_INDEX_NATIVE_ROUTES \
    -u LEAN_BRIDGE_VALUE_INDEX_NATIVE_OUTPUT \
    -u LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
    node --test --test-concurrency=1 --test-reporter=tap \
    tests/checked-record-value-index-native.test.mjs \
    2>&1 | tee "$output/controls.tap"
  node scripts/snapshot-checked-record-value-index-native.mjs > "$output/runtime-after.json"
  cmp "$output/runtime-before.json" "$output/runtime-after.json"
  cmp "$output/runtime-before.json" "$output_root/records/$route/runtime.json"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-checked-record-value-index-native-ci.mjs \
    --route "$route" --producer "$revision" --consumer "$revision" \
    --checker "$revision" --directory "$output_root/records/$route" \
    --acceptance-tap "$output/acceptance.tap" \
    --controls-tap "$output/controls.tap" \
    --runtime "$output/runtime-before.json" --floor 2.38 \
    | tee "$output/verification.json"
done
