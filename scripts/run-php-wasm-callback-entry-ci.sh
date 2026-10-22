#!/usr/bin/env bash
# Reproduce one callback family across ordinary and reviewed entry-probe packages.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-php-wasm-callback-entry-ci.sh' >&2
  exit 2
fi
for name in TEST FAMILIES ROUTES OUTPUT; do
  variable="LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_${name}"
  if [[ ! -v $variable || -z ${!variable} ]]; then
    printf '%s\n' "Missing $variable" >&2
    exit 2
  fi
done
if [[ $LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_TEST != 1 ]]; then
  printf '%s\n' 'Hosted callback entry production requires TEST=1.' >&2
  exit 2
fi
case "$LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_FAMILIES" in
  callback-fin|callback-checked-record) ;;
  *) printf '%s\n' 'Select exactly one known callback-entry family.' >&2; exit 2 ;;
esac
if [[ $LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_ROUTES != ordinary,reviewed ]]; then
  printf '%s\n' 'Callback-entry production requires ordinary,reviewed route order.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output="$LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_OUTPUT"
if [[ -e $output ]]; then
  printf '%s\n' 'Callback entry output already exists.' >&2
  exit 2
fi
mkdir -p "$(dirname "$output")"
name='instrumented PHP-Wasm callbacks close and execute every selected entry'
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/php-wasm-callback-entry-installed.test.mjs 2>&1 | tee "$output.tap"
test "$(git rev-parse HEAD)" = "$revision"
for route in ordinary reviewed; do
  records="$output/$LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_FAMILIES/$route"
  check="$output/$LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_FAMILIES/$route.check.json"
  test -s "$records/report.json"
  node scripts/check-php-wasm-callback-entry-records.mjs \
    --family "$LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_FAMILIES" \
    --route "$route" \
    --producer "$revision" \
    --directory "$records" | tee "$check"
  test -s "$check"
done
test -s "$output/index.json"
