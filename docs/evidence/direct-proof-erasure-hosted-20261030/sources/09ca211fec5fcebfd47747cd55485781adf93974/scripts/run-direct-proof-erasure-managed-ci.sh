#!/usr/bin/env bash
# Build twice, retain closed archives, and execute relocated managed consumers.
set -euo pipefail

if [[ $# != 1 ]] || [[ $1 != dotnet && $1 != jvm ]]; then
  printf '%s\n' 'Usage: run-direct-proof-erasure-managed-ci.sh <dotnet|jvm>' >&2
  exit 2
fi
group=$1
for name in LEAN_BRIDGE_DIRECT_PROOF_MANAGED_TEST \
  LEAN_BRIDGE_DIRECT_PROOF_MANAGED_GROUP \
  LEAN_BRIDGE_DIRECT_PROOF_MANAGED_ROUTES \
  LEAN_BRIDGE_DIRECT_PROOF_MANAGED_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted direct proof-erasure managed acceptance owns its complete selection.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
root="build/direct-proof-erasure-managed-ci/$group"
mkdir -p build/direct-proof-erasure-managed-ci
mkdir "$root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_DIRECT_PROOF_MANAGED_TEST=1
export LEAN_BRIDGE_DIRECT_PROOF_MANAGED_GROUP="$group"

if [[ $group == dotnet ]]; then
  export LEAN_BRIDGE_DOTNET
  LEAN_BRIDGE_DOTNET=$(command -v dotnet)
else
  export LEAN_BRIDGE_JAVA="$JAVA_HOME/bin/java"
  export LEAN_BRIDGE_JAVAC="$JAVA_HOME/bin/javac"
  export LEAN_BRIDGE_KOTLINC="$PWD/build/kotlin-tools/kotlinc/bin/kotlinc"
fi
source scripts/env.sh

for route in ordinary reviewed; do
  output="$root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_DIRECT_PROOF_MANAGED_ROUTES="$route"
  export LEAN_BRIDGE_DIRECT_PROOF_MANAGED_OUTPUT="$output/records"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^installed direct proof-erasure managed packages reproduce and relocate $group $route\$" \
    tests/direct-proof-erasure-managed-installed.test.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-direct-proof-erasure-managed-ci.mjs \
    --group "$group" --route "$route" --producer "$revision" \
    --directory "$output/records" --tap "$output/run.tap" \
    > "$output/verified.json"
done
