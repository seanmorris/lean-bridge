/**
 * Mutation controls for the dedicated hosted value-index PHP-Wasm workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertCheckedRecordValueIndexPhpWasmWorkflow } from "./checked-record-value-index-php-wasm-ci-workflow.mjs";

test("value-index PHP-Wasm workflow requires pinned inputs and fatal all-route acceptance", async () => {
	const source = await readFile(".github/workflows/checked-record-value-index-php-wasm.yml", "utf8");
	assertCheckedRecordValueIndexPhpWasmWorkflow(source);
	for(const [before, after] of [
		["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["npm ci --ignore-scripts", "npm install"]
		, ["bash scripts/build-lean-runtime.sh", "true missing-runtime"]
		, ["bash scripts/run-checked-record-value-index-php-wasm-ci.sh", "true skipped"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["if: always() && steps.acceptance.outcome != 'success'", "if: success()"]
		, ["run: exit 1", "run: exit 0"]
		, ["cancel-in-progress: true", "cancel-in-progress: false"]
	]) {
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertCheckedRecordValueIndexPhpWasmWorkflow(changed)
			, undefined, `Workflow mutation: ${before}`);
	}
});
