/**
 * Reviewed callback harness and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { beforeReviewedCallbackHarnessSource, reviewedCallbackHarnessChangedPaths, reviewedCallbackHarnessHistoryPath, reverseReviewedCallbackHarnessUpdate } from "./reviewed-callback-harness-source-history.mjs";

const implementation = "f9cda046e0b624bd847fe41d521b9cb9f84f21a3";
const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

test("Reviewed callback harness authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedCallbackHarnessHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "44f38ab9458aaff322f6925c221a8ef2fc4e4969");
	assert.equal(git(["show", "-s", "--format=%P", implementation]).trim()
		, record.predecessorCommit);
	assert.deepEqual(record.updates.map(update => update.path), reviewedCallbackHarnessChangedPaths);
	for(const update of record.updates)
	{
		const source = git(["show", `${implementation}:${update.path}`]);
		assert.equal(sha256(reverseReviewedCallbackHarnessUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedCallbackHarnessSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedCallbackHarnessSource(update.path, source, update.currentSha256), source);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedCallbackHarnessSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedCallbackHarnessUpdate(changed, update));
		assert.throws(() => reverseReviewedCallbackHarnessUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
