#!/usr/bin/env bash
set -euo pipefail

output="build/dependent-checked-record-browser-ci"
records="$output/records"
routes="ordinary-source,reviewed-ir,result-only-ordinary-source,result-only-reviewed-ir"

test ! -e "$output"
mkdir -p "$output"

export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NPM_TEST=1
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_BROWSER_TEST=1
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_ROUTES="$routes"
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_OUTPUT="$records"
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS="chromium,firefox,webkit"

node --test --test-concurrency=1 --test-reporter=tap \
  tests/helpers/dependent-checked-record-browser-installed-tests.mjs \
  2>&1 | tee "$output/run.tap"

revision="$(git rev-parse HEAD)"
for route in ${routes//,/ }; do
  test -s "$records/$route/report.json"
  test -s "$records/$route/browser.json"
  node scripts/check-dependent-checked-record-browser-ci.mjs \
    --route "$route" \
    --producer "$revision" \
    --checker "$revision" \
    --directory "$records/$route" \
    --tap "$output/run.tap" >/dev/null
done
