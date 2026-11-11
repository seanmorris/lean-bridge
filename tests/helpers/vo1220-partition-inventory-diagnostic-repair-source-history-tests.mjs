/**
 * Verify the retained-partition diagnostic repair and reversible source seal.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	assertVo1220PartitionInventoryDiagnosticRepair
	, beforeVo1220PartitionInventoryDiagnosticRepairSource
	, reverseVo1220PartitionInventoryDiagnosticRepairUpdate
	, vo1220PartitionInventoryDiagnosticRepairBehavior
	, vo1220PartitionInventoryDiagnosticRepairHistoryAdditions
	, vo1220PartitionInventoryDiagnosticRepairHistoryPath
	, vo1220PartitionInventoryDiagnosticRepairImplementation
	, vo1220PartitionInventoryDiagnosticRepairImplementationPaths
	, vo1220PartitionInventoryDiagnosticRepairIntegrationPaths
	, vo1220PartitionInventoryDiagnosticRepairPredecessor
} from "./vo1220-partition-inventory-diagnostic-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const history = async () => JSON.parse(await readFile(
	vo1220PartitionInventoryDiagnosticRepairHistoryPath, "utf8"));

test("partition inventory diagnostic repair records one exact implementation"
	, async () => {
		const value = await history();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "vo1220-partition-inventory-diagnostic-repair-source-v1");
		assert.equal(value.predecessorCommit
			, vo1220PartitionInventoryDiagnosticRepairPredecessor);
		assert.equal(value.implementationCommit
			, vo1220PartitionInventoryDiagnosticRepairImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, vo1220PartitionInventoryDiagnosticRepairImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, vo1220PartitionInventoryDiagnosticRepairIntegrationPaths);
		assert.deepEqual(value.behavior
			, vo1220PartitionInventoryDiagnosticRepairBehavior);
	}
);

test("partition inventory diagnostic repair reverses every source", async () => {
	const value = await history();
	for(const update of value.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			vo1220PartitionInventoryDiagnosticRepairImplementation, update.path)
			, update), true, update.path);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(
			vo1220PartitionInventoryDiagnosticRepairImplementation, update.path);
		assert.equal(reverseVo1220PartitionInventoryDiagnosticRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220PartitionInventoryDiagnosticRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("partition inventory diagnostic repair binds both complete audits", () => {
	const sources = Object.fromEntries(
		vo1220PartitionInventoryDiagnosticRepairImplementationPaths.map(path => [
			path, blob(vo1220PartitionInventoryDiagnosticRepairImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220PartitionInventoryDiagnosticRepair(sources)
		, vo1220PartitionInventoryDiagnosticRepairBehavior);
	for(const source of Object.values(sources))
	{
		const missingAggregate = source.replace(
			/context[.]test\("audited membership and assignment match together"/u
			, "context.test(\"membership only\"");
		assert.throws(() => assertVo1220PartitionInventoryDiagnosticRepair({
			...sources
			, [Object.entries(sources).find(([, value]) => value === source)[0]]:
				missingAggregate
		}));
	}
});

test("partition inventory diagnostic history authenticates additions and forgeries"
	, async () => {
		const value = await history();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, vo1220PartitionInventoryDiagnosticRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates.find(item => item.edits.length > 0);
		const current = blob(
			vo1220PartitionInventoryDiagnosticRepairImplementation, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseVo1220PartitionInventoryDiagnosticRepairUpdate(current, forged));
		const writer = spawnSync(process.execPath, [
			"scripts/update-vo1220-partition-inventory-diagnostic-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(writer.status, 0);
		assert.match(`${writer.stdout}${writer.stderr}`
			, /already exists|implementation/u);
	}
);
