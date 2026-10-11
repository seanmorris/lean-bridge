#!/usr/bin/env bash
# Complete input snapshots supplement, rather than replace, the measured Fin edge gates.
set -euo pipefail

if [[ $# != 1 ]]; then
  printf '%s\n' 'Usage: run-fin-late-native-ci.sh <c-family|python311|python312|rust|ruby|dotnet|jvm|php-native>' >&2
  exit 2
fi
lane=$1
extra=()
case "$lane" in
  c-family) profiles=c,cpp ;;
  python311) profiles=python; extra=(--python 3.11) ;;
  python312) profiles=python; extra=(--python 3.12) ;;
  jvm) profiles=java,kotlin ;;
  rust|ruby|dotnet|php-native) profiles=$lane ;;
  *) printf 'Unknown late-input CI lane: %s\n' "$lane" >&2; exit 2 ;;
esac
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ]]; then
  printf '%s\n' 'Hosted late-input acceptance requires the default glibc 2.38 package floor.' >&2
  exit 2
fi
output="build/fin-late-native-ci/$lane"
mkdir -p build/fin-late-native-ci
# A previous successful or partial attempt must not be overwritten.
mkdir "$output"
report="$output/edges-${profiles//,/-}.json"
LEAN_BRIDGE_FIN_LATE_PROFILES="$profiles" LEAN_BRIDGE_FIN_LATE_REPORT="$report" \
  node --test --test-concurrency=1 --test-reporter=tap \
  tests/helpers/fin-container-late-installed-tests.mjs 2>&1 | tee "$output/run.tap"
node scripts/check-fin-late-native-report.mjs --profiles "$profiles" \
  --report "$report" --tap "$output/run.tap" --glibc 2.38 "${extra[@]}"
