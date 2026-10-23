/**
 * Authenticate the dependent generic-Subtype compiler/review transition.
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
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeDependentGenericSubtypeSource
	, dependentGenericSubtypeChangedPaths
	, dependentGenericSubtypeHistoryPath
	, dependentGenericSubtypeImplementation
	, dependentGenericSubtypeIntegrationPaths
	, dependentGenericSubtypePredecessor
	, reverseDependentGenericSubtypeUpdate
} from "./dependent-generic-subtype-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent generic Subtype history restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentGenericSubtypeHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "dependent-generic-subtype-source-v1");
	assert.equal(record.predecessorCommit, dependentGenericSubtypePredecessor);
	assert.equal(record.implementationCommit, dependentGenericSubtypeImplementation);
	assert.equal(record.pinCount, 478);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentGenericSubtypeChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentGenericSubtypeIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentGenericSubtypeSource);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseDependentGenericSubtypeUpdate(current, update);
		assert.equal(previous, sourceAt(
			dependentGenericSubtypePredecessor, update.path));
		assert.equal(beforeDependentGenericSubtypeSource(
			update.path, current), previous);
		assert.equal(beforeDependentGenericSubtypeSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentGenericSubtypeSource);
		assert.equal(reverseDependentGenericSubtypeUpdate(current, update)
			, sourceAt(dependentGenericSubtypeImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("dependent generic Subtype history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		dependentGenericSubtypeHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentGenericSubtypeSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentGenericSubtypeUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseDependentGenericSubtypeUpdate(current, update));
});

test("dependent generic Subtype history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-generic-subtype-history-guard-"
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
		"scripts/update-dependent-generic-subtype-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
