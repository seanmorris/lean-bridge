#!/usr/bin/env bash
# Reproduce, install, relocate and check both generic Subtype C-family routes.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-generic-subtype-native-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_TEST LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_PROFILES \
  LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_ROUTES LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted generic Subtype native acceptance requires its fixed matrix.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/generic-subtype-native-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_TEST=1
export LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_PROFILES=c,cpp
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for route in ordinary reviewed; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_ROUTES="$route"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_OUTPUT="$output/records"
  name="installed native generic Subtype compositions reproduce and relocate $route full"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/nominal-subtype-native-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-generic-subtype-native-perl-ci.mjs --kind native --route "$route" \
    --producer "$revision" --directory "$output/records/$route/full" | tee "$output/verification.json"
done
