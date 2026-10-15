#!/usr/bin/env bash
# Reproduce every primitive-base native PHP selection, then authenticate it.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-nominal-primitive-subtype-php-ci.sh /absolute/php /absolute/composer' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION \
  LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_TEST \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_ROUTES \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_MODES \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_OUTPUT \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted primitive-base nominal PHP acceptance selects all routes and modes, the default load ceiling, and the glibc 2.38 floor.' >&2
    exit 2
  fi
done

LEAN_BRIDGE_PHP=$(readlink -e -- "$1")
LEAN_BRIDGE_COMPOSER=$(readlink -e -- "$2")
test -x "$LEAN_BRIDGE_PHP"
test -r "$LEAN_BRIDGE_COMPOSER"
export LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER
revision=$(git rev-parse HEAD)
output_root=build/nominal-primitive-subtype-php-ci
mkdir -p build
mkdir "$output_root"
node scripts/select-nominal-subtype-php-ci-tools.mjs "$LEAN_BRIDGE_PHP" "$LEAN_BRIDGE_COMPOSER" "$output_root" \
  | tee "$output_root/tools.json"
LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1])).selected.phpVersion);' "$output_root/tools.json")
LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1])).selected.composerVersion);' "$output_root/tools.json")
export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION
export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_OUTPUT="$output/records"
    name="installed primitive-base nominal PHP packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-primitive-subtype-php-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nominal-primitive-subtype-php-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 --php "$LEAN_BRIDGE_PHP" \
      --composer "$LEAN_BRIDGE_COMPOSER" --php-version "$LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION" \
      --composer-version "$LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION" \
      | tee "$output/verification.json"
  done
done
