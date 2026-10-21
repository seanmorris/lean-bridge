#!/usr/bin/env bash
# Reproduce, install, relocate and check both generic Subtype CPAN routes.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-generic-subtype-perl-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_TEST LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_ROUTES \
  LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_OUTPUT LEAN_BRIDGE_GENERIC_SUBTYPE_PERLS; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted generic Subtype Perl acceptance requires its fixed matrix.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/generic-subtype-perl-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_TEST=1
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38
for route in ordinary reviewed; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_ROUTES="$route"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_OUTPUT="$output/records"
  name="installed generic Subtype Perl compositions reproduce and relocate $route full"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/nominal-subtype-perl-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-generic-subtype-native-perl-ci.mjs --kind perl --route "$route" \
    --producer "$revision" --directory "$output/records/$route/full" | tee "$output/verification.json"
done
