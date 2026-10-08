/**
 * Native Fin callback admission and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeFinCallbackAdmissionSource, nativeFinCallbackAdmissionChangedPaths, nativeFinCallbackAdmissionHistoryPath, reverseNativeFinCallbackAdmissionUpdate } from "./native-fin-callback-admission-source-history.mjs";

test("Native Fin callback admission authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeFinCallbackAdmissionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "40fd74762a0ab9bcd5da41e90fef86b827e52783");
	assert.deepEqual(record.updates.map(update => update.path), nativeFinCallbackAdmissionChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseNativeFinCallbackAdmissionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinCallbackAdmissionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeFinCallbackAdmissionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeFinCallbackAdmissionSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinCallbackAdmissionUpdate(changed, update));
		assert.throws(() => reverseNativeFinCallbackAdmissionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
