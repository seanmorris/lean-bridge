#!/usr/bin/env bash
# Reproduce each route twice, then install, relocate, and replay it offline.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-checked-record-value-index-rust-ci.sh /absolute/rustc /absolute/cargo' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_RUSTC LEAN_BRIDGE_CARGO \
  LEAN_BRIDGE_VALUE_INDEX_RUST_TEST \
  LEAN_BRIDGE_VALUE_INDEX_RUST_ROUTES \
  LEAN_BRIDGE_VALUE_INDEX_RUST_OUTPUT \
  LEAN_BRIDGE_VALUE_INDEX_RUST_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted value-index Rust acceptance requires closed selections and the glibc 2.38 floor.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/checked-record-value-index-rust-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1 CARGO_BUILD_JOBS=1
export LEAN_BRIDGE_RUSTC="$1"
export LEAN_BRIDGE_CARGO="$2"
export LEAN_BRIDGE_VALUE_INDEX_RUST_TEST=1
export LEAN_BRIDGE_VALUE_INDEX_RUST_MAX_LOAD=6
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_VALUE_INDEX_RUST_ROUTES="$route"
  export LEAN_BRIDGE_VALUE_INDEX_RUST_OUTPUT="$output/records"
  name="installed value-index checked-record Rust packages reproduce and relocate $route"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/checked-record-value-index-rust-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-checked-record-value-index-rust-ci.mjs --route "$route" \
    --producer "$revision" --directory "$output/records/$route" \
    --tap "$output/run.tap" --glibc 2.38 \
    --rustc "$LEAN_BRIDGE_RUSTC" --cargo "$LEAN_BRIDGE_CARGO" | tee "$output/verification.json"
done
