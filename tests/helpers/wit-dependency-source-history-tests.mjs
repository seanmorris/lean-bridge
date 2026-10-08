/**
 * WIT dependency isolation and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeGenericRecordBrowserSource } from "./generic-record-browser-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeWitDependencySource, witDependencyChangedPaths, witDependencyHistoryPath, reverseWitDependencyUpdate } from "./wit-dependency-source-history.mjs";

test("WIT dependency isolation authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(witDependencyHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "ea43059c0983ac9bd889dc9a0513be4105a0e6bf");
	assert.deepEqual(record.updates.map(update => update.path), witDependencyChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeGenericRecordBrowserSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseWitDependencyUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeWitDependencySource(update.path, source)), update.previousSha256);
		assert.equal(beforeWitDependencySource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeWitDependencySource(update.path, changed), changed);
		assert.throws(() => reverseWitDependencyUpdate(changed, update));
		assert.throws(() => reverseWitDependencyUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
