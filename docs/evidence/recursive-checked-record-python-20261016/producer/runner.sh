#!/usr/bin/env bash
# #1521 producer: all four selections at 236a3c9, CPU3, under the heavy lock.
set -euo pipefail
cd /app/build/worktrees/claude-recursive-vo1521
test "$(git rev-parse HEAD)" = 236a3c94060c8db72e38a8059ecaf02e1e4c6357 || { echo "unexpected HEAD" >&2; exit 2; }
git diff --quiet HEAD -- src tests scripts
free=$(df -m --output=avail /app | tail -1 | tr -d ' ')
test "$free" -ge 1536 || { echo "free space ${free}M below 1536M floor" >&2; exit 3; }
exec flock /app/build/vo1493-heavy.lock env -u FORCE_COLOR NO_COLOR=1 \
  LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1 \
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  LEAN_BRIDGE_LEAN_PREFIX=/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2 \
  LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_TEST=1 \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHON_OUTPUT=/app/build/vo1521-python-236a3c9-records \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PYTHONS='{"3.11":"/app/.toolchains/python311/bin/python3.11","3.12":"/app/.toolchains/python312/bin/python3.12"}' \
  taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap \
  tests/helpers/recursive-checked-record-python-installed-tests.mjs
