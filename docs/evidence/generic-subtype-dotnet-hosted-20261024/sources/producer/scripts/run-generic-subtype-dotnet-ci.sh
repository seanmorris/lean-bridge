#!/usr/bin/env bash
# Reproduce and source-free replay generic Subtype NuGet packages.
set -euo pipefail

if [[ $# != 1 || $1 != /* ]]; then
  printf '%s\n' 'Usage: run-generic-subtype-dotnet-ci.sh /absolute/dotnet' >&2
  exit 2
fi
for name in LEAN_BRIDGE_GENERIC_SUBTYPE_DOTNET_TEST LEAN_BRIDGE_GENERIC_SUBTYPE_DOTNET_ROUTES \
  LEAN_BRIDGE_GENERIC_SUBTYPE_DOTNET_OUTPUT LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR; do
  if [[ -v $name ]]; then printf '%s\n' 'Hosted generic Subtype C# acceptance requires its fixed matrix.' >&2; exit 2; fi
done
LEAN_BRIDGE_DOTNET=$(readlink -e -- "$1"); test -x "$LEAN_BRIDGE_DOTNET"; export LEAN_BRIDGE_DOTNET
revision=$(git rev-parse HEAD)
output_root=build/generic-subtype-dotnet-ci
mkdir -p build; mkdir "$output_root"
export LEAN_BRIDGE_GENERIC_SUBTYPE_DOTNET_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 MSBUILDDISABLENODEREUSE=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1
for route in ordinary reviewed; do
  output="$output_root/$route"; mkdir "$output"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_DOTNET_ROUTES="$route"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_DOTNET_OUTPUT="$output/records"
  name="installed generic Subtype C# compositions reproduce and relocate $route full"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/nominal-subtype-dotnet-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-generic-subtype-managed-wit-ci.mjs --host dotnet --route "$route" \
    --producer "$revision" --directory "$output/records/$route/full" --tap "$output/run.tap" \
    | tee "$output/verification.json"
done
