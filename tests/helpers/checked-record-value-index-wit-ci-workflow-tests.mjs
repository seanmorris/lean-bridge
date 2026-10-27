/**
 * Refuse unpinned WIT tools, skipped installed matrices and narrowed failure evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertIsolatedWasmtimeCapiBootstraps } from "./wasmtime-capi-bootstrap.mjs";
import { assertCheckedRecordValueIndexWitWorkflow } from "./checked-record-value-index-wit-ci-workflow.mjs";

test("value-index checked-record WIT workflow requires four source/API selections on the pinned wasm-tools and Wasmtime C API", async () => {
	const source = await readFile(".github/workflows/checked-record-value-index-wit.yml", "utf8");
	assertCheckedRecordValueIndexWitWorkflow(source);
	const shell = await readFile("scripts/run-checked-record-value-index-wit-ci.sh", "utf8");
	for(const command of [
		"for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do"
		, "export LEAN_BRIDGE_VALUE_INDEX_WIT_TEST=1"
		, "export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "node scripts/select-nominal-subtype-wit-ci-tools.mjs"
		, "node --max-old-space-size=3072 scripts/check-checked-record-value-index-wit-ci.mjs"
		, "export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1"
		, "tests/helpers/checked-record-value-index-wit-installed-tests.mjs"
		, "export CC LEAN_BRIDGE_WASM_TOOLS LEAN_BRIDGE_WASMTIME_C_API"
	]) assert.ok(shell.includes(command), command);
	assert.ok(shell.indexOf('mkdir "$output_root"') < shell.indexOf("export LEAN_BRIDGE_VALUE_INDEX_WIT_TEST=1"));
	// The same pinned SDK bytes and isolated installer as the consumer matrix.
	const consumer = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertIsolatedWasmtimeCapiBootstraps(consumer, 3);
	assert.ok(consumer.includes("          bash scripts/bootstrap-toolchains.sh --wasm-tools-only\n"));
});

test("value-index checked-record WIT workflow rejects unpinned tools and acceptance bypasses", async t => {
	const source = await readFile(".github/workflows/checked-record-value-index-wit.yml", "utf8");
	const replacements = [
		["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
		, ["contents: read", "contents: write"]
		, ["    runs-on: ubuntu-24.04", "    runs-on: ubuntu-latest"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["npm ci --ignore-scripts", "npm install"]
		, ["bash scripts/bootstrap-toolchains.sh --lean-only", "true missing-lean"]
		, ["bash scripts/bootstrap-toolchains.sh --wasm-tools-only 2>&1 | tee -a build/checked-record-value-index-wit-toolchain.log\n", ""]
		, ["wasmtime-v42.0.1", "wasmtime-v42.0.2"]
		, ["sha256sum --check --status", "true"]
		, ["mv -T", "mkdir -p"]
		, ["        id: acceptance\n", "        id: acceptance\n        if: false\n"]
		, ["        id: acceptance\n", "        id: acceptance\n        continue-on-error: true\n"]
		, ["run-checked-record-value-index-wit-ci.sh", "missing-matrix.sh"]
		, ['"$PWD/build/wasmtime-c-api"\n', '"$PWD/build/wasmtime-c-api" || true\n']
		, ['"/usr/bin/cc"', '"$(command -v cc)"']
		, ['"$PWD/.toolchains/wasm-tools/bin/wasm-tools"', '"$(command -v wasm-tools)"']
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/checked-record-value-index-wit-ci/\n", "build/checked-record-value-index-wit-ci/ordinary-source/records/report.json\n"]
		, ["            build/checked-record-value-index-wit-toolchain.log\n", ""]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 180", "timeout-minutes: 360"]
		, ["        id: acceptance\n        timeout-minutes: 120", "        id: acceptance\n        timeout-minutes: 1"]
		, ["      LEAN_NUM_THREADS:", "      LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: 2.36\n      LEAN_NUM_THREADS:"]
		, ["      LEAN_NUM_THREADS:", "      LEAN_BRIDGE_VALUE_INDEX_WIT_MODES: full\n      LEAN_NUM_THREADS:"]
		, ["      LEAN_NUM_THREADS:", "      LEAN_BRIDGE_WASMTIME_C_API: /usr/lib/wasmtime\n      LEAN_NUM_THREADS:"]
		, ["      LEAN_NUM_THREADS:", "      CC: /usr/bin/clang\n      LEAN_NUM_THREADS:"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, () => after);
		assert.notEqual(changed, source, before); assert.throws(() => assertCheckedRecordValueIndexWitWorkflow(changed), before);
	}
	assert.equal(replacements.length, 32); t.diagnostic("Thirty-two workflow bypasses refused");
});
