/**
 * Authenticate the component-array Subtype source-history boundary outside
 * the behavior-only parent process.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNestedFinSource } from "./nested-fin-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeSubtypeComponentSource, reverseSubtypeComponentUpdate
	, subtypeComponentChangedPaths, subtypeComponentHistoryPath
} from "./subtype-component-source-history.mjs";

test("Subtype component history preserves predecessors and rejects altered source spans", async () => {
	const history = JSON.parse(await readFile(subtypeComponentHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.predecessorCommit, "8daefcd2ececf2e7d2aefc70245848305c2bf33a");
	assert.deepEqual(history.updates.map(item => item.path), subtypeComponentChangedPaths);
	for(const update of history.updates)
	{
		const source = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeNestedFinSource
		);
		assert.equal(sha256(reverseSubtypeComponentUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeSubtypeComponentSource(update.path, source)), update.previousSha256);
		assert.equal(beforeSubtypeComponentSource(update.path, source, update.currentSha256), source);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.throws(() => reverseSubtypeComponentUpdate(source + "\nunreviewed\n", update));
		assert.throws(() => reverseSubtypeComponentUpdate(source, { ...update, edits: [] }));
		assert.throws(() => reverseSubtypeComponentUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
	const unknown = Buffer.from([0, 255, 128, 192]);
	assert.equal(beforeFinRefinementSource("unknown.bin", unknown), unknown);
});
