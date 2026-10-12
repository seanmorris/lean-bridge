#!/usr/bin/env bash
# Reproduce each selected gem in two roots, then install and relocate it offline.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-nominal-subtype-ruby-ci.sh /absolute/ruby3.3 /absolute/gem' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ]]; then
  printf '%s\n' 'Hosted nominal Ruby acceptance requires the explicit glibc 2.38 floor.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/nominal-subtype-ruby-ci
# Refuse stale or partial output before starting a producer or opening its log.
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_RUBY="$1"
export LEAN_BRIDGE_GEM="$2"
export LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_OUTPUT="$output/records"
    name="installed nominal Ruby packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-subtype-ruby-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nominal-subtype-ruby-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 --ruby "$LEAN_BRIDGE_RUBY" | tee "$output/verification.json"
  done
done
