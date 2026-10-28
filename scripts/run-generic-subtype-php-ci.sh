#!/usr/bin/env bash
# Reproduce and relocate generic Subtype Composer packages in weak and strict PHP.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* ]]; then
  printf '%s\n' 'Usage: run-generic-subtype-php-ci.sh /absolute/php /absolute/composer' >&2
  exit 2
fi
for name in LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_TEST LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_ROUTES \
  LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_OUTPUT LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_VERSION \
  LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_COMPOSER_VERSION LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR; do
  if [[ -v $name ]]; then printf '%s\n' 'Hosted generic Subtype PHP acceptance requires its fixed matrix.' >&2; exit 2; fi
done

LEAN_BRIDGE_PHP=$(readlink -e -- "$1"); LEAN_BRIDGE_COMPOSER=$(readlink -e -- "$2")
test -x "$LEAN_BRIDGE_PHP"; test -r "$LEAN_BRIDGE_COMPOSER"; export LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER
revision=$(git rev-parse HEAD)
output_root=build/generic-subtype-php-ci
mkdir -p build; mkdir "$output_root"
node scripts/select-nominal-subtype-php-ci-tools.mjs "$LEAN_BRIDGE_PHP" "$LEAN_BRIDGE_COMPOSER" "$output_root" | tee "$output_root/tools.json"
LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_VERSION=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1])).selected.phpVersion);' "$output_root/tools.json")
LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_COMPOSER_VERSION=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; process.stdout.write(JSON.parse(readFileSync(process.argv[1])).selected.composerVersion);' "$output_root/tools.json")
export LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_VERSION LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_COMPOSER_VERSION
export LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1
for route in ordinary reviewed; do
  output="$output_root/$route"; mkdir "$output"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_ROUTES="$route"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_OUTPUT="$output/records"
  name="installed generic Subtype PHP compositions reproduce and relocate $route full"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/nominal-subtype-php-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-generic-subtype-managed-wit-ci.mjs --host php --route "$route" \
    --producer "$revision" --directory "$output/records/$route/full" --tap "$output/run.tap" \
    | tee "$output/verification.json"
done

LEAN_BRIDGE_REVIEWED_SPECIALIZATION_TEST=1 \
LEAN_BRIDGE_REVIEWED_SPECIALIZATION_PROFILES=php-native \
LEAN_BRIDGE_REVIEWED_SPECIALIZATION_REPORT="$output_root/reviewed-specializations.json" \
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern='^independently reviewed native packages install every chosen specialization without its generic$' \
    tests/reviewed-specializations.test.mjs 2>&1 | tee "$output_root/reviewed-specializations.tap"
test -s "$output_root/reviewed-specializations.json"
test "$(git rev-parse HEAD)" = "$revision"
