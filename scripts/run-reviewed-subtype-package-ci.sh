#!/usr/bin/env bash
# Run one reviewed package gate and retain original output even on failure.
set -euo pipefail

if [[ $# != 1 ]]; then
  printf '%s\n' 'Usage: run-reviewed-subtype-package-ci.sh <c-cpp|npm>' >&2
  exit 2
fi
lane=$1
case "$lane" in
  c-cpp) pattern='^source-free reviewed C and C\+\+ archives execute each checked constructor and distinct generic choices$' ;;
  npm) pattern='^source-free reviewed npm archives execute checked Subtype constructors for Node and strict TypeScript$' ;;
  *) printf 'Unknown reviewed package CI lane: %s\n' "$lane" >&2; exit 2 ;;
esac
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ]]; then
  printf '%s\n' 'Hosted reviewed package acceptance must keep the default glibc 2.38 package floor.' >&2
  exit 2
fi
output="build/reviewed-subtype-package-ci/$lane"
mkdir -p build/reviewed-subtype-package-ci
mkdir "$output"
export LEAN_BRIDGE_REVIEWED_SUBTYPE_PACKAGE_RECORDS="$output/records"
if [[ "$lane" == c-cpp ]]; then
  export LEAN_BRIDGE_REVIEWED_SUBTYPE_PROFILES=c,cpp
  export LEAN_BRIDGE_REVIEWED_SUBTYPE_REPORT="$output/records/report.json"
else
  export LEAN_BRIDGE_REVIEWED_SUBTYPE_NPM_TEST=1
  export LEAN_BRIDGE_REVIEWED_SUBTYPE_NPM_REPORT="$output/records/report.json"
  export LEAN_BRIDGE_REVIEWED_SUBTYPE_BROWSER_TEST=1
  export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit
fi
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="$pattern" \
  tests/reviewed-subtype-installed.test.mjs 2>&1 | tee "$output/run.tap"
node scripts/check-reviewed-subtype-package-reports.mjs --lane "$lane" \
  --directory "$output/records" --tap "$output/run.tap"
if [[ "$lane" == npm ]]; then
  node scripts/check-reviewed-subtype-browser-reports.mjs \
    --directory "$output/records" --tap "$output/run.tap"
fi
