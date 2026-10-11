#!/usr/bin/env bash
set -euo pipefail
if [[ $# != 0 || -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ]]; then
  printf '%s\n' 'Usage: run-fin-late-wit-ci.sh; hosted packages must retain the default glibc 2.38 floor.' >&2
  exit 2
fi
output=build/fin-late-wit-ci
mkdir -p build
mkdir "$output"
LEAN_BRIDGE_FIN_LATE_WIT_TEST=1 LEAN_BRIDGE_FIN_LATE_WIT_OUTPUT="$output/records" \
  node --test --test-concurrency=1 --test-reporter=tap \
  tests/helpers/fin-container-late-wit-installed-tests.mjs 2>&1 | tee "$output/run.tap"
node scripts/check-fin-late-wit-report.mjs --directory "$output/records" \
  --tap "$output/run.tap" --glibc 2.38
