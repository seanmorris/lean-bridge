/**
 * Keep the hosted dependent checked-record JVM workflow closed and non-bypassable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertDependentCheckedRecordJvmWorkflow
} from "./dependent-checked-record-jvm-ci-workflow.mjs";

test("dependent checked-record JVM workflow is complete and pinned", async t => {
	const source = await readFile(
		".github/workflows/dependent-checked-record-jvm.yml", "utf8"
	);
	assert.doesNotThrow(() => assertDependentCheckedRecordJvmWorkflow(source));
	const replacements = [
		["include-hidden-files: true", "include-hidden-files: false"]
		, ["java-version: '22.0.2'", "java-version: '22'"]
		, ["runs-on: ubuntu-24.04", "runs-on: ubuntu-latest"]
		, ["cancel-in-progress: true", "cancel-in-progress: false"]
		, ["inputs.max-load || '6'", "'12'"]
		, ["if-no-files-found: error", "if-no-files-found: warn"]
		, ["npm ci --ignore-scripts --no-audit --no-fund", "npm install"]
		, ["source scripts/env.sh", "true"]
		, ["download-pinned-release-asset.sh kotlin-compiler"
			, "download-pinned-release-asset.sh unknown-compiler"]
	];
	for(const [before, after] of replacements)
	{
		assert.ok(source.includes(before));
		assert.throws(() => assertDependentCheckedRecordJvmWorkflow(
			source.replace(before, after)
		));
	}
	t.diagnostic(`${replacements.length} weakened or unpinned workflow controls`);
});
