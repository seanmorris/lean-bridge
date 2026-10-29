#!/usr/bin/env bash
# Build twice, retain closed archives, and execute relocated PHP packages.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-optional-parameter-php-ci.sh' >&2
  exit 2
fi
for name in LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_TEST \
  LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_ROUTES \
  LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted optional-parameter PHP acceptance owns its complete selection.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
root=build/optional-parameter-php-ci
mkdir -p build
mkdir "$root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_TEST=1

for route in ordinary reviewed; do
  output="$root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_ROUTES="$route"
  export LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^installed optional-parameter PHP packages reproduce and relocate $route\$" \
    tests/optional-parameter-php-installed.test.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-optional-parameter-php-ci.mjs \
    --route "$route" --producer "$revision" \
    --directory "$output/records" --tap "$output/run.tap" \
    > "$output/verified.json"
done
