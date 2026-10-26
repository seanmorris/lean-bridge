#!/usr/bin/env bash
# Measure constructor/source dispatch in installed C packages and classify C++/result-only explicitly.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-nominal-subtype-entry-native-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_TEST \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_PROFILES \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_ROUTES \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_MODES \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_OUTPUT \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_DISPATCH; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted native entry measurement requires its complete fixed matrix.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/nominal-subtype-entry-native-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_TEST=1
export LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_PROFILES=c,cpp
export LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_DISPATCH=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for route in ordinary reviewed; do
  mkdir -p "$output_root/$route"
  for mode in full result-only; do
    output="$output_root/$route/$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_OUTPUT="$output/records"
    name="installed native nominal Subtypes reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-subtype-native-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    test "$(git rev-parse HEAD)" = "$revision"
    node scripts/check-nominal-subtype-entry-native-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --floor 2.38 2>&1 | tee "$output/check.log"
  done
done
