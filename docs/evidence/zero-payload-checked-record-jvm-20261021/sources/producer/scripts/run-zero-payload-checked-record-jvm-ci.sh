#!/usr/bin/env bash
# Reproduce all four zero-payload Maven routes and verify every retained record.
set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 || $1 != /* || $2 != /* || $3 != /* ]]; then
  printf '%s\n' 'Usage: run-zero-payload-checked-record-jvm-ci.sh /absolute/java /absolute/javac /absolute/kotlinc [6|8|10|12]' >&2
  exit 2
fi
max_load=${4:-6}
case "$max_load" in
  6|8|10|12) ;;
  *)
    printf '%s\n' 'Zero-payload JVM max load must be 6, 8, 10, or 12.' >&2
    exit 2
    ;;
esac
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_JAVA LEAN_BRIDGE_JAVAC LEAN_BRIDGE_KOTLINC \
  LEAN_BRIDGE_KOTLIN_HOME LEAN_BRIDGE_JAR \
  LEAN_BRIDGE_ZERO_PAYLOAD_JVM_TEST LEAN_BRIDGE_ZERO_PAYLOAD_JVM_ROUTES \
  LEAN_BRIDGE_ZERO_PAYLOAD_JVM_OUTPUT LEAN_BRIDGE_ZERO_PAYLOAD_JVM_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted zero-payload JVM acceptance selects its tools, every route, the load ceiling, and the glibc 2.38 floor.' >&2
    exit 2
  fi
done
LEAN_BRIDGE_JAVA=$(readlink -e -- "$1")
LEAN_BRIDGE_JAVAC=$(readlink -e -- "$2")
LEAN_BRIDGE_KOTLINC=$(readlink -e -- "$3")
for command in "$LEAN_BRIDGE_JAVA" "$LEAN_BRIDGE_JAVAC" "$LEAN_BRIDGE_KOTLINC"; do
  test -x "$command"
done
export LEAN_BRIDGE_JAVA LEAN_BRIDGE_JAVAC LEAN_BRIDGE_KOTLINC
export LEAN_BRIDGE_KOTLIN_HOME="$(dirname "$(dirname "$LEAN_BRIDGE_KOTLINC")")"
export LEAN_BRIDGE_JAR="$(dirname "$LEAN_BRIDGE_JAVAC")/jar"
test -x "$LEAN_BRIDGE_JAR"
unset CLASSPATH JAVA_TOOL_OPTIONS JDK_JAVA_OPTIONS JDK_JAVAC_OPTIONS \
  _JAVA_OPTIONS JAVA_OPTS KOTLIN_OPTS KOTLIN_RUNNER
revision=$(git rev-parse HEAD)
output_root=build/zero-payload-checked-record-jvm-ci
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_ZERO_PAYLOAD_JVM_TEST=1
export LEAN_BRIDGE_ZERO_PAYLOAD_JVM_MAX_LOAD="$max_load"
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 \
  CMAKE_BUILD_PARALLEL_LEVEL=1
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_ZERO_PAYLOAD_JVM_ROUTES="$route"
  export LEAN_BRIDGE_ZERO_PAYLOAD_JVM_OUTPUT="$output/records"
  name="installed zero-payload checked-record JVM packages reproduce and relocate for $route"
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern="^$name$" \
    tests/helpers/zero-payload-checked-record-jvm-installed-tests.mjs \
    2>&1 | tee "$output/run.tap"
  node scripts/check-zero-payload-checked-record-jvm-ci.mjs \
    --route "$route" --producer "$revision" --consumer "$revision" \
    --directory "$output/records/$route" --tap "$output/run.tap" \
    --glibc 2.38 --java "$LEAN_BRIDGE_JAVA" --javac "$LEAN_BRIDGE_JAVAC" \
    --kotlinc "$LEAN_BRIDGE_KOTLINC" | tee "$output/verification.json"
done
