#!/usr/bin/env bash
# Reproduce one explicitly selected nominal/recursive graph entry-probe package pair.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-php-wasm-refinement-entry-ci.sh' >&2
  exit 2
fi
for name in TEST FAMILIES ROUTES OUTPUT; do
  variable="LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_${name}"
  if [[ ! -v $variable || -z ${!variable} ]]; then
    printf '%s\n' "Missing $variable" >&2
    exit 2
  fi
done
if [[ $LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_TEST != 1 ]]; then
  printf '%s\n' 'Hosted refinement entry production requires TEST=1.' >&2
  exit 2
fi
case "$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES" in
  nominal-full|nominal-result-only|recursive-subtype|recursive-checked-record) ;;
  *) printf '%s\n' 'Select exactly one known refinement-entry family.' >&2; exit 2 ;;
esac
case "$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES" in
  ordinary|reviewed) ;;
  *) printf '%s\n' 'Select exactly one refinement-entry source route.' >&2; exit 2 ;;
esac

revision=$(git rev-parse HEAD)
output="$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_OUTPUT"
if [[ -e $output ]]; then
  printf '%s\n' 'Refinement entry output already exists.' >&2
  exit 2
fi
mkdir -p "$(dirname "$output")"
name="instrumented PHP-Wasm graph package closes $LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES $LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES compiler entries"
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/helpers/php-wasm-refinement-entry-installed-tests.mjs 2>&1 | tee "$output.tap"
test "$(git rev-parse HEAD)" = "$revision"
test -s "$output/$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES/$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES/summary.json"
