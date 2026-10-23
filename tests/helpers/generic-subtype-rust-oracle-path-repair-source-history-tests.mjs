/**
 * Authenticate the generic-Subtype Rust oracle path repair.
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
	beforeGenericSubtypeRustOraclePathRepairSource
	, genericSubtypeRustOraclePathRepairAddedPaths
	, genericSubtypeRustOraclePathRepairChangedPaths
	, genericSubtypeRustOraclePathRepairHistoryPath
	, genericSubtypeRustOraclePathRepairImplementation
	, genericSubtypeRustOraclePathRepairIntegrationPaths
	, genericSubtypeRustOraclePathRepairPredecessor
	, reverseGenericSubtypeRustOraclePathRepairUpdate
} from "./generic-subtype-rust-oracle-path-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("generic-Subtype Rust oracle path repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		genericSubtypeRustOraclePathRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "generic-subtype-rust-oracle-path-repair-source-v1");
	assert.equal(record.predecessorCommit
		, genericSubtypeRustOraclePathRepairPredecessor);
	assert.equal(record.implementationCommit
		, genericSubtypeRustOraclePathRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, genericSubtypeRustOraclePathRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, genericSubtypeRustOraclePathRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, genericSubtypeRustOraclePathRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeGenericSubtypeRustOraclePathRepairSource);
		const previous = git(["show"
			, `${genericSubtypeRustOraclePathRepairPredecessor}:${update.path}`]);
		assert.equal(reverseGenericSubtypeRustOraclePathRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeGenericSubtypeRustOraclePathRepairSource);
		const previous = git(["show"
			, `${genericSubtypeRustOraclePathRepairImplementation}:${update.path}`]);
		assert.equal(reverseGenericSubtypeRustOraclePathRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("generic-Subtype Rust oracle path repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${genericSubtypeRustOraclePathRepairImplementation}^`]).trim()
	, genericSubtypeRustOraclePathRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, genericSubtypeRustOraclePathRepairPredecessor
		, genericSubtypeRustOraclePathRepairImplementation])
		.trim().split("\n").sort()
	, [...genericSubtypeRustOraclePathRepairChangedPaths].sort());
});

test("generic-Subtype Rust oracle path repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		genericSubtypeRustOraclePathRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeGenericSubtypeRustOraclePathRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseGenericSubtypeRustOraclePathRepairUpdate(
		current, update));
});

test("generic-Subtype Rust oracle path writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-generic-subtype-rust-oracle-path-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-generic-subtype-rust-oracle-path-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
