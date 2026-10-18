/**
 * Keep the hosted value-index .NET workflow closed and non-bypassable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertCheckedRecordValueIndexDotnetWorkflow
} from "./checked-record-value-index-dotnet-ci-workflow.mjs";

test("value-index checked-record .NET workflow is complete and pinned"
	, async t => {
		const source = await readFile(
			".github/workflows/checked-record-value-index-dotnet.yml", "utf8"
		);
		assert.doesNotThrow(() =>
			assertCheckedRecordValueIndexDotnetWorkflow(source));
		const replacements = [
			["include-hidden-files: true", "include-hidden-files: false"]
			, ["dotnet-version: '8.0.424'", "dotnet-version: '8.0.x'"]
			, ["runs-on: ubuntu-24.04", "runs-on: ubuntu-22.04"]
			, ["cancel-in-progress: true", "cancel-in-progress: false"]
			, ["inputs.max-load || '6'", "'12'"]
			, ["if-no-files-found: error", "if-no-files-found: warn"]
			, ["npm ci --ignore-scripts --no-audit --no-fund"
				, "npm install"]
			, ["source scripts/env.sh", "true"]
		];
		for(const [before, after] of replacements)
		{
			assert.ok(source.includes(before));
			assert.throws(() => assertCheckedRecordValueIndexDotnetWorkflow(
				source.replace(before, after)
			));
		}
		t.diagnostic(`${replacements.length} weakened or unpinned workflow controls`);
	}
);
