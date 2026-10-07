/**
 * Promote only the independently executed reviewed Fin C-family observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedFinEvidenceSource, reviewedFinEvidenceChangedPaths
	, reviewedFinEvidenceHistoryPath, reverseReviewedFinEvidenceUpdate } from "./reviewed-fin-evidence-source-history.mjs";

test("reviewed Fin installed evidence authenticates its complete source predecessors", async () => {
	const record = JSON.parse(await readFile(reviewedFinEvidenceHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "8234bed9a23c82535f0a4b9d8483a52013fa6c92");
	assert.deepEqual(record.updates.map(update => update.path), reviewedFinEvidenceChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseReviewedFinEvidenceUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedFinEvidenceSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedFinEvidenceSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const altered = source + "\n// unregistered change\n";
		assert.equal(beforeReviewedFinEvidenceSource(update.path, altered), altered);
		assert.throws(() => reverseReviewedFinEvidenceUpdate(altered, update));
		assert.throws(() => reverseReviewedFinEvidenceUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseReviewedFinEvidenceUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("reviewed Fin promotion preserves older receipts and limits acceptance to C/C++", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedFinEvidenceSource(path, source));
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.observations.slice(1), previous.observations);
	const observation = current.observations[0];
	assert.equal(observation.id, "native-fin-c-family-reviewed-ir");
	assert.equal(observation.path, "reviewed-ir");
	assert.deepEqual(observation.profiles, ["c", "cpp"]);
	assert.deepEqual(observation.shapes, ["fin"]);
	assert.deepEqual(observation.positions, ["parameter", "result"]);
	const evidenceIds = ["reviewed-native-fin-c-cpp-installed", "reviewed-native-fin-containers-c-cpp-installed"];
	for(const stage of Object.values(observation.stages))
	{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, evidenceIds); }
	assert.deepEqual(current.evidence.slice(0, 2).map(entry => entry.id), evidenceIds);
	assert.deepEqual(current.evidence.slice(2).map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [index, entry] of previous.evidence.entries())
	{
		const now = current.evidence[index + 2];
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [position, file] of entry.files.entries())
		{
			if(now.files[position].sha256 === file.sha256) continue;
			assert.ok(reviewedFinEvidenceChangedPaths.includes(file.path));
			const bytes = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeReviewedFinEvidenceSource(file.path, bytes)));
			assert.equal(now.files[position].sha256, sha256(bytes));
			refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	const reports = JSON.parse(await readFile("docs/evidence/reviewed-fin-20261007/receipt.json", "utf8")).reports;
	for(const [index, entry] of current.evidence.slice(0, 2).entries())
	{
		assert.equal(entry.kind, "installed");
		assert.equal(entry.revision, reports[index].revision);
		assert.equal(entry.command, reports[index].command);
		for(const file of entry.files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
		const report = JSON.parse(await readFile(reports[index].path, "utf8"));
		assert.deepEqual(entry.artifacts.map(item => item.sha256).sort(), Object.values(report.archives).sort());
	}
});
