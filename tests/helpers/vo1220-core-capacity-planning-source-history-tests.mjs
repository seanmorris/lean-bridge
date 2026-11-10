/**
 * Verify capacity-aware Core planning and its reversible source seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220CoreCapacityPlanning
	, beforeVo1220CoreCapacityPlanningSource
	, reverseVo1220CoreCapacityPlanningUpdate
	, vo1220CoreCapacityPlanningBehavior
	, vo1220CoreCapacityPlanningHistoryAdditions
	, vo1220CoreCapacityPlanningHistoryPath
	, vo1220CoreCapacityPlanningImplementation
	, vo1220CoreCapacityPlanningImplementationPaths
	, vo1220CoreCapacityPlanningIntegrationPaths
	, vo1220CoreCapacityPlanningPredecessor
} from "./vo1220-core-capacity-planning-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const history = async () => JSON.parse(await readFile(
	vo1220CoreCapacityPlanningHistoryPath, "utf8"));

test("Core capacity planning records one exact implementation boundary"
	, async () => {
		const value = await history();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "vo1220-core-capacity-planning-source-v1");
		assert.equal(value.predecessorCommit
			, vo1220CoreCapacityPlanningPredecessor);
		assert.equal(value.implementationCommit
			, vo1220CoreCapacityPlanningImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, vo1220CoreCapacityPlanningImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, vo1220CoreCapacityPlanningIntegrationPaths);
		assert.deepEqual(value.behavior, vo1220CoreCapacityPlanningBehavior);
		assert.equal(value.plan.length, 12);
		assert.deepEqual(value.plan.map(item => item.concurrency)
			, [2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2]);
		assert.equal(Math.max(...value.plan.map(item => item.modeledWallMinutes))
			, 159.64);
	}
);

test("Core capacity planning reverses every authenticated source", async () => {
	const value = await history();
	for(const update of value.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			vo1220CoreCapacityPlanningImplementation, update.path), update)
			, true, update.path);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(
			vo1220CoreCapacityPlanningImplementation, update.path);
		assert.equal(reverseVo1220CoreCapacityPlanningUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220CoreCapacityPlanningSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Core capacity planning retains a conservative cost high-water mark"
	, () => {
		const currentSources = Object.fromEntries(
			vo1220CoreCapacityPlanningImplementationPaths.map(path => [
				path, blob(vo1220CoreCapacityPlanningImplementation, path)
			])
		);
		assert.deepEqual(assertVo1220CoreCapacityPlanning(currentSources)
			, vo1220CoreCapacityPlanningBehavior);
		const previous = JSON.parse(blob(vo1220CoreCapacityPlanningPredecessor
			, "scripts/core-contract-costs.json"));
		const current = JSON.parse(currentSources["scripts/core-contract-costs.json"]);
		assert.deepEqual(Object.keys(current.costs), Object.keys(previous.costs));
		for(const [path, prior] of Object.entries(previous.costs))
			assert.ok(current.costs[path].minutes >= prior.minutes, path);
		for(const path of [
			"tests/component-refinement-mirrors.test.mjs"
			, "tests/component-nominal-subtype.test.mjs"
			, "tests/component-nominal-subtype-history.test.mjs"
			, "tests/nominal-primitive-subtype.test.mjs"
		]) assert.equal(current.costs[path].minutes
			, previous.costs[path].minutes, path);
	}
);

test("Core capacity planning authenticates additions and rejects forgeries"
	, async () => {
		const value = await history();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, vo1220CoreCapacityPlanningHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates.find(item => item.edits.length > 0);
		const current = blob(
			vo1220CoreCapacityPlanningImplementation, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseVo1220CoreCapacityPlanningUpdate(current, forged));
		const writer = spawnSync(process.execPath, [
			"scripts/update-vo1220-core-capacity-planning-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(writer.status, 0);
		assert.match(`${writer.stdout}${writer.stderr}`
			, /already exists|implementation/u);
	}
);
