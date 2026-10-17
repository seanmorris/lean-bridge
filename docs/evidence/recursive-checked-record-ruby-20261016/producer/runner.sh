#!/usr/bin/env bash
# #1520 producer: ordinary and reviewed x recursive and mutual at 908bfa2, CPU3, under the heavy lock.
set -euo pipefail
cd /app/build/worktrees/claude-ruby-vo1520
test "$(git rev-parse HEAD)" = 908bfa29b72e059f13e73a9db832da4b84276641 || { echo "unexpected HEAD" >&2; exit 2; }
git diff --quiet HEAD -- src tests scripts
free=$(df -m --output=avail /app | tail -1 | tr -d ' ')
test "$free" -ge 1536 || { echo "free space ${free}M below 1536M floor" >&2; exit 3; }
exec flock /app/build/vo1493-heavy.lock env -u FORCE_COLOR NO_COLOR=1 \
  LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1 \
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  LEAN_BRIDGE_LEAN_PREFIX=/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2 \
  LEAN_BRIDGE_RUBY=/app/.toolchains/ruby33/bin/ruby \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_TEST=1 \
  LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_RUBY_OUTPUT=/app/build/vo1520-ruby-908bfa2-records \
  taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap \
  tests/helpers/recursive-checked-record-ruby-installed-tests.mjs
