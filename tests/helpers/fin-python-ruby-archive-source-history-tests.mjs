/**
 * Python/Ruby Fin archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinPythonRubyArchiveSource, finPythonRubyArchiveChangedPaths, finPythonRubyArchiveHistoryPath, reverseFinPythonRubyArchiveUpdate } from "./fin-python-ruby-archive-source-history.mjs";

test("Python/Ruby Fin archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finPythonRubyArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "78a4d3da45754f3e425faafdadc9e959cee65bc5");
	assert.deepEqual(record.updates.map(update => update.path), finPythonRubyArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseFinPythonRubyArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinPythonRubyArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinPythonRubyArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinPythonRubyArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseFinPythonRubyArchiveUpdate(changed, update));
		assert.throws(() => reverseFinPythonRubyArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
