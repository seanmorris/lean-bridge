#!/usr/bin/env bash
# Reproduce every value-index native-PHP selection, then authenticate each
# original Composer archive from retained records.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-checked-record-value-index-php-ci.sh /absolute/php /absolute/composer' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION \
  LEAN_BRIDGE_VALUE_INDEX_PHP_TEST LEAN_BRIDGE_VALUE_INDEX_PHP_ROUTES \
  LEAN_BRIDGE_VALUE_INDEX_PHP_OUTPUT LEAN_BRIDGE_VALUE_INDEX_PHP_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted value-index PHP acceptance selects every route, the default load ceiling, and glibc 2.38.' >&2
    exit 2
  fi
done

LEAN_BRIDGE_PHP=$(readlink -e -- "$1")
LEAN_BRIDGE_COMPOSER=$(readlink -e -- "$2")
test -x "$LEAN_BRIDGE_PHP"
test -r "$LEAN_BRIDGE_COMPOSER"
export LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER
revision=$(git rev-parse HEAD)
output_root=build/checked-record-value-index-php-ci
mkdir -p build
mkdir "$output_root"
node scripts/select-nominal-subtype-php-ci-tools.mjs "$LEAN_BRIDGE_PHP" "$LEAN_BRIDGE_COMPOSER" "$output_root" \
  | tee "$output_root/tools.json"
LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1])).selected.phpVersion);' "$output_root/tools.json")
LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1])).selected.composerVersion);' "$output_root/tools.json")
export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION
export LEAN_BRIDGE_VALUE_INDEX_PHP_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_VALUE_INDEX_PHP_ROUTES="$route"
  export LEAN_BRIDGE_VALUE_INDEX_PHP_OUTPUT="$output/records"
  name="installed value-index checked-record PHP packages reproduce and relocate for $route"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^${name//+/\\+}$" \
    tests/helpers/checked-record-value-index-php-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-checked-record-value-index-php-ci.mjs --route "$route" \
    --producer "$revision" --directory "$output/records/$route" --tap "$output/run.tap" \
    --glibc 2.38 --php "$LEAN_BRIDGE_PHP" --composer "$LEAN_BRIDGE_COMPOSER" \
    --php-version "$LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION" \
    --composer-version "$LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION" \
    | tee "$output/verification.json"
done
