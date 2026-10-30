#!/usr/bin/env bash
# Build twice, retain closed archives, and execute one relocated language package.
set -euo pipefail

if [[ $# != 1 ]] || [[ $1 != perl && $1 != python && $1 != ruby && $1 != rust ]]; then
  printf '%s\n' 'Usage: run-direct-proof-erasure-language-ci.sh <perl|python|ruby|rust>' >&2
  exit 2
fi
profile=$1
for name in LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_TEST \
  LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_PROFILE \
  LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_ROUTES \
  LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted direct proof-erasure language acceptance owns its complete selection.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
root="build/direct-proof-erasure-language-ci/$profile"
mkdir -p build/direct-proof-erasure-language-ci
mkdir "$root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_TEST=1
export LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_PROFILE="$profile"
if [[ $profile == perl ]]; then
  : "${LEAN_BRIDGE_CORPUS_PERL:=$(command -v perl)}"
  export LEAN_BRIDGE_CORPUS_PERL
elif [[ $profile == python ]]; then
  : "${LEAN_BRIDGE_PYTHON:=$(command -v python3)}"
  export LEAN_BRIDGE_PYTHON
elif [[ $profile == ruby ]]; then
  : "${LEAN_BRIDGE_RUBY:=$(command -v ruby)}"
  : "${LEAN_BRIDGE_GEM:=$(command -v gem)}"
  export LEAN_BRIDGE_RUBY LEAN_BRIDGE_GEM
else
  : "${LEAN_BRIDGE_CARGO:=$PWD/.toolchains/rust-1.90.0/bin/cargo}"
  : "${LEAN_BRIDGE_RUSTC:=$PWD/.toolchains/rust-1.90.0/bin/rustc}"
  export LEAN_BRIDGE_CARGO LEAN_BRIDGE_RUSTC
fi
source scripts/env.sh

for route in ordinary reviewed; do
  output="$root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_ROUTES="$route"
  export LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^installed direct proof-erasure $profile package reproduces and relocates $route\$" \
    tests/direct-proof-erasure-language-installed.test.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-direct-proof-erasure-language-ci.mjs \
    --profile "$profile" --route "$route" --producer "$revision" \
    --directory "$output/records" --tap "$output/run.tap" \
    > "$output/verified.json"
done
