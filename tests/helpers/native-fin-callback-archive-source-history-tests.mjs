/**
 * Native callback Fin archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeFinCallbackArchiveSource, nativeFinCallbackArchiveChangedPaths, nativeFinCallbackArchiveHistoryPath, reverseNativeFinCallbackArchiveUpdate } from "./native-fin-callback-archive-source-history.mjs";

test("Native callback Fin archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeFinCallbackArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "ee5d63b32b14c32edf4eba713303362de96a1edd");
	assert.deepEqual(record.updates.map(update => update.path), nativeFinCallbackArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseNativeFinCallbackArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinCallbackArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeFinCallbackArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeFinCallbackArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinCallbackArchiveUpdate(changed, update));
		assert.throws(() => reverseNativeFinCallbackArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
