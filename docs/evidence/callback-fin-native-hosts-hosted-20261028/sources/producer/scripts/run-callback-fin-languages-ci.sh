#!/usr/bin/env bash
# Require ordinary and independently reviewed callback Fin packages in three languages.
set -euo pipefail

if [[ $# != 5 ]]; then
  printf '%s\n' 'Usage: run-callback-fin-languages-ci.sh <python> <ruby> <gem> <rustc> <cargo>' >&2
  exit 2
fi
for name in LEAN_BRIDGE_CALLBACK_FIN_LANGUAGE_PROFILES \
  LEAN_BRIDGE_CALLBACK_FIN_LANGUAGE_OUTPUT \
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR LEAN_BRIDGE_PYTHON LEAN_BRIDGE_RUBY \
  LEAN_BRIDGE_GEM LEAN_BRIDGE_RUSTC LEAN_BRIDGE_CARGO; do
  if [[ -v $name ]]; then
    printf '%s\n' "Hosted callback Fin language acceptance refuses preset $name." >&2
    exit 2
  fi
done
for command in "$@"; do
  if [[ $command != /* || ! -x $command || $command == *$'\n'* || $command == *$'\r'* ]]; then
    printf '%s\n' 'Callback Fin language acceptance requires absolute executable tool paths.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output=build/callback-fin-languages-ci
mkdir -p build
mkdir "$output"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_CALLBACK_FIN_LANGUAGE_PROFILES=python,ruby,rust
export LEAN_BRIDGE_CALLBACK_FIN_LANGUAGE_OUTPUT="$PWD/$output/report.json"
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_BRIDGE_PYTHON=$1 LEAN_BRIDGE_RUBY=$2 LEAN_BRIDGE_GEM=$3
export LEAN_BRIDGE_RUSTC=$4 LEAN_BRIDGE_CARGO=$5

name='ordinary and reviewed Python, Ruby and Rust callback Fin packages install offline'
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/callback-fin-language-installed.test.mjs 2>&1 | tee "$output/acceptance.tap"
test "$(git rev-parse HEAD)" = "$revision"
node scripts/check-callback-fin-languages-ci.mjs \
  --producer "$revision" --tap "$output/acceptance.tap" --report "$output/report.json" \
  2>&1 | tee "$output/verification.json"
