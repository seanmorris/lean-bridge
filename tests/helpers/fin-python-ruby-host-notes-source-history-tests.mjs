/**
 * Python/Ruby host notes and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinRecordWitFormatSource } from "./fin-record-wit-format-source-history.mjs";
import { beforeFinPythonRubyHostNotesSource, finPythonRubyHostNotesChangedPaths, finPythonRubyHostNotesHistoryPath, reverseFinPythonRubyHostNotesUpdate } from "./fin-python-ruby-host-notes-source-history.mjs";

test("Python/Ruby host notes authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finPythonRubyHostNotesHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "1e0a6bf5b03b88835ac6bba359acd0f6d2e759b4");
	assert.deepEqual(record.updates.map(update => update.path), finPythonRubyHostNotesChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeFinRecordWitFormatSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseFinPythonRubyHostNotesUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinPythonRubyHostNotesSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinPythonRubyHostNotesSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinPythonRubyHostNotesSource(update.path, changed), changed);
		assert.throws(() => reverseFinPythonRubyHostNotesUpdate(changed, update));
		assert.throws(() => reverseFinPythonRubyHostNotesUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
