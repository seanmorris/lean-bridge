/**
 * Authenticate the retained-contract milestone binding repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeRetainedContractMilestoneBindingSource
	, retainedContractMilestoneBindingHistoryAdditions
	, retainedContractMilestoneBindingHistoryPath
	, retainedContractMilestoneBindingImplementation
	, retainedContractMilestoneBindingImplementationPaths
	, retainedContractMilestoneBindingIntegrationPaths
	, retainedContractMilestoneBindingPredecessor
	, reverseRetainedContractMilestoneBindingUpdate
} from "./retained-contract-milestone-binding-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	retainedContractMilestoneBindingHistoryPath, "utf8"));
const blobDigest = (commit, path) => sha256(git([
	"show", `${commit}:${path}`
]));

test("retained-contract milestone binding records all ten repairs", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "retained-contract-milestone-binding-v1");
	assert.equal(value.predecessorCommit
		, retainedContractMilestoneBindingPredecessor);
	assert.equal(value.implementationCommit
		, retainedContractMilestoneBindingImplementation);
	assert.equal(value.updates.length, 10);
	assert.deepEqual(value.updates.map(item => item.path)
		, retainedContractMilestoneBindingImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, retainedContractMilestoneBindingIntegrationPaths);
	assert.deepEqual(git(["diff", "--name-only"
		, retainedContractMilestoneBindingPredecessor
		, retainedContractMilestoneBindingImplementation, "--"])
		.trim().split("\n").sort()
	, [...retainedContractMilestoneBindingImplementationPaths].sort());
	for(const update of value.updates)
	{
		assert.equal(update.previousSha256, blobDigest(
			retainedContractMilestoneBindingPredecessor, update.path), update.path);
		assert.equal(update.currentSha256, blobDigest(
			retainedContractMilestoneBindingImplementation, update.path), update.path);
	}
});

test("retained-contract milestone binding reverses source and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${retainedContractMilestoneBindingImplementation}:`
					+ update.path]);
			const previous = git(["show"
				, `${retainedContractMilestoneBindingPredecessor}:`
					+ update.path]);
			assert.equal(
				reverseRetainedContractMilestoneBindingUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeRetainedContractMilestoneBindingSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				retainedContractMilestoneBindingHistoryPath, update.path
					, update.currentSha256);
			const previous = git(["show"
				, `${retainedContractMilestoneBindingImplementation}:`
					+ update.path]);
			assert.equal(
				reverseRetainedContractMilestoneBindingUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("retained-contract milestone binding refreshes only pins in the inventory"
	, async () => {
		const value = await record();
		const inventory = value.integrationUpdates.find(update =>
			update.path === "docs/type-surface.v1.json");
		assert.ok(inventory);
		const digestPattern = /[0-9a-f]{64}/gu;
		let pins = 0;
		for(const edit of inventory.edits)
		{
			assert.equal(edit.current.replace(digestPattern, "")
				, edit.previous.replace(digestPattern, ""), inventory.path);
			pins += edit.current.match(digestPattern).length;
		}
		assert.equal(pins, 5);
	}
);

test("retained-contract milestone binding authenticates additions and model"
	, async () => {
		const value = await record();
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(value.changedSupportCells, 0);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, retainedContractMilestoneBindingHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${retainedContractMilestoneBindingImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of retainedContractMilestoneBindingIntegrationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		const exactSources = [retainedContractMilestoneBindingPredecessor
			, retainedContractMilestoneBindingImplementation].map(commit =>
			git(["show", `${commit}:${exactModelPath}`]));
		assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
	}
);

test("retained-contract milestone binding rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${retainedContractMilestoneBindingImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseRetainedContractMilestoneBindingUpdate(current, forged));
	assert.equal(beforeRetainedContractMilestoneBindingSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
	assert.equal(beforeRetainedContractMilestoneBindingSource("unknown.mjs"
		, current), current);
});

test("retained-contract milestone binding writer refuses an existing history"
	, () => {
		const result = spawnSync(process.execPath, [
			"scripts/update-retained-contract-milestone-binding-source-history.mjs"
		], { encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /History already exists/u);
	}
);
