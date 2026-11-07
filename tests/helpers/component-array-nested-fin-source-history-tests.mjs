/**
 * Authenticate the nested-Fin source-history boundary outside the
 * behavior-only component-array parent process.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeNestedFinSource, reverseNestedFinUpdate
	, nestedFinChangedPaths, nestedFinHistoryPath
} from "./nested-fin-source-history.mjs";
import { beforeRefinementClosureSource } from "./refinement-closure-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

test("nested Fin history authenticates complete source transitions and stopping points", async () => {
	const history = JSON.parse(await readFile(nestedFinHistoryPath, "utf8"));
	assert.equal(history.predecessorCommit, "4b07413e43a6a3cd72cf738659f8e78ee5a00028");
	assert.deepEqual(history.updates.map(item => item.path), nestedFinChangedPaths);
	for(const update of history.updates)
	{
		const source = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeRefinementClosureSource
		);
		assert.equal(sha256(reverseNestedFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNestedFinSource(update.path, source)), update.previousSha256);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.throws(() => reverseNestedFinUpdate(source + "\nunreviewed\n", update));
		assert.throws(() => reverseNestedFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
