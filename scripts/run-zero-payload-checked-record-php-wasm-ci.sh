#!/usr/bin/env bash
# Require every zero-payload PHP-Wasm route and preserve original or failed output.
set -euo pipefail

if [[ $# != 0 ]]; then
  printf '%s\n' 'Usage: run-zero-payload-checked-record-php-wasm-ci.sh' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/zero-payload-checked-record-php-wasm-ci
mkdir -p build
# Refuse stale retained records before starting any compiler or package producer.
mkdir "$output_root"
mkdir "$output_root/compiler"
export LEAN_BRIDGE_ZERO_PAYLOAD_PHP_WASM_LEAN_TEST=1
export LEAN_BRIDGE_ZERO_PAYLOAD_PHP_WASM_LEAN_OUTPUT="$output_root/compiler/records"
node --test --test-concurrency=1 --test-reporter=tap \
  tests/helpers/zero-payload-checked-record-php-wasm-lean-tests.mjs 2>&1 \
  | tee "$output_root/compiler/run.tap"
node scripts/check-zero-payload-checked-record-php-wasm-compiler-ci.mjs \
  "$output_root/compiler/run.tap" 2>&1 | tee "$output_root/compiler/check.log"

export LEAN_BRIDGE_ZERO_PAYLOAD_PHP_WASM_TEST=1
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_ZERO_PAYLOAD_PHP_WASM_ROUTES="$route"
  export LEAN_BRIDGE_ZERO_PAYLOAD_PHP_WASM_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    tests/helpers/zero-payload-checked-record-php-wasm-installed-tests.mjs 2>&1 \
    | tee "$output/run.tap"
  node scripts/check-zero-payload-checked-record-php-wasm-ci.mjs \
    --route "$route" --producer "$revision" --directory "$output/records/$route" \
    --tap "$output/run.tap" 2>&1 | tee "$output/check.log"
done
