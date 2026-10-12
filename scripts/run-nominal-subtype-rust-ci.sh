#!/usr/bin/env bash
# Reproduce each crate in two roots, then install and replay it offline.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-nominal-subtype-rust-ci.sh /absolute/rustc /absolute/cargo' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ]]; then
  printf '%s\n' 'Hosted nominal Rust acceptance requires the explicit glibc 2.38 floor.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/nominal-subtype-rust-ci
# Refuse stale or partial output before starting a producer or opening its log.
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_RUSTC="$1"
export LEAN_BRIDGE_CARGO="$2"
export LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1
export CARGO_BUILD_JOBS=1
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_OUTPUT="$output/records"
    name="installed nominal Rust packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-subtype-rust-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nominal-subtype-rust-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 \
      --rustc "$LEAN_BRIDGE_RUSTC" --cargo "$LEAN_BRIDGE_CARGO" | tee "$output/verification.json"
  done
done
