/**
 * Authenticate the projected checked-record mirror repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeProjectedCheckedRecordMirrorSource
	, projectedCheckedRecordMirrorChangedPaths
	, projectedCheckedRecordMirrorHistoryPath
	, projectedCheckedRecordMirrorImplementation
	, projectedCheckedRecordMirrorIntegrationPaths
	, projectedCheckedRecordMirrorPredecessor
	, reverseProjectedCheckedRecordMirrorUpdate
} from "./projected-checked-record-mirror-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("projected checked-record mirror history restores every source", async () => {
	const record = JSON.parse(await readFile(
		projectedCheckedRecordMirrorHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "projected-checked-record-mirror-source-v1");
	assert.equal(record.predecessorCommit
		, projectedCheckedRecordMirrorPredecessor);
	assert.equal(record.implementationCommit
		, projectedCheckedRecordMirrorImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, projectedCheckedRecordMirrorChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, projectedCheckedRecordMirrorIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseProjectedCheckedRecordMirrorUpdate(
			current, update
		);
		assert.equal(previous, sourceAt(
			projectedCheckedRecordMirrorPredecessor, update.path
		));
		assert.equal(beforeProjectedCheckedRecordMirrorSource(
			update.path, current), previous);
		assert.equal(beforeProjectedCheckedRecordMirrorSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeProjectedCheckedRecordMirrorSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseProjectedCheckedRecordMirrorUpdate(
			current, update
		), sourceAt(projectedCheckedRecordMirrorImplementation
			, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("projected checked-record mirror history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		projectedCheckedRecordMirrorHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseProjectedCheckedRecordMirrorUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() =>
		reverseProjectedCheckedRecordMirrorUpdate(current, update));
});

test("projected checked-record mirror writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-projected-checked-record-mirror-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-projected-checked-record-mirror-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
