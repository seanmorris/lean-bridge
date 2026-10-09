/**
 * Keep inheritance archival separate from support promotion and preserve exact producer stops.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePerlXsBudgetSource } from "./perl-xs-budget-source-history.mjs";
import { beforeInheritedRecordArchiveSource, inheritedRecordArchiveChangedPaths, inheritedRecordArchiveHistoryPath, inheritedRecordArchivePredecessor, inheritedRecordArchiveProducer, inheritedRecordArchiveProducerPins, reverseInheritedRecordArchiveUpdate } from "./inherited-record-archive-source-history.mjs";

test("inheritance archival restores four main predecessors without entering the plain producer branch by default", async () => {
	const record = JSON.parse(await readFile(inheritedRecordArchiveHistoryPath, "utf8"));
	assert.deepEqual(Object.keys(record), ["schemaVersion", "milestone", "predecessorCommit", "updates", "producerCommit", "producerUpdates"]);
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "inherited-record-archive-v1");
	assert.equal(record.predecessorCommit, inheritedRecordArchivePredecessor);
	assert.equal(record.producerCommit, inheritedRecordArchiveProducer);
	assert.deepEqual(record.updates.map(update => update.path), inheritedRecordArchiveChangedPaths);
	assert.equal(record.updates.length, 4);
	for(const update of record.updates)
	{
		const source = beforePerlXsBudgetSource(update.path, await readFile(update.path, "utf8")), previous = reverseInheritedRecordArchiveUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeInheritedRecordArchiveSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeInheritedRecordArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
	}
	assert.ok(!record.updates.some(update => update.path === "docs/type-surface.v1.json"), "no inventory transition or support promotion");
});

test("plain inheritance producer identities require an explicit exact stopping digest", async () => {
	const record = JSON.parse(await readFile(inheritedRecordArchiveHistoryPath, "utf8"));
	assert.deepEqual(record.producerUpdates.map(update => update.path), Object.keys(inheritedRecordArchiveProducerPins));
	for(const update of record.producerUpdates)
	{
		const source = beforePerlXsBudgetSource(update.path, await readFile(update.path, "utf8")), expected = inheritedRecordArchiveProducerPins[update.path];
		assert.equal(update.previousSha256, expected);
		const producer = reverseInheritedRecordArchiveUpdate(source, update);
		assert.equal(sha256(producer), expected);
		assert.equal(beforeInheritedRecordArchiveSource(update.path, source, expected), producer);
		assert.equal(beforeFinRefinementSource(update.path, source, expected), producer);
		assert.equal(beforeInheritedRecordArchiveSource(update.path, producer, expected), producer);
		assert.equal(beforeInheritedRecordArchiveSource(update.path, source), source);
		assert.equal(beforeInheritedRecordArchiveSource(update.path, source, "0".repeat(64)), source);
	}
});

test("inheritance history refuses unknown edits, altered hashes and overlapping spans", async () => {
	const record = JSON.parse(await readFile(inheritedRecordArchiveHistoryPath, "utf8"));
	for(const update of [...record.updates, ...record.producerUpdates])
	{
		const source = beforePerlXsBudgetSource(update.path, await readFile(update.path, "utf8")), changed = source + "\n// unknown edit\n";
		assert.equal(beforeInheritedRecordArchiveSource(update.path, changed, update.previousSha256), changed);
		assert.throws(() => reverseInheritedRecordArchiveUpdate(changed, update));
		assert.throws(() => reverseInheritedRecordArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseInheritedRecordArchiveUpdate(source, { ...update, path: "unregistered.mjs" }));
		assert.throws(() => reverseInheritedRecordArchiveUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("the inheritance archive history updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-record-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-inherited-record-archive-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Inherited record archive history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
