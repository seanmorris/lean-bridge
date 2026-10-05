/**
 * Authenticate the nominal Fin admission without changing frozen installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCallbackFinSource } from "./callback-fin-source-history.mjs";
import { beforeNominalFinSource, nominalFinChangedPaths
	, nominalFinHistoryPath, reverseNominalFinUpdate } from "./nominal-fin-source-history.mjs";

test("nominal Fin history authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(nominalFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e7c6626b12371e56aeb3cd89109e345e249259e1");
	assert.deepEqual(record.updates.map(item => item.path), nominalFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeCallbackFinSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNominalFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNominalFinSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeNominalFinSource(update.path, changed), changed);
		assert.throws(() => reverseNominalFinUpdate(changed, update));
		assert.throws(() => reverseNominalFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
