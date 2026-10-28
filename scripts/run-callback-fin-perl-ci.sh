#!/usr/bin/env bash
# Require both callback Fin author routes on every prepared Perl ABI.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-callback-fin-perl-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_CALLBACK_FIN_PERL_TEST \
  LEAN_BRIDGE_CALLBACK_FIN_PERL_OUTPUT \
  LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR LEAN_BRIDGE_PERLS LEAN_BRIDGE_CORPUS_PERL; do
  if [[ -v $name ]]; then
    printf '%s\n' "Hosted callback Fin Perl acceptance refuses preset $name." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output=build/callback-fin-perl-ci
mkdir -p build
mkdir "$output"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_CALLBACK_FIN_PERL_TEST=1
export LEAN_BRIDGE_CALLBACK_FIN_PERL_OUTPUT="$PWD/$output/report.json"
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.38

name='ordinary and reviewed callback Fin packages run on every prepared Perl ABI'
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/callback-fin-perl-installed.test.mjs 2>&1 | tee "$output/acceptance.tap"
test "$(git rev-parse HEAD)" = "$revision"
node scripts/check-callback-fin-perl-ci.mjs \
  --producer "$revision" --tap "$output/acceptance.tap" --report "$output/report.json" \
  2>&1 | tee "$output/verification.json"
