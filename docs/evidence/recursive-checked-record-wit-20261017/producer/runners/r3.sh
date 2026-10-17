#!/usr/bin/env bash
# #1522 producer (run 3): the single reviewed x mutual cell at ffcb1cf, CPU3, under the heavy lock.
# One TAP stream per selection, as the hosted runner records them, then the independent checker.
set -euo pipefail
cd /app/build/worktrees/claude-wit-harness-vo1522
test "$(git rev-parse HEAD)" = ffcb1cfec301ab15b47a8fbc41dacfa4164f0c04 || { echo "unexpected HEAD" >&2; exit 2; }
git diff --quiet HEAD -- src tests scripts
free=$(df -m --output=avail /app | tail -1 | tr -d ' ')
test "$free" -ge 1536 || { echo "free space ${free}M below 1536M floor" >&2; exit 3; }
root=/app/build/vo1522-wit-ffcb1cf-r3
mkdir "$root"
exec 9>/app/build/vo1493-heavy.lock
flock 9
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1 NO_COLOR=1
unset FORCE_COLOR
export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36
export LEAN_BRIDGE_LEAN_PREFIX=/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2
export CC=/usr/bin/cc LEAN_BRIDGE_WASM_TOOLS=/app/.toolchains/wasm-tools/bin/wasm-tools
export LEAN_BRIDGE_WASMTIME_C_API=/app/.toolchains/wasmtime42
export LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_WIT_TEST=1
for fixture in mutual; do
  for route in reviewed; do
    output="$root/$route-$fixture"
    mkdir "$output"
    name="installed recursive checked-record WIT packages reproduce and relocate $route $fixture"
    LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_WIT_ROUTES="$route" LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_WIT_FIXTURES="$fixture" \
    LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_WIT_OUTPUT="$output/records" \
      taskset -c 3 node --max-old-space-size=3072 --test --test-concurrency=1 --test-reporter=tap --test-name-pattern="^$name$" \
      tests/helpers/recursive-checked-record-wit-installed-tests.mjs > "$output/run.tap" 2>&1 || { echo "producer failed: $route $fixture" >&2; tail -60 "$output/run.tap" >&2; exit 4; }
    taskset -c 3 node --max-old-space-size=3072 scripts/check-recursive-checked-record-wit-ci.mjs --route "$route" --fixture "$fixture" \
      --producer ffcb1cfec301ab15b47a8fbc41dacfa4164f0c04 --directory "$output/records/$route/$fixture" \
      --tap "$output/run.tap" --glibc 2.36 --cc "$CC" \
      --wasm-tools "$LEAN_BRIDGE_WASM_TOOLS" --wasmtime-capi "$LEAN_BRIDGE_WASMTIME_C_API" \
      > "$output/verification.json" 2> "$output/verification.err" || { echo "checker failed: $route $fixture" >&2; tail -60 "$output/verification.err" >&2; exit 5; }
    echo "verified $route $fixture"
  done
done
