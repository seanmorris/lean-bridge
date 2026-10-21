/**
 * Mutation controls for the dedicated hosted dependent PHP-Wasm workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertDependentCheckedRecordPhpWasmWorkflow } from "./dependent-checked-record-php-wasm-ci-workflow.mjs";

test("dependent PHP-Wasm workflow requires pinned inputs and fatal all-route acceptance", async () => {
	const source = await readFile(".github/workflows/dependent-checked-record-php-wasm.yml", "utf8");
	assertDependentCheckedRecordPhpWasmWorkflow(source);
	for(const [before, after] of [
		["  push:\n", ""]
		, ["  pull_request:\n", ""]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["npm ci --ignore-scripts", "npm install"]
		, ["bash scripts/build-lean-runtime.sh", "true missing-runtime"]
		, ["bash scripts/run-dependent-checked-record-php-wasm-ci.sh", "true skipped"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["if: always() && steps.acceptance.outcome != 'success'", "if: success()"]
		, ["run: exit 1", "run: exit 0"]
		, ["cancel-in-progress: true", "cancel-in-progress: false"]
	]) {
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertDependentCheckedRecordPhpWasmWorkflow(changed)
			, undefined, `Workflow mutation: ${before}`);
	}
});
