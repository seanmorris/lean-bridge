/**
 * Python/Ruby Fin promotion and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinPythonRubyPromotionSource, finPythonRubyPromotionChangedPaths, finPythonRubyPromotionHistoryPath, reverseFinPythonRubyPromotionUpdate } from "./fin-python-ruby-promotion-source-history.mjs";

test("Python/Ruby Fin promotion authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finPythonRubyPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "31e035aca9ac1fb37ebbcdcf3c6bb4d2a2e42a4c");
	assert.deepEqual(record.updates.map(update => update.path), finPythonRubyPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseFinPythonRubyPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinPythonRubyPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinPythonRubyPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinPythonRubyPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseFinPythonRubyPromotionUpdate(changed, update));
		assert.throws(() => reverseFinPythonRubyPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
