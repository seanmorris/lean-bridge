#!/usr/bin/env bash
# Reproduce each selected gem in two roots, then install and relocate it offline.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-recursive-checked-record-ruby-ci.sh /absolute/ruby3.3 /absolute/gem' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_RUBY LEAN_BRIDGE_GEM \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_TEST \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_ROUTES \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_FIXTURES \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_OUTPUT \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted recursive checked-record Ruby acceptance requires the selected interpreter, all selections and the glibc 2.38 floor.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/recursive-checked-record-ruby-ci
# Refuse stale or partial output before starting a producer or opening its log.
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_RUBY="$1"
export LEAN_BRIDGE_GEM="$2"
export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for fixture in recursive mutual; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$fixture"
    mkdir "$output"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_ROUTES="$route"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_FIXTURES="$fixture"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_OUTPUT="$output/records"
    name="installed recursive checked-record Ruby packages reproduce and relocate $route $fixture"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/recursive-checked-record-ruby-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-recursive-checked-record-ruby-ci.mjs --route "$route" --fixture "$fixture" \
      --producer "$revision" --directory "$output/records/$route/$fixture" \
      --tap "$output/run.tap" --glibc 2.38 --ruby "$LEAN_BRIDGE_RUBY" | tee "$output/verification.json"
  done
done
