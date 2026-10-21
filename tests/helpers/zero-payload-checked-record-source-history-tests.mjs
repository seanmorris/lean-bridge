/**
 * Authenticate the zero-payload checked-record admission.
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
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeZeroPayloadCheckedRecordSource
	, reverseZeroPayloadCheckedRecordUpdate
	, zeroPayloadCheckedRecordChangedPaths
	, zeroPayloadCheckedRecordHistoryPath
	, zeroPayloadCheckedRecordImplementation
	, zeroPayloadCheckedRecordIntegrationPaths
	, zeroPayloadCheckedRecordPredecessor
} from "./zero-payload-checked-record-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const historyCommit = "a9968c5e1b0710091880409280d8047ce001fc4f";

test("zero-payload checked-record history restores every source", async () => {
	const record = JSON.parse(await readFile(zeroPayloadCheckedRecordHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-checked-record-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadCheckedRecordPredecessor);
	assert.equal(record.implementationCommit, zeroPayloadCheckedRecordImplementation);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	assert.deepEqual(record.updates.map(item => item.path), zeroPayloadCheckedRecordChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadCheckedRecordIntegrationPaths);
	for(const update of record.updates)
	{
		const current = sourceAt(historyCommit, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseZeroPayloadCheckedRecordUpdate(current, update);
		assert.equal(previous, sourceAt(zeroPayloadCheckedRecordPredecessor, update.path));
		assert.equal(beforeZeroPayloadCheckedRecordSource(update.path, current), previous);
		assert.equal(beforeZeroPayloadCheckedRecordSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeZeroPayloadCheckedRecordSource(
			update.path, `${current}unknown`), `${current}unknown`);
	}
	for(const update of record.integrationUpdates)
	{
		const current = sourceAt(historyCommit, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseZeroPayloadCheckedRecordUpdate(current, update)
			, sourceAt(zeroPayloadCheckedRecordImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(sourceAt(historyCommit, addition.path))
			, addition.currentSha256, addition.path);
});

test("zero-payload checked-record history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(zeroPayloadCheckedRecordHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = sourceAt(historyCommit, update.path);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadCheckedRecordUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadCheckedRecordUpdate(current, update));
});

test("zero-payload checked-record writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c"
		, "commit.gpgsign=false"
		, "commit"
		, "--allow-empty"
		, "--quiet"
		, "-m"
		, "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-checked-record-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
