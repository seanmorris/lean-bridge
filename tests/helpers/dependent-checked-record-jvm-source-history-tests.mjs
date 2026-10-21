/**
 * Authenticate the dependent checked-record JVM source milestone.
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
	beforeDependentCheckedRecordJvmSource
	, dependentCheckedRecordJvmChangedPaths
	, dependentCheckedRecordJvmHistoryPath
	, dependentCheckedRecordJvmImplementation
	, dependentCheckedRecordJvmIntegrationPaths
	, dependentCheckedRecordJvmPredecessor
	, reverseDependentCheckedRecordJvmUpdate
} from "./dependent-checked-record-jvm-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent checked-record JVM history restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordJvmHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-jvm-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordJvmPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordJvmImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordJvmChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordJvmIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordJvmSource);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseDependentCheckedRecordJvmUpdate(
			current, update);
		assert.equal(previous, sourceAt(
			dependentCheckedRecordJvmPredecessor, update.path));
		assert.equal(beforeDependentCheckedRecordJvmSource(
			update.path, current), previous);
		assert.equal(beforeDependentCheckedRecordJvmSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordJvmSource);
		assert.equal(reverseDependentCheckedRecordJvmUpdate(
			current, update), sourceAt(
			dependentCheckedRecordJvmImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("dependent checked-record JVM history rejects altered transitions"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordJvmHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordJvmSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordJvmUpdate(
		current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseDependentCheckedRecordJvmUpdate(
		current, update));
	}
);

test("dependent checked-record JVM history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-checked-record-jvm-history-guard-"
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
		"scripts/update-dependent-checked-record-jvm-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
