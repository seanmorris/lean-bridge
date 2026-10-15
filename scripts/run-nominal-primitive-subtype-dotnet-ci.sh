#!/usr/bin/env bash
# Reproduce each NuGet package, then check its original offline execution records.
set -euo pipefail

if [[ $# != 1 || $1 != /* ]]; then
  printf '%s\n' 'Usage: run-nominal-primitive-subtype-dotnet-ci.sh /absolute/dotnet' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_DOTNET \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_TEST \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_ROUTES \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_MODES \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_OUTPUT \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted primitive-base nominal C# acceptance selects the SDK, all selections, the default load ceiling and the glibc 2.38 floor.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output_root=build/nominal-primitive-subtype-dotnet-ci
# Do not overwrite an earlier complete or partial producer.
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_DOTNET="$1"
export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 MSBUILDDISABLENODEREUSE=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_OUTPUT="$output/records"
    name="installed primitive-base nominal C# packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-primitive-subtype-dotnet-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nominal-primitive-subtype-dotnet-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 --dotnet "$LEAN_BRIDGE_DOTNET" \
      | tee "$output/verification.json"
  done
done
