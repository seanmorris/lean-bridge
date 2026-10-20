#!/usr/bin/env bash
# Require both callback directions and author routes in Python, Ruby and Rust.
set -euo pipefail

if [[ $# != 5 ]]; then
  printf '%s\n' 'Usage: run-callback-subtype-languages-ci.sh <python> <ruby> <gem> <rustc> <cargo>' >&2
  exit 2
fi
for name in LEAN_BRIDGE_CALLBACK_SUBTYPE_LANGUAGE_PROFILES \
  LEAN_BRIDGE_CALLBACK_SUBTYPE_LANGUAGE_OUTPUT \
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR LEAN_BRIDGE_PYTHON LEAN_BRIDGE_RUBY \
  LEAN_BRIDGE_GEM LEAN_BRIDGE_RUSTC LEAN_BRIDGE_CARGO; do
  if [[ -v $name ]]; then
    printf '%s\n' "Hosted callback Subtype language acceptance refuses preset $name." >&2
    exit 2
  fi
done
for command in "$@"; do
  if [[ $command != /* || ! -x $command || $command == *$'\n'* || $command == *$'\r'* ]]; then
    printf '%s\n' "Callback Subtype language acceptance requires absolute executable tool paths." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output=build/callback-subtype-languages-ci
mkdir -p build
mkdir "$output"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_CALLBACK_SUBTYPE_LANGUAGE_PROFILES=python,ruby,rust
export LEAN_BRIDGE_CALLBACK_SUBTYPE_LANGUAGE_OUTPUT="$PWD/$output/report.json"
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_BRIDGE_PYTHON=$1 LEAN_BRIDGE_RUBY=$2 LEAN_BRIDGE_GEM=$3
export LEAN_BRIDGE_RUSTC=$4 LEAN_BRIDGE_CARGO=$5

name='ordinary and reviewed Python, Ruby and Rust callback Subtypes install offline'
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/callback-subtype-language-installed.test.mjs 2>&1 | tee "$output/acceptance.tap"
test "$(git rev-parse HEAD)" = "$revision"
node scripts/check-callback-subtype-languages-ci.mjs \
  --producer "$revision" --tap "$output/acceptance.tap" --report "$output/report.json" \
  2>&1 | tee "$output/verification.json"
