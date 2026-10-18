#!/usr/bin/env bash
# Reproduce four inherited checked-record CPAN selections and verify all ABIs.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-inherited-checked-record-perl-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_TEST \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_ROUTES \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MODES \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_OUTPUT \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MAX_LOAD \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERLS; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted inherited checked-record Perl acceptance selects all routes, modes, pinned ABIs, resource policy, and the glibc 2.38 floor itself.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/inherited-checked-record-perl-ci
# Never overwrite a previous complete or partial execution.
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_TEST=1
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38
export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MAX_LOAD=8
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for route in ordinary reviewed; do
  for mode in full result-only; do
    case_name="$route-$mode"
    output="$output_root/$case_name"
    mkdir "$output"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_ROUTES="$route"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_MODES="$mode"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_OUTPUT="$output/records"
    test_name="installed inherited checked-record Perl packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap \
      --test-name-pattern="^$test_name$" \
      tests/helpers/inherited-checked-record-perl-installed-tests.mjs \
      2>&1 | tee "$output/run.tap"
    node scripts/check-inherited-checked-record-perl-ci.mjs \
      --route "$route" --mode "$mode" --producer "$revision" \
      --directory "$output/records/$route/$mode" --tap "$output/run.tap" \
      --glibc 2.38 --max-load 8 | tee "$output/verification.json"
  done
done
