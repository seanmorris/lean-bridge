#!/usr/bin/env bash
# Reproduce all four NuGet routes and independently check every retained record.
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 || $1 != /* ]]; then
  printf '%s\n' 'Usage: run-dependent-checked-record-dotnet-ci.sh /absolute/dotnet [6|8|10|12]' >&2
  exit 2
fi
max_load=${2:-6}
case "$max_load" in
  6|8|10|12) ;;
  *)
    printf '%s\n' 'Dependent checked-record .NET max load must be 6, 8, 10, or 12.' >&2
    exit 2
    ;;
esac
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_DOTNET \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_TEST \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_ROUTES \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_OUTPUT \
  LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted dependent checked-record C# acceptance selects the SDK, all routes, load ceiling, and glibc 2.38 floor.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/dependent-checked-record-dotnet-ci
mkdir -p build
mkdir "$output_root"
mkdir "$output_root/verification"
export LEAN_BRIDGE_DOTNET="$1"
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_TEST=1
export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_MAX_LOAD="$max_load"
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 MSBUILDDISABLENODEREUSE=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_ROUTES="$route"
  export LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_OUTPUT="$output/records"
  name="installed dependent checked records reproduce and relocate in .NET for $route"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/dependent-checked-record-dotnet-installed-tests.mjs \
    2>&1 | tee "$output/run.tap"
  node scripts/check-dependent-checked-record-dotnet-ci.mjs \
    --route "$route" --producer "$revision" --consumer "$revision" \
    --directory "$output/records/$route" --tap "$output/run.tap" \
    --glibc 2.38 --dotnet "$LEAN_BRIDGE_DOTNET" \
    | tee "$output/verification.json" "$output_root/verification/$route.json"
done
