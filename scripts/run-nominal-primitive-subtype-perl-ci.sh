#!/usr/bin/env bash
# Keep both author routes and both APIs in separate complete four-ABI primitive-base CPAN runs.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-nominal-primitive-subtype-perl-ci.sh' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS || -v LEAN_BRIDGE_PERLS || -v LEAN_BRIDGE_CORPUS_PERL ]]; then
  printf '%s\n' 'Hosted primitive-base nominal CPAN acceptance requires the glibc 2.38 floor and all four pinned Perl ABIs.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/nominal-primitive-subtype-perl-ci
# Refuse stale or partial output before starting a producer or opening its log.
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_TEST=1
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_OUTPUT="$output/records"
    name="installed primitive-base nominal Perl packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-primitive-subtype-perl-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nominal-primitive-subtype-perl-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 | tee "$output/verification.json"
  done
done
