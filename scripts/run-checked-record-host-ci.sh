#!/usr/bin/env bash
# Run every checked-record source/result-only route for one installed native CI lane.
set -euo pipefail

if [[ $# != 1 ]]; then
  printf '%s\n' 'Usage: run-checked-record-host-ci.sh <python311|python312|rust|dotnet|jvm|ruby|php-native|wit-wasi>' >&2
  exit 2
fi

lane=$1
extra=()
case "$lane" in
  python311) profiles=python; extra=(--python 3.11) ;;
  python312) profiles=python; extra=(--python 3.12) ;;
  jvm) profiles=java,kotlin ;;
  rust|dotnet|ruby|php-native|wit-wasi) profiles=$lane ;;
  *) printf 'Unknown checked-record CI lane: %s\n' "$lane" >&2; exit 2 ;;
esac

if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ]]; then
  printf '%s\n' 'Hosted checked-record acceptance must keep the default glibc 2.38 package floor.' >&2
  exit 2
fi

lane_output="build/checked-record-ci/$lane"
mkdir -p build/checked-record-ci
# Preserve prior output and refuse stale or partially completed lanes.
mkdir "$lane_output"
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$lane_output/$route"
  mkdir "$output"
  LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS="$profiles" \
    LEAN_BRIDGE_CHECKED_RECORD_NATIVE_OUTPUT="$output/records" \
    LEAN_BRIDGE_CHECKED_RECORD_NATIVE_ROUTES="$route" \
    node --test --test-concurrency=1 --test-reporter=tap \
    tests/helpers/checked-record-native-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  node scripts/check-checked-record-host-reports.mjs --profiles "$profiles" --route "$route" \
    --directory "$output/records/$route" --tap "$output/run.tap" --glibc 2.38 "${extra[@]}"
done
