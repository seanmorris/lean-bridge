#!/usr/bin/env bash
# Reproduce each recursive wheel once per author root, then install it on both Python floors.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-recursive-checked-record-python-ci.sh /absolute/python3.11 /absolute/python3.12' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHONS || -v LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_MAX_LOAD ]]; then
  printf '%s\n' 'Hosted recursive checked-record Python acceptance requires the glibc 2.38 floor and both explicit interpreter paths.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/recursive-checked-record-python-ci
# Refuse stale or partial output before starting a producer or opening its log.
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHONS=$(node -e 'process.stdout.write(JSON.stringify({"3.11":process.argv[1],"3.12":process.argv[2]}))' "$1" "$2")
export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHONS
export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
export LEAN_BRIDGE_PYTHON_TYPING_WHEELS="$PWD/build/python-typing-wheels"
for fixture in recursive mutual; do
  for route in ordinary reviewed; do
    output="$output_root/$route-$fixture"
    mkdir "$output"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_ROUTES="$route"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_FIXTURES="$fixture"
    export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_OUTPUT="$output/records"
    name="installed recursive checked-record Python packages reproduce and relocate $route $fixture"
    node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/recursive-checked-record-python-installed-tests.mjs 2>&1 | tee "$output/run.tap"
    node scripts/check-recursive-checked-record-python-ci.mjs --route "$route" --fixture "$fixture" \
      --producer "$revision" --directory "$output/records/$route/$fixture" \
      --tap "$output/run.tap" --glibc 2.38 | tee "$output/verification.json"
  done
done
