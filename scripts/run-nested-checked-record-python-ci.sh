#!/usr/bin/env bash
# Reproduce each wheel once per author root, then install it on both Python floors.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-nested-checked-record-python-ci.sh /absolute/python3.11 /absolute/python3.12' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHONS || -v LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_MAX_LOAD ]]; then
  printf '%s\n' 'Hosted nested checked-record Python acceptance requires the glibc 2.38 floor and both explicit interpreter paths.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/nested-checked-record-python-ci
# Refuse stale or partial output before starting a producer or opening its log.
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHONS=$(node -e 'process.stdout.write(JSON.stringify({"3.11":process.argv[1],"3.12":process.argv[2]}))' "$1" "$2")
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHONS
export LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for mode in full result-only; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$mode"
    mkdir "$output"
    export LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_ROUTES="$route"
    export LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_MODES="$mode"
    export LEAN_BRIDGE_NESTED_CHECKED_RECORD_PYTHON_OUTPUT="$output/records"
    name="installed nested checked-record Python packages reproduce and relocate $route $mode"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/nested-checked-record-python-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-nested-checked-record-python-ci.mjs --route "$route" --mode "$mode" \
      --producer "$revision" --directory "$output/records/$route/$mode" \
      --tap "$output/run.tap" --glibc 2.38 | tee "$output/verification.json"
  done
done
