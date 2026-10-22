#!/usr/bin/env bash
# Reproduce every dependent checked-record CPAN route and verify it offline.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-dependent-checked-record-perl-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_ROUTES \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_OUTPUT \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERLS; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted dependent-checked-record Perl acceptance selects all routes, pinned ABIs, CPAN modes, and the glibc 2.38 floor itself.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/dependent-checked-record-perl-ci
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST=1
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_ROUTES="$route"
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_OUTPUT="$output/records"
  test_name="installed dependent checked-record Perl packages reproduce and relocate for $route"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^$test_name$" \
    tests/helpers/dependent-checked-record-perl-installed-tests.mjs \
    2>&1 | tee "$output/run.tap"
  node scripts/check-dependent-checked-record-perl-ci.mjs \
    --route "$route" --producer "$revision" \
    --directory "$output/records/$route" --tap "$output/run.tap" \
    --glibc 2.38 --max-load 8 | tee "$output/verification.json"
done
