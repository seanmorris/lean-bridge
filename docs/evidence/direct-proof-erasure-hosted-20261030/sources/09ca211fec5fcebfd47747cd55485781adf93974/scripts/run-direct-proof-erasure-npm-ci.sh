#!/usr/bin/env bash
# Build two independent author roots, install only prepared archives, and run every npm consumer.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-direct-proof-erasure-npm-ci.sh' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_DIRECT_PROOF_NPM_ROUTES || -v LEAN_BRIDGE_DIRECT_PROOF_NPM_OUTPUT ]]; then
  printf '%s\n' 'Hosted direct proof-erasure acceptance owns its route and output selection.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
root=build/direct-proof-erasure-npm-ci
mkdir -p build
mkdir "$root"
export LEAN_BRIDGE_DIRECT_PROOF_NPM_TEST=1
export LEAN_BRIDGE_DIRECT_PROOF_BROWSER_TEST=1
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit

for route in ordinary reviewed; do
  output="$root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_DIRECT_PROOF_NPM_ROUTES="$route"
  export LEAN_BRIDGE_DIRECT_PROOF_NPM_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^installed direct proof-erasure npm packages reproduce and relocate $route\$" \
    tests/direct-proof-erasure-npm-installed.test.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-direct-proof-erasure-npm-ci.mjs \
    --route "$route" --producer "$revision" \
    --directory "$output/records" --tap "$output/run.tap" \
    > "$output/verified.json"
done
