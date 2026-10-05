/**
 * Authenticate the closure repair without changing frozen installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeNominalFinSource } from "./nominal-fin-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeRefinementClosureSource, refinementClosureChangedPaths
	, refinementClosureHistoryPath, reverseRefinementClosureUpdate } from "./refinement-closure-source-history.mjs";

test("refinement closure repair authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(refinementClosureHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "d6bc8bcde0592883dda8f26af7d8cb4111648fca");
	assert.deepEqual(record.updates.map(item => item.path), refinementClosureChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNominalFinSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRefinementClosureUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRefinementClosureSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeRefinementClosureSource(update.path, changed), changed);
		assert.throws(() => reverseRefinementClosureUpdate(changed, update));
		assert.throws(() => reverseRefinementClosureUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
