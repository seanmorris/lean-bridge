#!/usr/bin/env bash
# Reproduce each selected crate in two roots, then install and relocate it offline.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-inherited-checked-record-rust-ci.sh /absolute/rustc /absolute/cargo' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_RUSTC LEAN_BRIDGE_CARGO \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_TEST \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_ROUTES \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_MODES \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_OUTPUT \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted inherited checked-record Rust acceptance requires the selected compilers, all selections and the glibc 2.38 floor.' >&2
    exit 2
  fi
done
revision=$(git rev-parse HEAD)
output_root=build/inherited-checked-record-rust-ci
# Refuse stale or partial output before starting a producer or opening its log.
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1 CARGO_BUILD_JOBS=1
export LEAN_BRIDGE_RUSTC="$1"
export LEAN_BRIDGE_CARGO="$2"
export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_ROUTES="$route"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_MODES="$mode"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_RUST_OUTPUT="$output/records"
    name="installed inherited checked-record Rust packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/inherited-checked-record-rust-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-inherited-checked-record-rust-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 --rustc "$LEAN_BRIDGE_RUSTC" --cargo "$LEAN_BRIDGE_CARGO" | tee "$output/verification.json"
  done
done
