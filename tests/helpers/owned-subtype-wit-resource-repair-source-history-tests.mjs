/**
 * Authenticate the owned-Subtype WIT resource-name assertion repair.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedSubtypeWitResourceRepairSource
	, ownedSubtypeWitResourceRepairAddedPaths
	, ownedSubtypeWitResourceRepairHistoryPath
	, ownedSubtypeWitResourceRepairImplementation
	, ownedSubtypeWitResourceRepairImplementationPaths
	, ownedSubtypeWitResourceRepairIntegrationPaths
	, ownedSubtypeWitResourceRepairPredecessor
	, reverseOwnedSubtypeWitResourceRepairUpdate
} from "./owned-subtype-wit-resource-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned Subtype WIT resource history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeWitResourceRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-wit-resource-repair-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypeWitResourceRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypeWitResourceRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeWitResourceRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeWitResourceRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeWitResourceRepairAddedPaths);
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedSubtypeWitResourceRepairSource);
		const base = record.updates.includes(update)
			? ownedSubtypeWitResourceRepairPredecessor
			: ownedSubtypeWitResourceRepairImplementation;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeWitResourceRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned Subtype WIT resource history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeWitResourceRepairImplementation}^`]).trim()
	, ownedSubtypeWitResourceRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeWitResourceRepairPredecessor
		, ownedSubtypeWitResourceRepairImplementation]).trim()
		.split("\n").sort()
	, [...ownedSubtypeWitResourceRepairImplementationPaths].sort());
});

test("owned Subtype WIT resource history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeWitResourceRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedSubtypeWitResourceRepairSource);
	assert.throws(() => reverseOwnedSubtypeWitResourceRepairUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseOwnedSubtypeWitResourceRepairUpdate(current
		, { ...update, path: "unknown.mjs" }));
	assert.equal(beforeOwnedSubtypeWitResourceRepairSource(
		update.path, `${current}unknown`), `${current}unknown`);
});

test("owned Subtype WIT resource writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-owned-subtype-wit-resource-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-wit-resource-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
