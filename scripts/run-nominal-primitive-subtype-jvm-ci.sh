#!/usr/bin/env bash
# Reproduce four nineteen-base Maven selections and verify their original installed execution.
set -euo pipefail

if [[ $# != 3 || $1 != /* || $2 != /* || $3 != /* ]]; then
  printf '%s\n' 'Usage: run-nominal-primitive-subtype-jvm-ci.sh /absolute/java /absolute/javac /absolute/kotlinc' >&2
  exit 2
fi
for name in LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_TEST \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_ROUTES \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MODES \
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_OUTPUT; do
  if [[ -v $name ]]; then
    printf '%s\n' 'Hosted primitive-base nominal JVM acceptance selects the tools, all selections and the glibc 2.38 floor itself.' >&2
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
unset CLASSPATH JAVA_TOOL_OPTIONS JDK_JAVA_OPTIONS JDK_JAVAC_OPTIONS _JAVA_OPTIONS JAVA_OPTS KOTLIN_OPTS KOTLIN_RUNNER
revision=$(git rev-parse HEAD)
output_root=build/nominal-primitive-subtype-jvm-ci
# Never overwrite a previous complete or partial execution.
mkdir -p build
mkdir "$output_root"
export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_ROUTES="$route"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MODES="$mode"
    export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_OUTPUT="$output/records"
    name="installed primitive-base nominal JVM packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nominal-primitive-subtype-jvm-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nominal-primitive-subtype-jvm-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 --java "$LEAN_BRIDGE_JAVA" \
      --javac "$LEAN_BRIDGE_JAVAC" --kotlinc "$LEAN_BRIDGE_KOTLINC" \
      | tee "$output/verification.json"
  done
done
