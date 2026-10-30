#!/usr/bin/env bash
# Build, install, relocate and independently verify systems HostNull packages.
set -euo pipefail

if [[ $# != 0 ]]; then
	printf '%s\n' 'Usage: run-host-null-systems-ci.sh' >&2
	exit 2
fi
for name in LEAN_BRIDGE_SYSTEMS_HOST_NULL_TEST \
	LEAN_BRIDGE_SYSTEMS_HOST_NULL_OUTPUT \
	LEAN_BRIDGE_SYSTEMS_HOST_NULL_ROUTES; do
	if [[ -v $name ]]; then
		printf '%s\n' 'Hosted systems HostNull acceptance owns its complete selection.' >&2
		exit 2
	fi
done
if [[ ! -v LEAN_BRIDGE_WASMTIME_C_API || ! -d $LEAN_BRIDGE_WASMTIME_C_API ]]; then
	printf '%s\n' 'Missing hosted systems toolchain: LEAN_BRIDGE_WASMTIME_C_API' >&2
	exit 2
fi
if [[ ! -v LEAN_BRIDGE_WASM_TOOLS || ! -x $LEAN_BRIDGE_WASM_TOOLS ]]; then
	printf '%s\n' 'Missing hosted systems toolchain: LEAN_BRIDGE_WASM_TOOLS' >&2
	exit 2
fi

revision=$(git rev-parse HEAD)
output=build/host-null-systems-ci
tap=build/host-null-systems-ci.tap
if [[ -e $output || -e $tap ]]; then
	printf '%s\n' 'Systems HostNull output already exists.' >&2
	exit 2
fi
mkdir -p build
export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1
export LEAN_BRIDGE_SYSTEMS_HOST_NULL_TEST=1
export LEAN_BRIDGE_SYSTEMS_HOST_NULL_OUTPUT="$output"
export LEAN_BRIDGE_SYSTEMS_HOST_NULL_ROUTES=ordinary,reviewed
export LEAN_BRIDGE_RUSTC="$PWD/.toolchains/rust-1.90.0/bin/rustc"
export LEAN_BRIDGE_CARGO="$PWD/.toolchains/rust-1.90.0/bin/cargo"
source scripts/env.sh

node --test --test-concurrency=1 --test-reporter=tap \
	--test-name-pattern='^installed systems HostNull preserves all five positions on both author routes$' \
	tests/systems-host-null.test.mjs 2>&1 | tee "$tap"
mv "$tap" "$output/run.tap"
node scripts/check-host-null-systems-ci.mjs \
	--producer "$revision" --directory "$output" --tap "$output/run.tap" \
	> "$output/verified.json"
