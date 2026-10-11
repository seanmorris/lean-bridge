#!/usr/bin/env bash
# Keep all four ABIs in the same reproduced archives, then install both delivery modes.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-checked-record-perl-ci.sh' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_CHECKED_RECORD_PERLS ]]; then
  printf '%s\n' 'Hosted Perl acceptance requires the pinned four-ABI toolchains and default glibc 2.38 package floor.' >&2
  exit 2
fi

output_root=build/checked-record-perl-ci
# Refuse previous or partially completed output instead of merging report sets.
mkdir -p build
mkdir "$output_root"
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST=1 \
    LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES="$route" \
    LEAN_BRIDGE_CHECKED_RECORD_PERL_OUTPUT="$output/records" \
    node --test --test-concurrency=1 --test-reporter=tap \
    tests/helpers/checked-record-perl-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-checked-record-perl-reports.mjs --route "$route" \
    --directory "$output/records/$route" --tap "$output/run.tap" --glibc 2.38
done
