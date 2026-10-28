#!/usr/bin/env bash
# Reproduce and source-free replay generic Subtype Maven packages through Java and Kotlin.
set -euo pipefail

if [[ $# != 3 || $1 != /* || $2 != /* || $3 != /* ]]; then
  printf '%s\n' 'Usage: run-generic-subtype-jvm-ci.sh /absolute/java /absolute/javac /absolute/kotlinc' >&2
  exit 2
fi
for name in LEAN_BRIDGE_GENERIC_SUBTYPE_JVM_TEST LEAN_BRIDGE_GENERIC_SUBTYPE_JVM_ROUTES \
  LEAN_BRIDGE_GENERIC_SUBTYPE_JVM_OUTPUT LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR; do
  if [[ -v $name ]]; then printf '%s\n' 'Hosted generic Subtype JVM acceptance requires its fixed matrix.' >&2; exit 2; fi
done

LEAN_BRIDGE_JAVA=$(readlink -e -- "$1"); LEAN_BRIDGE_JAVAC=$(readlink -e -- "$2"); LEAN_BRIDGE_KOTLINC=$(readlink -e -- "$3")
for command in "$LEAN_BRIDGE_JAVA" "$LEAN_BRIDGE_JAVAC" "$LEAN_BRIDGE_KOTLINC"; do test -x "$command"; done
export LEAN_BRIDGE_JAVA LEAN_BRIDGE_JAVAC LEAN_BRIDGE_KOTLINC
LEAN_BRIDGE_KOTLIN_HOME="$(dirname "$(dirname "$LEAN_BRIDGE_KOTLINC")")"
LEAN_BRIDGE_JAR="$(dirname "$LEAN_BRIDGE_JAVAC")/jar"
export LEAN_BRIDGE_KOTLIN_HOME LEAN_BRIDGE_JAR
unset CLASSPATH JAVA_TOOL_OPTIONS JDK_JAVA_OPTIONS JDK_JAVAC_OPTIONS _JAVA_OPTIONS JAVA_OPTS KOTLIN_OPTS KOTLIN_RUNNER
revision=$(git rev-parse HEAD)
output_root=build/generic-subtype-jvm-ci
mkdir -p build; mkdir "$output_root"
export LEAN_BRIDGE_GENERIC_SUBTYPE_JVM_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1
for route in ordinary reviewed; do
  output="$output_root/$route"; mkdir "$output"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_JVM_ROUTES="$route"
  export LEAN_BRIDGE_GENERIC_SUBTYPE_JVM_OUTPUT="$output/records"
  name="installed generic Subtype JVM compositions reproduce and relocate $route full"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
    tests/helpers/nominal-subtype-jvm-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  test "$(git rev-parse HEAD)" = "$revision"
  node scripts/check-generic-subtype-managed-wit-ci.mjs --host jvm --route "$route" \
    --producer "$revision" --directory "$output/records/$route/full" --tap "$output/run.tap" \
    | tee "$output/verification.json"
done

LEAN_BRIDGE_REVIEWED_SPECIALIZATION_TEST=1 \
LEAN_BRIDGE_REVIEWED_SPECIALIZATION_PROFILES=java,kotlin \
LEAN_BRIDGE_REVIEWED_SPECIALIZATION_REPORT="$output_root/reviewed-specializations.json" \
  node --test --test-concurrency=1 --test-reporter=tap \
    --test-name-pattern='^independently reviewed native packages install every chosen specialization without its generic$' \
    tests/reviewed-specializations.test.mjs 2>&1 | tee "$output_root/reviewed-specializations.tap"
test -s "$output_root/reviewed-specializations.json"
test "$(git rev-parse HEAD)" = "$revision"
