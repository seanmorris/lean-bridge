#!/usr/bin/env bash
# Reproduce one explicitly selected owned refinement entry-probe package pair.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-php-wasm-owned-refinement-entry-ci.sh' >&2
  exit 2
fi
for name in TEST FAMILIES ROUTES OUTPUT; do
  variable="LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_${name}"
  if [[ ! -v $variable || -z ${!variable} ]]; then
    printf '%s\n' "Missing $variable" >&2
    exit 2
  fi
done
if [[ $LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_TEST != 1 ]]; then
  printf '%s\n' 'Hosted owned refinement entry production requires TEST=1.' >&2
  exit 2
fi
case "$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_FAMILIES" in
  owned-subtype|owned-checked-record) ;;
  *) printf '%s\n' 'Select exactly one known owned refinement-entry family.' >&2; exit 2 ;;
esac
case "$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_ROUTES" in
  ordinary|reviewed) ;;
  *) printf '%s\n' 'Select exactly one owned refinement-entry source route.' >&2; exit 2 ;;
esac

revision=$(git rev-parse HEAD)
output="$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_OUTPUT"
if [[ -e $output ]]; then
  printf '%s\n' 'Owned refinement entry output already exists.' >&2
  exit 2
fi
mkdir -p "$(dirname "$output")"
name="instrumented owned PHP-Wasm package closes $LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_FAMILIES $LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_ROUTES dispatch and transfer order"
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/helpers/php-wasm-owned-refinement-entry-installed-tests.mjs 2>&1 | tee "$output.tap"
test "$(git rev-parse HEAD)" = "$revision"
records="$output/$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_ROUTES/$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_FAMILIES"
test -s "$records/summary.json"
test -s "$records/report.json"
check="$records.check.json"
node scripts/check-php-wasm-refinement-entry-records.mjs \
  --family "$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_FAMILIES" \
  --route "$LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_ROUTES" \
  --producer "$revision" \
  --directory "$records" | tee "$check"
test -s "$check"
