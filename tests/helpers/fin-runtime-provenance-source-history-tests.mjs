/**
 * Fin runtime provenance and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinPythonRubyPromotionSource } from "./fin-python-ruby-promotion-source-history.mjs";
import { beforeFinRuntimeProvenanceSource, finRuntimeProvenanceChangedPaths, finRuntimeProvenanceHistoryPath, reverseFinRuntimeProvenanceUpdate } from "./fin-runtime-provenance-source-history.mjs";

test("Fin runtime provenance authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finRuntimeProvenanceHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "88ace76f238d188f7e8061d5e56d991b44139a0f");
	assert.deepEqual(record.updates.map(update => update.path), finRuntimeProvenanceChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeFinPythonRubyPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseFinRuntimeProvenanceUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinRuntimeProvenanceSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinRuntimeProvenanceSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinRuntimeProvenanceSource(update.path, changed), changed);
		assert.throws(() => reverseFinRuntimeProvenanceUpdate(changed, update));
		assert.throws(() => reverseFinRuntimeProvenanceUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
