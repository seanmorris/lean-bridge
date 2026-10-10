#!/usr/bin/env bash
# Run one native reviewed-Subtype CI lane and retain original failed or successful output.
set -euo pipefail

if [[ $# != 1 ]]; then
  printf '%s\n' 'Usage: run-reviewed-subtype-host-ci.sh <python311|python312|rust|dotnet|jvm|ruby|php-native|wit-wasi|perl-VERSION-ABI>' >&2
  exit 2
fi

lane=$1
extra=()
case "$lane" in
  python311) profiles=python; extra=(--python 3.11) ;;
  python312) profiles=python; extra=(--python 3.12) ;;
  jvm) profiles=java,kotlin ;;
  rust|dotnet|ruby|php-native|wit-wasi) profiles=$lane ;;
  perl-5.36.3-threaded|perl-5.36.3-unthreaded|perl-5.38.2-threaded|perl-5.38.2-unthreaded)
    profiles=perl; extra=(--perl "${lane#perl-}") ;;
  *) printf 'Unknown reviewed Subtype CI lane: %s\n' "$lane" >&2; exit 2 ;;
esac

if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ]]; then
  printf '%s\n' 'Hosted reviewed Subtype acceptance must keep the default glibc 2.38 package floor.' >&2
  exit 2
fi

output="build/reviewed-subtype-ci/$lane"
mkdir -p build/reviewed-subtype-ci
# Refuse stale output rather than replacing a previous producer's records or TAP.
mkdir "$output"
LEAN_BRIDGE_REVIEWED_SUBTYPE_HOSTS="$profiles" LEAN_BRIDGE_REVIEWED_SUBTYPE_HOST_OUTPUT="$output/records" \
  node --test --test-concurrency=1 --test-reporter=tap \
  --test-name-pattern='^installed reviewed native Subtype hosts reproduce and relocate the complete checked corpus$' \
  tests/helpers/reviewed-subtype-host-installed-tests.mjs 2>&1 | tee "$output/run.tap"
node scripts/check-reviewed-subtype-host-reports.mjs --profiles "$profiles" \
  --directory "$output/records" --tap "$output/run.tap" --glibc 2.38 "${extra[@]}"
