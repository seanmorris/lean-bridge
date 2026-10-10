/**
 * Authenticate diagnostic source transitions without changing earlier acceptance claims.
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
import { beforeFinNixBoundarySource } from "./native-fin-nix-boundary-history.mjs";
import { beforeFinDiagnosticSource, finDiagnosticChangedPaths, finDiagnosticHistoryPath, finDiagnosticPredecessor, reverseFinDiagnosticUpdate } from "./native-fin-diagnostic-source-history.mjs";

test("native Fin diagnostic history restores exact predecessors and rejects unrelated edits", async () => {
	const history = JSON.parse(await readFile(finDiagnosticHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "native-fin-diagnostics-v1");
	assert.equal(history.predecessorCommit, finDiagnosticPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finDiagnosticChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeFinNixBoundarySource(update.path, await readFile(update.path, "utf8")), previous = reverseFinDiagnosticUpdate(current, update);
		assert.equal(beforeFinDiagnosticSource(update.path, current), previous);
		assert.equal(beforeFinDiagnosticSource(update.path, previous), previous);
		assert.equal(beforeFinDiagnosticSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unregistered edit\n";
		assert.equal(beforeFinDiagnosticSource(update.path, changed), changed);
		assert.throws(() => reverseFinDiagnosticUpdate(changed, update));
		assert.throws(() => reverseFinDiagnosticUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseFinDiagnosticUpdate(current, { ...update, path: "unregistered.mjs" }));
		assert.throws(() => reverseFinDiagnosticUpdate(current, { ...update, edits: [] }));
		assert.throws(() => reverseFinDiagnosticUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("native Fin diagnostic inventory refreshes only current source pins, not observed support", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeFinNixBoundarySource(path, text)), previous = JSON.parse(beforeFinDiagnosticSource(path, text));
	const expected = structuredClone(previous), history = JSON.parse(await readFile(finDiagnosticHistoryPath, "utf8"));
	let refreshed = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.equal(refreshed, 246);
	assert.deepEqual(current, expected);
	assert.deepEqual(current.observations, previous.observations);
	const files = new Map();
	for(const entry of JSON.parse(text).evidence) for(const file of entry.files)
	{
		if(!files.has(file.path)) files.set(file.path, sha256(await readFile(file.path)));
		assert.equal(files.get(file.path), file.sha256, file.path);
	}
});

test("native Fin diagnostic history writer refuses an unrelated revision before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-diagnostic-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-fin-diagnostic-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Native Fin diagnostic history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
