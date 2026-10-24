/**
 * Authenticate the current-source type-surface pin repair.
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
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeTypeSurfaceCurrentPinRepairSource
	, reverseTypeSurfaceCurrentPinRepairUpdate
	, typeSurfaceCurrentPinRepairAddedPaths
	, typeSurfaceCurrentPinRepairChangedPaths
	, typeSurfaceCurrentPinRepairFinalizationPredecessor
	, typeSurfaceCurrentPinRepairHistoryPath
	, typeSurfaceCurrentPinRepairImplementation
	, typeSurfaceCurrentPinRepairIntegrationBase
	, typeSurfaceCurrentPinRepairIntegrationPaths
	, typeSurfaceCurrentPinRepairLivePins
	, typeSurfaceCurrentPinRepairPinTransitions
	, typeSurfaceCurrentPinRepairPredecessor
} from "./type-surface-current-pin-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("current type-surface pin repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		typeSurfaceCurrentPinRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "type-surface-current-pin-repair-source-v1");
	assert.equal(record.predecessorCommit
		, typeSurfaceCurrentPinRepairPredecessor);
	assert.equal(record.implementationCommit
		, typeSurfaceCurrentPinRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, typeSurfaceCurrentPinRepairIntegrationBase);
	assert.equal(record.finalizationPredecessorCommit
		, typeSurfaceCurrentPinRepairFinalizationPredecessor);
	assert.deepEqual(record.livePins, typeSurfaceCurrentPinRepairLivePins);
	assert.deepEqual(record.pinTransitions
		, typeSurfaceCurrentPinRepairPinTransitions);
	assert.deepEqual(record.updates.map(item => item.path)
		, [typeSurfaceCurrentPinRepairChangedPaths[0]
			, typeSurfaceCurrentPinRepairChangedPaths[0]]);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, typeSurfaceCurrentPinRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, typeSurfaceCurrentPinRepairAddedPaths);
	const path = typeSurfaceCurrentPinRepairChangedPaths[0];
	const current = await sourceAtFinHistoryMilestone(path
		, record.updates[0].currentSha256
		, beforeTypeSurfaceCurrentPinRepairSource);
	const intermediate = git(["show"
		, `${typeSurfaceCurrentPinRepairImplementation}:${path}`]);
	const previous = git(["show"
		, `${typeSurfaceCurrentPinRepairPredecessor}:${path}`]);
	assert.equal(beforeTypeSurfaceCurrentPinRepairSource(
		path, current, record.updates[1].currentSha256), intermediate);
	assert.equal(beforeFinRefinementSource(
		path, current, record.updates[1].previousSha256), previous);
	assert.ok(finRefinementNormalizationPaths.includes(path));
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeTypeSurfaceCurrentPinRepairSource);
		const previous = git(["show"
			, `${typeSurfaceCurrentPinRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseTypeSurfaceCurrentPinRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("current type-surface repair refreshes exactly 125 milestone pins", async () => {
	const record = JSON.parse(await readFile(
		typeSurfaceCurrentPinRepairHistoryPath, "utf8"));
	const update = record.integrationUpdates.find(item =>
		item.path === "docs/type-surface.v1.json");
	const inventory = JSON.parse(await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256));
	let count = 0;
	for(const pin of typeSurfaceCurrentPinRepairLivePins)
	{
		const matches = inventory.evidence.flatMap(evidence => evidence.files)
			.filter(file => file.path === pin.path);
		assert.equal(matches.length, pin.count, pin.path);
		assert.ok(matches.every(file => file.sha256 === pin.currentSha256)
			, pin.path);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			pin.path, pin.currentSha256))
			, pin.currentSha256, pin.path);
		count += matches.length;
	}
	assert.equal(count, 125);
});

test("current type-surface pin repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${typeSurfaceCurrentPinRepairImplementation}^`]).trim()
	, typeSurfaceCurrentPinRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, typeSurfaceCurrentPinRepairPredecessor
		, typeSurfaceCurrentPinRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...typeSurfaceCurrentPinRepairChangedPaths].sort());
	assert.equal(git(["rev-parse", `${typeSurfaceCurrentPinRepairIntegrationBase}^`])
		.trim(), typeSurfaceCurrentPinRepairFinalizationPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, typeSurfaceCurrentPinRepairFinalizationPredecessor
		, typeSurfaceCurrentPinRepairIntegrationBase])
		.trim().split("\n").filter(Boolean).sort()
	, [...typeSurfaceCurrentPinRepairChangedPaths].sort());
});

test("current type-surface pin repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		typeSurfaceCurrentPinRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeTypeSurfaceCurrentPinRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseTypeSurfaceCurrentPinRepairUpdate(
		current, update));
});

test("current type-surface pin writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-type-surface-current-pin-repair-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-type-surface-current-pin-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
