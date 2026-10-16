#!/usr/bin/env bash
# Reproduce four nested checked-record CPAN selections and verify installed execution.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-nested-checked-record-perl-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_TEST \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_CASES \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_OUTPUT \
  LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERLS; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted nested checked-record Perl acceptance selects all cases, pinned ABIs, and the glibc 2.38 floor itself.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/nested-checked-record-perl-ci
# Never overwrite a previous complete or partial execution.
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_TEST=1
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for case_name in ordinary-full ordinary-result-only reviewed-full reviewed-result-only; do
  output="$output_root/$case_name"
  mkdir "$output"
  export LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_CASES="$case_name"
  export LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_OUTPUT="$output/records"
  test_name="installed nested checked-record Perl packages reproduce and relocate for $case_name"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^$test_name$" \
    tests/helpers/nested-checked-record-perl-installed-tests.mjs \
    2>&1 | tee "$output/run.tap"
  node scripts/check-nested-checked-record-perl-ci.mjs \
    --name "$case_name" --producer "$revision" \
    --directory "$output/records/$case_name" --tap "$output/run.tap" \
    --glibc 2.38 | tee "$output/verification.json"
done
