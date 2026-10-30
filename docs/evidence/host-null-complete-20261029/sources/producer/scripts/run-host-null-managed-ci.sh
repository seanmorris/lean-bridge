#!/usr/bin/env bash
# Build, install, relocate and independently verify HostNull managed packages.
set -euo pipefail

if [[ $# != 1 ]] || [[ $1 != dotnet && $1 != jvm ]]; then
  printf '%s\n' 'Usage: run-host-null-managed-ci.sh <dotnet|jvm>' >&2
  exit 2
fi
group=$1
for name in LEAN_BRIDGE_DOTNET_HOST_NULL_TEST \
  LEAN_BRIDGE_JVM_HOST_NULL_TEST \
  LEAN_BRIDGE_HOST_NULL_MANAGED_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted managed HostNull acceptance owns its complete selection.' >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
base=build/host-null-managed-ci
output="$base/$group"
tap="$base/$group.tap"
mkdir -p "$base"
if [[ -e $output || -e $tap ]]; then
  printf '%s\n' 'Managed HostNull output already exists.' >&2
  exit 2
fi
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_HOST_NULL_MANAGED_OUTPUT="$output"
source scripts/env.sh

if [[ $group == dotnet ]]; then
  export LEAN_BRIDGE_DOTNET
  LEAN_BRIDGE_DOTNET=$(command -v dotnet)
  export LEAN_BRIDGE_DOTNET_HOST_NULL_TEST=1
  file=tests/dotnet-host-null-contract.test.mjs
  pattern='^installed NuGet HostNull preserves all absence states on both author routes$'
else
  export LEAN_BRIDGE_JAVA="$JAVA_HOME/bin/java"
  export LEAN_BRIDGE_JAVAC="$JAVA_HOME/bin/javac"
  export LEAN_BRIDGE_KOTLINC="$PWD/build/kotlin-tools/kotlinc/bin/kotlinc"
  export LEAN_BRIDGE_JVM_HOST_NULL_TEST=1
  file=tests/jvm-host-null-contract.test.mjs
  pattern='^installed Maven HostNull preserves all absence states on both author routes$'
fi

node --test --test-concurrency=1 --test-reporter=tap \
  --test-name-pattern="$pattern" "$file" 2>&1 | tee "$tap"
mv "$tap" "$output/run.tap"
node scripts/check-host-null-managed-ci.mjs \
  --group "$group" --producer "$revision" \
  --directory "$output" --tap "$output/run.tap" \
  > "$output/verified.json"
