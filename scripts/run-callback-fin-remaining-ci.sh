#!/usr/bin/env bash
# Require both callback Fin author routes in one remaining-host lane.
set -euo pipefail

if (( $# < 2 )); then
  printf '%s\n' 'Usage: run-callback-fin-remaining-ci.sh <dotnet|jvm|php-native|wit-wasi> <absolute tools...>' >&2
  exit 2
fi
lane=$1
shift
case "$lane" in
  dotnet)
    [[ $# == 1 ]] || exit 2
    profiles=dotnet
    export LEAN_BRIDGE_DOTNET=$1
    ;;
  jvm)
    [[ $# == 4 ]] || exit 2
    profiles=java,kotlin
    export LEAN_BRIDGE_JAVA=$1 LEAN_BRIDGE_JAVAC=$2
    export LEAN_BRIDGE_KOTLINC=$3 LEAN_BRIDGE_MAVEN=$4
    ;;
  php-native)
    [[ $# == 2 ]] || exit 2
    profiles=php-native
    export LEAN_BRIDGE_PHP=$1 LEAN_BRIDGE_COMPOSER=$2
    ;;
  wit-wasi)
    [[ $# == 3 ]] || exit 2
    profiles=wit-wasi
    export CC=$1 LEAN_BRIDGE_WASM_TOOLS=$2 LEAN_BRIDGE_WASMTIME_C_API=$3
    ;;
  *) printf '%s\n' "Unknown callback Fin lane: $lane" >&2; exit 2 ;;
esac
for command in "$@"; do
  if [[ $command != /* || ! -x $command || $command == *$'\n'* || $command == *$'\r'* ]]; then
    printf '%s\n' 'Callback Fin remaining acceptance requires absolute executable tool paths.' >&2
    exit 2
  fi
done
for name in LEAN_BRIDGE_CALLBACK_FIN_REMAINING_PROFILES \
  LEAN_BRIDGE_CALLBACK_FIN_REMAINING_OUTPUT LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR; do
  if [[ -v $name ]]; then
    printf '%s\n' "Hosted callback Fin acceptance refuses preset $name." >&2
    exit 2
  fi
done

revision=$(git rev-parse HEAD)
output="build/callback-fin-remaining-ci-$lane"
mkdir -p build
mkdir "$output"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_CALLBACK_FIN_REMAINING_PROFILES=$profiles
export LEAN_BRIDGE_CALLBACK_FIN_REMAINING_OUTPUT="$PWD/$output/report.json"
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38

name='ordinary and reviewed remaining callback Fin packages install offline'
node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
  tests/callback-fin-remaining-installed.test.mjs 2>&1 | tee "$output/acceptance.tap"
test "$(git rev-parse HEAD)" = "$revision"
node scripts/check-callback-fin-remaining-ci.mjs \
  --producer "$revision" --profiles "$profiles" \
  --tap "$output/acceptance.tap" --report "$output/report.json" \
  2>&1 | tee "$output/verification.json"
