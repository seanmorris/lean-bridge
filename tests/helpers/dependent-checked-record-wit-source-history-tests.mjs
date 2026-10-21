/**
 * Authenticate the dependent checked-record WIT source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeDependentCheckedRecordWitSource
	, dependentCheckedRecordWitChangedPaths
	, dependentCheckedRecordWitHistoryPath
	, dependentCheckedRecordWitImplementation
	, dependentCheckedRecordWitIntegrationPaths
	, dependentCheckedRecordWitPredecessor
	, reverseDependentCheckedRecordWitUpdate
} from "./dependent-checked-record-wit-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent checked-record WIT history restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-wit-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordWitPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordWitImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordWitChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordWitIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitSource);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseDependentCheckedRecordWitUpdate(
			current, update);
		assert.equal(previous, sourceAt(
			dependentCheckedRecordWitPredecessor, update.path));
		assert.equal(beforeDependentCheckedRecordWitSource(
			update.path, current), previous);
		assert.equal(beforeDependentCheckedRecordWitSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitSource);
		assert.equal(reverseDependentCheckedRecordWitUpdate(
			current, update), sourceAt(
			dependentCheckedRecordWitImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("dependent checked-record WIT history rejects altered transitions"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordWitSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordWitUpdate(
		current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseDependentCheckedRecordWitUpdate(
		current, update));
	}
);

test("dependent checked-record WIT history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-checked-record-wit-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-wit-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
