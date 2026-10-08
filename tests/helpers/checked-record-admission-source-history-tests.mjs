/**
 * Checked-record admission and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinPythonRubyArchiveSource } from "./fin-python-ruby-archive-source-history.mjs";
import { beforeCheckedRecordAdmissionSource, checkedRecordAdmissionChangedPaths, checkedRecordAdmissionHistoryPath, reverseCheckedRecordAdmissionUpdate } from "./checked-record-admission-source-history.mjs";

test("Checked-record admission authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(checkedRecordAdmissionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "b1d297aeea76961a4f96089a68758a96fd7e03a3");
	assert.deepEqual(record.updates.map(update => update.path), checkedRecordAdmissionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeFinPythonRubyArchiveSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseCheckedRecordAdmissionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCheckedRecordAdmissionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeCheckedRecordAdmissionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeCheckedRecordAdmissionSource(update.path, changed), changed);
		assert.throws(() => reverseCheckedRecordAdmissionUpdate(changed, update));
		assert.throws(() => reverseCheckedRecordAdmissionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
