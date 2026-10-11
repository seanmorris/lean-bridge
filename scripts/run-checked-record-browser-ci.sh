#!/usr/bin/env bash
# Require all four installed routes and preserve complete or failed original output.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-checked-record-browser-ci.sh' >&2
  exit 2
fi
revision=$(git rev-parse HEAD)
output_root=build/checked-record-browser-ci
mkdir -p build
# Refuse stale output before starting a producer or opening any original log.
mkdir "$output_root"
export LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_TEST=1
export LEAN_BRIDGE_CHECKED_RECORD_BROWSER_TEST=1
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES="$route"
  export LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    tests/helpers/checked-record-browser-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-checked-record-browser-ci.mjs --route "$route" \
    --producer "$revision" --directory "$output/records/$route" --tap "$output/run.tap" \
    2>&1 | tee "$output/check.log"
done
