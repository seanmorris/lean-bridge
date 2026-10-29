#!/usr/bin/env bash
# Build two author roots, install prepared archives, and run every npm consumer.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-optional-parameter-npm-ci.sh' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_OPTIONAL_NPM_ROUTES || -v LEAN_BRIDGE_OPTIONAL_NPM_OUTPUT ]]; then
  printf '%s\n' 'Hosted optional-parameter acceptance owns its route and output selection.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
root=build/optional-parameter-npm-ci
mkdir -p build
mkdir "$root"
export LEAN_BRIDGE_OPTIONAL_NPM_TEST=1
export LEAN_BRIDGE_OPTIONAL_BROWSER_TEST=1
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit

for route in ordinary reviewed; do
  output="$root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_OPTIONAL_NPM_ROUTES="$route"
  export LEAN_BRIDGE_OPTIONAL_NPM_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^installed optional-parameter npm packages reproduce and relocate $route\$" \
    tests/optional-parameter-npm-installed.test.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-optional-parameter-npm-ci.mjs \
    --route "$route" --producer "$revision" \
    --directory "$output/records" --tap "$output/run.tap" \
    > "$output/verified.json"
done
