/**
 * Authenticate the owned checked-record PHP-Wasm retained handoff change.
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
	beforeOwnedCheckedRecordPhpWasmRetainedHandoffSource
	, ownedCheckedRecordPhpWasmRetainedHandoffAddedPaths
	, ownedCheckedRecordPhpWasmRetainedHandoffHistoryPath
	, ownedCheckedRecordPhpWasmRetainedHandoffImplementation
	, ownedCheckedRecordPhpWasmRetainedHandoffImplementationPaths
	, ownedCheckedRecordPhpWasmRetainedHandoffIntegrationPaths
	, ownedCheckedRecordPhpWasmRetainedHandoffModifiedPaths
	, ownedCheckedRecordPhpWasmRetainedHandoffPredecessor
	, reverseOwnedCheckedRecordPhpWasmRetainedHandoffUpdate
} from "./owned-checked-record-php-wasm-retained-handoff-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned checked-record PHP-Wasm retained handoff restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordPhpWasmRetainedHandoffHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-php-wasm-retained-handoff-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordPhpWasmRetainedHandoffPredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordPhpWasmRetainedHandoffImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordPhpWasmRetainedHandoffModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedRecordPhpWasmRetainedHandoffIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordPhpWasmRetainedHandoffAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedCheckedRecordPhpWasmRetainedHandoffSource);
		const previous = git(["show"
			, `${ownedCheckedRecordPhpWasmRetainedHandoffPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordPhpWasmRetainedHandoffUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedCheckedRecordPhpWasmRetainedHandoffSource);
		const previous = git(["show"
			, `${ownedCheckedRecordPhpWasmRetainedHandoffImplementation}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordPhpWasmRetainedHandoffUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned checked-record PHP-Wasm retained handoff range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedCheckedRecordPhpWasmRetainedHandoffImplementation}^`]).trim()
	, ownedCheckedRecordPhpWasmRetainedHandoffPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedRecordPhpWasmRetainedHandoffPredecessor
		, ownedCheckedRecordPhpWasmRetainedHandoffImplementation]).trim().split("\n").sort()
	, [...ownedCheckedRecordPhpWasmRetainedHandoffImplementationPaths].sort());
});

test("owned checked-record PHP-Wasm retained handoff rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordPhpWasmRetainedHandoffHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeOwnedCheckedRecordPhpWasmRetainedHandoffSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseOwnedCheckedRecordPhpWasmRetainedHandoffUpdate(current, update));
});

test("owned checked-record PHP-Wasm retained handoff writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-checked-record-php-wasm-retained-handoff-history-"));
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
		"scripts/update-owned-checked-record-php-wasm-retained-handoff-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
