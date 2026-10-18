#!/usr/bin/env bash
# Reproduce ordinary and reviewed mutual checked-record C/C++ packages.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-mutual-checked-record-native-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_TEST \
  LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_ROUTES \
  LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted mutual checked-record acceptance fixes both routes and the glibc 2.38 floor.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/mutual-checked-record-native-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_OUTPUT="$output_root/records"
for route in ordinary reviewed; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_ROUTES="$route"
  name="installed mutual checked-record C/C++ packages reproduce and relocate $route"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/mutual-checked-record-native-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-mutual-checked-record-native-ci.mjs --route "$route" \
    --producer "$revision" --directory "$output_root/records/$route" \
    --tap "$output/run.tap" | tee "$output/verification.json"
done
