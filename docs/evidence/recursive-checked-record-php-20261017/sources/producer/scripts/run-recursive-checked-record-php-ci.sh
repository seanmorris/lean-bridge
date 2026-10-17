#!/usr/bin/env bash
# Reproduce every recursive checked-record native PHP selection, then authenticate it.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-recursive-checked-record-php-ci.sh /absolute/php /absolute/composer' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_TEST \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_ROUTES \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_FIXTURES \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_OUTPUT \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted recursive checked-record PHP acceptance selects all routes and fixtures, the default load ceiling, and the glibc 2.38 floor.' >&2
    exit 2
  fi
done

LEAN_BRIDGE_PHP=$(readlink -e -- "$1")
LEAN_BRIDGE_COMPOSER=$(readlink -e -- "$2")
test -x "$LEAN_BRIDGE_PHP"
test -r "$LEAN_BRIDGE_COMPOSER"
export LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER
revision=$(git rev-parse HEAD)
output_root=build/recursive-checked-record-php-ci
mkdir -p build
mkdir "$output_root"
node scripts/select-nominal-subtype-php-ci-tools.mjs "$LEAN_BRIDGE_PHP" "$LEAN_BRIDGE_COMPOSER" "$output_root" \
  | tee "$output_root/tools.json"
LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1])).selected.phpVersion);' "$output_root/tools.json")
LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1])).selected.composerVersion);' "$output_root/tools.json")
export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION
export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for fixture in recursive mutual; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$fixture"
    mkdir "$output"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_ROUTES="$route"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_FIXTURES="$fixture"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_OUTPUT="$output/records"
    name="installed recursive checked-record PHP packages reproduce and relocate $route $fixture"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/recursive-checked-record-php-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-recursive-checked-record-php-ci.mjs --route "$route" --fixture "$fixture" \
      --producer "$revision" --directory "$output/records/$route/$fixture" \
      --tap "$output/run.tap" --glibc 2.38 --php "$LEAN_BRIDGE_PHP" \
      --composer "$LEAN_BRIDGE_COMPOSER" --php-version "$LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION" \
      --composer-version "$LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION" \
      | tee "$output/verification.json"
  done
done
