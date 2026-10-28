#!/usr/bin/env bash
# Reproduce and relocate generic Subtype gems on the pinned Ruby runtime.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || ! -x $1 || ! -x $2 ]]; then
  printf '%s\n' 'Usage: run-generic-subtype-ruby-ci.sh /absolute/ruby /absolute/gem' >&2
  exit 2
fi
for name in LEAN_BRIDGE_GENERIC_SUBTYPE_RUBY_TEST LEAN_BRIDGE_GENERIC_SUBTYPE_RUBY_ROUTES \
  LEAN_BRIDGE_GENERIC_SUBTYPE_RUBY_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted generic Subtype Ruby acceptance requires its fixed matrix.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/generic-subtype-ruby-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_GENERIC_SUBTYPE_RUBY_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_BRIDGE_RUBY="$1"
export LEAN_BRIDGE_GEM="$2"
for route in ordinary reviewed; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_RUBY_ROUTES="$route"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_RUBY_OUTPUT="$output/records"
  name="installed generic Subtype Ruby compositions reproduce and relocate $route full"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/nominal-subtype-ruby-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-generic-subtype-language-ci.mjs --language ruby --route "$route" \
    --producer "$revision" --directory "$output/records/$route/full" --tap "$output/run.tap" \
    | tee "$output/verification.json"
done

LEAN_BRIDGE_REVIEWED_SPECIALIZATION_TEST=1 \
LEAN_BRIDGE_REVIEWED_SPECIALIZATION_PROFILES=ruby \
LEAN_BRIDGE_REVIEWED_SPECIALIZATION_REPORT="$output_root/reviewed-specializations.json" \
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern='^independently reviewed native packages install every chosen specialization without its generic$' \
    tests/reviewed-specializations.test.mjs 2>&1 | tee "$output_root/reviewed-specializations.tap"
test -s "$output_root/reviewed-specializations.json"
test "$(git rev-parse HEAD)" = "$revision"
