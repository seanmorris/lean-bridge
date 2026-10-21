#!/usr/bin/env bash
# Build every independent zero-payload Python wheel, then install each offline
# on both declared CPython floors.
set -euo pipefail

if [[ $# != 2 || $1 != /* || $2 != /* || $1 == "$2" ]]; then
  printf '%s\n' 'Usage: run-zero-payload-checked-record-python-ci.sh /absolute/python3.11 /absolute/python3.12' >&2
  exit 2
fi
if [[ -v LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR || -v LEAN_BRIDGE_ZERO_PAYLOAD_PYTHONS || -v LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_OUTPUT ]]; then
  printf '%s\n' 'Hosted zero-payload Python acceptance requires glibc 2.38 and both explicit interpreter paths.' >&2
  exit 2
fi

revision=$(git rev-parse HEAD)
output_root=build/zero-payload-checked-record-python-ci
mkdir -p build
mkdir "$output_root"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
LEAN_BRIDGE_ZERO_PAYLOAD_PYTHONS=$(node -e 'process.stdout.write(JSON.stringify({"3.11":process.argv[1],"3.12":process.argv[2]}))' "$1" "$2")
export LEAN_BRIDGE_ZERO_PAYLOAD_PYTHONS
export LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_TEST=1
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38
for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do
  output="$output_root/$route"
  mkdir "$output"
  export LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_ROUTES="$route"
  export LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_OUTPUT="$output/records"
  name="installed zero-payload records reproduce and relocate in Python for $route"
  node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^${name//+/\\+}$" \
    tests/helpers/zero-payload-checked-record-python-installed-tests.mjs 2>&1 | tee "$output/run.tap"
  cp "$output/run.tap" "$output/records/$route/run.tap"
  node scripts/check-zero-payload-checked-record-python-ci.mjs --route "$route" \
    --producer "$revision" --directory "$output/records/$route" --tap "$output/records/$route/run.tap" \
    --glibc 2.38 | tee "$output/verification.json"
done
