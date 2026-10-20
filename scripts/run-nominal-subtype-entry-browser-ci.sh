#!/usr/bin/env bash
# Measure constructor/source entry through installed Node and browser packages.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-nominal-subtype-entry-browser-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ENTRY \
  LEAN_BRIDGE_TYPE_CORPUS_BROWSERS \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted nominal entry measurement requires its complete fixed matrix.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/nominal-subtype-entry-browser-ci
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST=1
export LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST=1
export LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ENTRY=1
export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1
for route in ordinary reviewed; do
  for mode in full result-only; do
    output="$output_root/$route/$mode"
    mkdir -p "$output"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT="$output/records"
    node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-before.json"
    node --test --test-concurrency=1 --test-reporter=tap \
      tests/helpers/nominal-subtype-npm-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node -p 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})' > "$output/runtime-after.json"
    cmp "$output/runtime-before.json" "$output/runtime-after.json"
    test "$(git rev-parse HEAD)" = "$revision"
    node scripts/check-nominal-subtype-entry-browser-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" --tap "$output/run.tap" \
      --runtime "$output/runtime-before.json" 2>&1 | tee "$output/check.log"
  done
done
