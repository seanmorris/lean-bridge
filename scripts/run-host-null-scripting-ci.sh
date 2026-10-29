#!/usr/bin/env bash
# Build, install, relocate and independently verify scripting HostNull packages.
set -euo pipefail

if [[ $# != 0 ]]; then
	printf '%s\n' 'Usage: run-host-null-scripting-ci.sh' >&2
	exit 2
fi
for name in LEAN_BRIDGE_SCRIPTING_HOST_NULL_TEST \
	LEAN_BRIDGE_HOST_NULL_SCRIPTING_OUTPUT \
	LEAN_BRIDGE_HOST_NULL_SCRIPTING_ROUTES \
	LEAN_BRIDGE_HOST_NULL_SCRIPTING_PACKAGE_DIR; do
	if [[ -v $name ]]; then
		printf '%s\n' 'Hosted scripting HostNull acceptance owns its complete selection.' >&2
		exit 2
	fi
done

revision=$(git rev-parse HEAD)
output=build/host-null-scripting-ci
tap=build/host-null-scripting-ci.tap
if [[ -e $output || -e $tap ]]; then
	printf '%s\n' 'Scripting HostNull output already exists.' >&2
	exit 2
fi
mkdir -p "$output"
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_SCRIPTING_HOST_NULL_TEST=1
export LEAN_BRIDGE_HOST_NULL_SCRIPTING_OUTPUT="$output"
export LEAN_BRIDGE_HOST_NULL_SCRIPTING_ROUTES=ordinary,reviewed
export LEAN_BRIDGE_HOST_NULL_SCRIPTING_PACKAGE_DIR="$output/packages"
export LEAN_BRIDGE_PYTHON="${LEAN_BRIDGE_PYTHON:-$(command -v python3)}"
export LEAN_BRIDGE_RUBY="${LEAN_BRIDGE_RUBY:-$(command -v ruby)}"
export LEAN_BRIDGE_GEM="${LEAN_BRIDGE_GEM:-$(command -v gem)}"
export LEAN_BRIDGE_CORPUS_PERL="${LEAN_BRIDGE_CORPUS_PERL:-$(command -v perl)}"
source scripts/env.sh

node --test --test-concurrency=1 --test-reporter=tap \
	--test-name-pattern='^installed scripting HostNull preserves all five positions on both author routes$' \
	tests/scripting-host-null.test.mjs 2>&1 | tee "$tap"
mv "$tap" "$output/run.tap"
node scripts/check-host-null-scripting-ci.mjs \
	--producer "$revision" --directory "$output" --tap "$output/run.tap" \
	> "$output/verified.json"
