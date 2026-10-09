/**
 * Authenticate Fin entry-counter integration without changing support claims.
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
import { beforeFinEntryIntegrationSource, finEntryIntegrationChangedPaths, finEntryIntegrationHistoryPath, finEntryIntegrationPredecessor, reverseFinEntryIntegrationUpdate } from "./fin-entry-integration-source-history.mjs";
import { beforeFinContainerEvidenceCiSource } from "./fin-container-evidence-ci-source-history.mjs";

test("Fin entry integration history authenticates exact predecessors and rejects unrecorded edits", async () => {
	const record = JSON.parse(await readFile(finEntryIntegrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "fin-entry-integration-v1");
	assert.equal(record.predecessorCommit, finEntryIntegrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), finEntryIntegrationChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeFinContainerEvidenceCiSource(update.path, await readFile(update.path, "utf8")), previous = reverseFinEntryIntegrationUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeFinEntryIntegrationSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeFinEntryIntegrationSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeFinEntryIntegrationSource(update.path, changed), changed);
		assert.throws(() => reverseFinEntryIntegrationUpdate(changed, update));
		assert.throws(() => reverseFinEntryIntegrationUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseFinEntryIntegrationUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseFinEntryIntegrationUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("Fin entry integration refreshes source pins without changing any observation or support claim", async () => {
	const path = "docs/type-surface.v1.json", source = beforeFinContainerEvidenceCiSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeFinEntryIntegrationSource(path, source));
	const history = JSON.parse(await readFile(finEntryIntegrationHistoryPath));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = history.updates.find(update => update.path === file.path && update.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 103); assert.deepEqual(current, previous);
	for(const evidence of JSON.parse(await readFile(path)).evidence) for(const file of evidence.files)
		assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
});

test("Fin entry integration history updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-entry-integration-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-fin-entry-integration-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Fin entry integration history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
