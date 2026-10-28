#!/usr/bin/env bash
# Build twice, retain closed archives, and execute relocated C/C++ consumers.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-optional-parameter-native-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_TEST \
  LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_ROUTES \
  LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_OUTPUT \
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted optional-parameter native acceptance owns its complete selection.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
root=build/optional-parameter-native-ci
mkdir -p build
mkdir "$root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38

for route in ordinary reviewed; do
  output="$root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_ROUTES="$route"
  export LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^installed optional-parameter native packages reproduce and relocate $route\$" \
    tests/optional-parameter-native-installed.test.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-optional-parameter-native-ci.mjs \
    --route "$route" --producer "$revision" \
    --directory "$output/records" --tap "$output/run.tap" \
    > "$output/verified.json"
done
