/**
 * Authenticate the Python graph diagnostic transition and exact source-pin refresh.
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
import { sourceAtFinHistoryRecordSource } from "./source-at-fin-history-milestone.mjs";
import {
	beforeRecursiveCheckedRecordPerlDiagnosticPins
} from "./recursive-checked-record-perl-diagnostic-source-history.mjs";
import {
	beforePythonGraphDiagnosticPins
	, beforePythonGraphDiagnosticSource
	, pythonGraphDiagnosticChangedPaths
	, pythonGraphDiagnosticDraftParent
	, pythonGraphDiagnosticHistoryPath
	, pythonGraphDiagnosticPredecessor
	, reversePythonGraphDiagnosticUpdate
} from "./python-graph-diagnostic-source-history.mjs";

const sourceAt = (path, expected) => sourceAtFinHistoryRecordSource(
	pythonGraphDiagnosticHistoryPath, path, expected
	, beforePythonGraphDiagnosticSource
);

test("Python graph diagnostic history reconstructs every exact predecessor source", async () => {
	const record = JSON.parse(await readFile(pythonGraphDiagnosticHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "python-graph-diagnostic-source-v1");
	assert.equal(record.predecessorCommit, pythonGraphDiagnosticPredecessor);
	assert.equal(record.draftParentCommit, pythonGraphDiagnosticDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, pythonGraphDiagnosticChangedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAt(
			update.path, update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = execFileSync("git", [
			"show", `${pythonGraphDiagnosticPredecessor}:${update.path}`
		], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
		assert.equal(reversePythonGraphDiagnosticUpdate(current, update), previous);
		assert.equal(beforePythonGraphDiagnosticSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforePythonGraphDiagnosticSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforePythonGraphDiagnosticSource(
			update.path, current + "unknown"), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reversePythonGraphDiagnosticUpdate(current, changed));
		}
	}
});

test("Python graph diagnostic history refreshes only predecessor source pins", async () => {
	const path = "docs/type-surface.v1.json";
	const record = JSON.parse(await readFile(pythonGraphDiagnosticHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	// Later layers stack on this inventory; rewind them through the shared hub.
	const currentText = await sourceAt(
		path, update.currentSha256
	);
	const current = JSON.parse(currentText);
	const previous = JSON.parse(reversePythonGraphDiagnosticUpdate(currentText, update));
	assert.deepEqual(beforePythonGraphDiagnosticPins(current)
		, beforeRecursiveCheckedRecordPerlDiagnosticPins(previous));
	const byPath = new Map(record.updates.map(item => [item.path, item]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const source = byPath.get(file.path);
		if(source && file.sha256 === source.previousSha256)
		{
			file.sha256 = source.currentSha256;
			refreshed++;
		}
	}
	assert.equal(refreshed, record.pinCount);
	assert.deepEqual(current, previous);
});

test("Python graph diagnostic history updater refuses another checkout before writing", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-python-graph-diagnostic-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-python-graph-diagnostic-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only at its exact parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
