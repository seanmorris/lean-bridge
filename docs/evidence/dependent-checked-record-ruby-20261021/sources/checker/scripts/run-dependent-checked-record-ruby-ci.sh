#!/usr/bin/env bash
# Reproduce each closed Ruby gem selection in two roots, then install and
# relocate it offline before independently checking the original records.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-dependent-checked-record-ruby-ci.sh /absolute/ruby3.3 /absolute/gem' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR LEAN_BRIDGE_RUBY LEAN_BRIDGE_GEM \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_ROUTES \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_MODES LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_OUTPUT \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted dependent checked-record Ruby acceptance requires its selected interpreter, every route, and glibc 2.38.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/dependent-checked-record-ruby-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_RUBY="$1" LEAN_BRIDGE_GEM="$2"
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_ROUTES="$route"
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_OUTPUT="$output/records"
  name="installed dependent checked-record Ruby packages reproduce and relocate $route"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^${name//+/\\+}$" \
    tests/helpers/dependent-checked-record-ruby-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  cp "$output/run.tap" "$output/records/$route/run.tap"
  node scripts/check-dependent-checked-record-ruby-ci.mjs --route "$route" \
    --producer "$revision" --directory "$output/records/$route" \
    --tap "$output/records/$route/run.tap" --glibc 2.38 --ruby "$LEAN_BRIDGE_RUBY" \
    | tee "$output/verification.json"
done
