/**
 * Fin callback diagnostic and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinCallbackDiagnosticSource, finCallbackDiagnosticChangedPaths, finCallbackDiagnosticHistoryPath, reverseFinCallbackDiagnosticUpdate } from "./fin-callback-diagnostic-source-history.mjs";

const implementation = "18ad14bb574c1e434fd6d2e2810885ead34007e6";

test("Fin callback diagnostic authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finCallbackDiagnosticHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e44033250f1e339a3eff3ce52b777e2eff2013e4");
	assert.deepEqual(record.updates.map(update => update.path), finCallbackDiagnosticChangedPaths);
	for(const update of record.updates)
	{
		const source = execFileSync(
			"git", ["show", `${implementation}:${update.path}`]
			, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
		assert.equal(sha256(source), update.currentSha256, update.path);
		assert.equal(sha256(reverseFinCallbackDiagnosticUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinCallbackDiagnosticSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinCallbackDiagnosticSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinCallbackDiagnosticSource(update.path, changed), changed);
		assert.throws(() => reverseFinCallbackDiagnosticUpdate(changed, update));
		assert.throws(() => reverseFinCallbackDiagnosticUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
