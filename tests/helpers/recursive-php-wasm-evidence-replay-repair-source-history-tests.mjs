/**
 * Authenticate the recursive PHP-Wasm evidence-replay repair.
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
	beforeRecursivePhpWasmEvidenceReplayRepairSource
	, recursivePhpWasmEvidenceReplayRepairAddedPaths
	, recursivePhpWasmEvidenceReplayRepairHistoricalPaths
	, recursivePhpWasmEvidenceReplayRepairHistoryPath
	, recursivePhpWasmEvidenceReplayRepairImplementation
	, recursivePhpWasmEvidenceReplayRepairIntegrationPaths
	, recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor
	, recursivePhpWasmEvidenceReplayRepairPredecessor
	, reverseRecursivePhpWasmEvidenceReplayRepairUpdate
} from "./recursive-php-wasm-evidence-replay-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("recursive PHP-Wasm evidence replay repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		recursivePhpWasmEvidenceReplayRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "recursive-php-wasm-evidence-replay-repair-v1");
	assert.equal(record.predecessorCommit
		, recursivePhpWasmEvidenceReplayRepairPredecessor);
	assert.equal(record.implementationCommit
		, recursivePhpWasmEvidenceReplayRepairImplementation);
	assert.equal(record.integrationPredecessorCommit
		, recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor);
	assert.deepEqual(record.historicalUpdates.map(item => item.path)
		, recursivePhpWasmEvidenceReplayRepairHistoricalPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, recursivePhpWasmEvidenceReplayRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, recursivePhpWasmEvidenceReplayRepairAddedPaths);
	for(const update of record.historicalUpdates)
	{
		const current = git(["show"
			, `${recursivePhpWasmEvidenceReplayRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${recursivePhpWasmEvidenceReplayRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseRecursivePhpWasmEvidenceReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeRecursivePhpWasmEvidenceReplayRepairSource);
		const previous = git(["show"
			, `${recursivePhpWasmEvidenceReplayRepairIntegrationPredecessor}:${update.path}`]);
		assert.equal(reverseRecursivePhpWasmEvidenceReplayRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("recursive PHP-Wasm evidence replay repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${recursivePhpWasmEvidenceReplayRepairImplementation}^`]).trim()
	, recursivePhpWasmEvidenceReplayRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, recursivePhpWasmEvidenceReplayRepairPredecessor
		, recursivePhpWasmEvidenceReplayRepairImplementation]).trim()
		.split("\n").sort()
	, [...recursivePhpWasmEvidenceReplayRepairHistoricalPaths].sort());
});

test("recursive PHP-Wasm evidence replay repair rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		recursivePhpWasmEvidenceReplayRepairHistoryPath, "utf8"));
	const update = structuredClone(record.historicalUpdates[0]);
	const current = git(["show"
		, `${recursivePhpWasmEvidenceReplayRepairImplementation}:${update.path}`]);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseRecursivePhpWasmEvidenceReplayRepairUpdate(
		current, update));
	const unknown = `${current}\nunknown`;
	assert.equal(beforeRecursivePhpWasmEvidenceReplayRepairSource(
		update.path, unknown), unknown);
});

test("recursive PHP-Wasm evidence replay history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-recursive-php-wasm-evidence-replay-history-"));
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
		"scripts/update-recursive-php-wasm-evidence-replay-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
