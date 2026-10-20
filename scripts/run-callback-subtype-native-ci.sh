#!/usr/bin/env bash
# Require both callback directions and both author routes in installed C/C++ packages.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-callback-subtype-native-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_PROFILES \
  LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_OUTPUT \
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR; do
  if [[ -v $name ]]; then
    printf '%s\n' "Hosted callback Subtype native acceptance refuses preset $name." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output=build/callback-subtype-native-ci
mkdir -p build
mkdir "$output"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_PROFILES=c,cpp
export LEAN_BRIDGE_CALLBACK_SUBTYPE_NATIVE_OUTPUT="$PWD/$output/report.json"
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38

name='ordinary and reviewed C-family callback Subtypes install from source-free archives'
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/callback-subtype-native-installed.test.mjs 2>&1 | tee "$output/acceptance.tap"
test "$(git rev-parse HEAD)" = "$revision"
node scripts/check-callback-subtype-native-ci.mjs \
  --producer "$revision" --tap "$output/acceptance.tap" --report "$output/report.json" \
  2>&1 | tee "$output/verification.json"
