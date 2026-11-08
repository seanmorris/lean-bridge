/**
 * Verify the exact bounded-promotion live-pin repair and source-history seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "./dependent-checked-record-promotion.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeVo1220NestedPromotionMemoryBoundPinRepairSource
	, reverseVo1220NestedPromotionMemoryBoundPinRepairUpdate
	, vo1220NestedPromotionMemoryBoundPinRepairAdditions
	, vo1220NestedPromotionMemoryBoundPinRepairBehavior
	, vo1220NestedPromotionMemoryBoundPinRepairHistoryPath
	, vo1220NestedPromotionMemoryBoundPinRepairImplementation
	, vo1220NestedPromotionMemoryBoundPinRepairImplementationPaths
	, vo1220NestedPromotionMemoryBoundPinRepairIntegrationPaths
	, vo1220NestedPromotionMemoryBoundPinRepairNormalizationPaths
	, vo1220NestedPromotionMemoryBoundPinRepairPredecessor
	, vo1220NestedPromotionMemoryBoundPinRepairSourcePaths
} from "./vo1220-nested-promotion-memory-bound-pin-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220NestedPromotionMemoryBoundPinRepairHistoryPath, "utf8"
));

test("bounded promotion pin repair authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-nested-promotion-memory-bound-pin-repair-v1");
	assert.equal(value.predecessorCommit
		, vo1220NestedPromotionMemoryBoundPinRepairPredecessor);
	assert.equal(value.implementationCommit
		, vo1220NestedPromotionMemoryBoundPinRepairImplementation);
	assert.deepEqual(value.implementationUpdates.map(item => item.path)
		, vo1220NestedPromotionMemoryBoundPinRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, vo1220NestedPromotionMemoryBoundPinRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path)
		, vo1220NestedPromotionMemoryBoundPinRepairAdditions);
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of [
		...value.implementationUpdates
		, ...value.integrationUpdates
	]) {
		const current = update.path === "docs/type-surface.v1.json"
			? blob(vo1220NestedPromotionMemoryBoundPinRepairImplementation
				, update.path)
			: await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
		const base = value.integrationUpdates.includes(update)
			? vo1220NestedPromotionMemoryBoundPinRepairImplementation
			: vo1220NestedPromotionMemoryBoundPinRepairPredecessor;
		const previous = blob(base, update.path);
		assert.equal(reverseVo1220NestedPromotionMemoryBoundPinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("bounded promotion pin repair changes exactly 44 live pins", async () => {
	const value = await read();
	assert.deepEqual(value.behavior
		, vo1220NestedPromotionMemoryBoundPinRepairBehavior);
	assert.deepEqual(value.pinCounts.map(item => [item.path, item.count]), [
		[vo1220NestedPromotionMemoryBoundPinRepairSourcePaths[0], 4]
		, [vo1220NestedPromotionMemoryBoundPinRepairSourcePaths[1], 4]
		, [vo1220NestedPromotionMemoryBoundPinRepairSourcePaths[2], 36]
	]);
	const before = JSON.parse(blob(
		vo1220NestedPromotionMemoryBoundPinRepairPredecessor
		, "docs/type-surface.v1.json"));
	assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
		before, vo1220NestedPromotionMemoryBoundPinRepairSourcePaths).sort()
		, [...vo1220NestedPromotionMemoryBoundPinRepairSourcePaths].sort());
	const reconciled = reconcileDependentCheckedRecordSourcePins(before
		, new Map(value.pinCounts.map(item =>
			[item.path, item.currentSha256])));
	assert.equal(reconciled.refreshed, 44);
	const after = JSON.parse(blob(
		vo1220NestedPromotionMemoryBoundPinRepairImplementation
		, "docs/type-surface.v1.json"));
	assert.deepEqual(after, reconciled.inventory);
	for(const item of value.pinCounts)
		for(const evidence of after.evidence) for(const file of evidence.files)
			if(file.path === item.path) file.sha256 = item.previousSha256;
	assert.deepEqual(after, before, "Only the exact 44 live pins may change");
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(blob(vo1220NestedPromotionMemoryBoundPinRepairPredecessor
		, "docs/evidence/vo1220-exact-type-surface-v1.json")
		, blob(vo1220NestedPromotionMemoryBoundPinRepairImplementation
			, "docs/evidence/vo1220-exact-type-surface-v1.json"));
});

test("bounded promotion pin repair rejects unknown and forged transitions"
	, async () => {
		const update = (await read()).implementationUpdates[0];
		const current = blob(vo1220NestedPromotionMemoryBoundPinRepairImplementation
			, update.path);
		assert.equal(beforeVo1220NestedPromotionMemoryBoundPinRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeVo1220NestedPromotionMemoryBoundPinRepairSource(
			update.path, current + "unknown"), current + "unknown");
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
			assert.throws(() =>
				reverseVo1220NestedPromotionMemoryBoundPinRepairUpdate(
					current, forged));
		assert.ok(vo1220NestedPromotionMemoryBoundPinRepairNormalizationPaths
			.includes(update.path));
	}
);

test("bounded promotion pin-repair writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-nested-pin-repair-guard-`);
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
		"scripts/update-vo1220-nested-promotion-memory-bound-pin-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
