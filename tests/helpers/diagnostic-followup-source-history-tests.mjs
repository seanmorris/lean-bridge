/**
 * Authenticate the diagnostic and CLI lineage follow-up without changing frozen evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeDiagnosticFollowupSource, diagnosticFollowupChangedPaths
	, diagnosticFollowupHistoryPath, reverseDiagnosticFollowupUpdate } from "./diagnostic-followup-source-history.mjs";

test("Diagnostic follow-up history authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(diagnosticFollowupHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "be1a8f6ff4e9a2991a116f58a8fe137ec126257c");
	assert.deepEqual(record.updates.map(item => item.path), diagnosticFollowupChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseDiagnosticFollowupUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeDiagnosticFollowupSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeDiagnosticFollowupSource(update.path, changed), changed);
		assert.throws(() => reverseDiagnosticFollowupUpdate(changed, update));
		assert.throws(() => reverseDiagnosticFollowupUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

// The repair adds no support claim: only source pins of this layer's files move.
test("Diagnostic follow-up changes no inventory claim, receipt or archive", async () => {
	const path = "docs/type-surface.v1.json";
	const current = JSON.parse(await readFile(path, "utf8"));
	const previous = JSON.parse(beforeDiagnosticFollowupSource(path, await readFile(path, "utf8")));
	assert.deepEqual(current.observations, previous.observations);
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [position, entry] of previous.evidence.entries())
	{
		const now = current.evidence[position];
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(diagnosticFollowupChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			assert.equal(file.sha256, sha256(beforeDiagnosticFollowupSource(file.path, await readFile(file.path, "utf8"))));
			assert.equal(now.files[index].sha256, sha256(await readFile(file.path)));
			++refreshed;
		}
	}
	process.stdout.write(`# diagnostic-followup refreshed inventory pins: ${refreshed}\n`);
});
