#!/usr/bin/env bash
# Reproduce four inherited checked-record Maven selections and verify each one.
set -euo pipefail

if [[ $# != 3 || $1 != /* || $2 != /* || $3 != /* ]]; then
  printf '%s\n' 'Usage: run-inherited-checked-record-jvm-ci.sh /absolute/java /absolute/javac /absolute/kotlinc' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_ROUTES \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_MODES \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_OUTPUT \
  LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_MAX_LOAD; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted inherited checked-record JVM acceptance selects its tools, all selections and the glibc 2.38 floor.' >&2
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
unset CLASSPATH JAVA_TOOL_OPTIONS JDK_JAVA_OPTIONS JDK_JAVAC_OPTIONS \
  _JAVA_OPTIONS JAVA_OPTS KOTLIN_OPTS KOTLIN_RUNNER
revision=$(git rev-parse HEAD)
output_root=build/inherited-checked-record-jvm-ci
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 \
  CMAKE_BUILD_PARALLEL_LEVEL=1
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_ROUTES="$route"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_MODES="$mode"
    export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_JVM_OUTPUT="$output/records"
    name="installed inherited checked-record JVM packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap \
      --test-name-pattern="^$name$" \
      tests/helpers/inherited-checked-record-jvm-installed-tests.mjs \
      2>&1 | tee "$output/run.tap"
    node scripts/check-inherited-checked-record-jvm-ci.mjs \
      --route "$route" --mode "$mode" --producer "$revision" \
      --directory "$output/records/$route/$mode" --tap "$output/run.tap" \
      --glibc 2.38 --java "$LEAN_BRIDGE_JAVA" --javac "$LEAN_BRIDGE_JAVAC" \
      --kotlinc "$LEAN_BRIDGE_KOTLINC" | tee "$output/verification.json"
  done
done
