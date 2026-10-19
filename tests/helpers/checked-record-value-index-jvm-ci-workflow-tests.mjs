/**
 * Keep the hosted value-index JVM workflow closed and non-bypassable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertCheckedRecordValueIndexJvmWorkflow
} from "./checked-record-value-index-jvm-ci-workflow.mjs";

test("value-index JVM workflow is complete and pinned", async t => {
	const source = await readFile(
		".github/workflows/checked-record-value-index-jvm.yml", "utf8"
	);
	assert.doesNotThrow(() => assertCheckedRecordValueIndexJvmWorkflow(source));
	const replacements = [
		["include-hidden-files: true", "include-hidden-files: false"]
		, ["java-version: '22.0.2'", "java-version: '22'"]
		, ["runs-on: ubuntu-24.04", "runs-on: ubuntu-latest"]
		, ["cancel-in-progress: true", "cancel-in-progress: false"]
		, ["inputs.max-load || '6'", "'12'"]
		, ["if-no-files-found: error", "if-no-files-found: warn"]
		, ["npm ci --ignore-scripts --no-audit --no-fund", "npm install"]
		, ["source scripts/env.sh", "true"]
		, ["1adb6f1a5845ba0aa5a59e412e44c8e405236b957de1a9683619f1dca3b16932"
			, "0".repeat(64)]
	];
	for(const [before, after] of replacements)
	{
		assert.ok(source.includes(before));
		assert.throws(() => assertCheckedRecordValueIndexJvmWorkflow(
			source.replace(before, after)
		));
	}
	t.diagnostic(`${replacements.length} weakened or unpinned workflow controls`);
});
