/**
 * Exact source-history and closed-classification controls for the test backlog.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import {
	beforeCiContractRepairSource
	, ciContractRepairChangedPaths
	, ciContractRepairHistoryPath
	, ciContractRepairPathSetSha256
	, ciContractRepairPredecessor
	, reverseCiContractRepairUpdate
} from "./helpers/ci-contract-repair-source-history.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./helpers/source-at-fin-history-milestone.mjs";
import {
	beforeTestProfileBacklogRepairSource
	, reverseTestProfileBacklogRepairUpdate
	, testProfileBacklogRepairChangedPaths
	, testProfileBacklogRepairHistoryPath
	, testProfileBacklogRepairPredecessor
} from "./helpers/test-profile-backlog-repair-history.mjs";

test("checked-record test backlog is closed by one authenticated registration", async () => {
	const record = JSON.parse(await readFile(
		testProfileBacklogRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "test-profile-backlog-repair-source-v1");
	assert.equal(record.predecessorCommit, testProfileBacklogRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, testProfileBacklogRepairChangedPaths);
	const original = path => execFileSync("git", ["show"
		, `${testProfileBacklogRepairPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8")
			, update.currentSha256
		);
		const previous = original(update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseTestProfileBacklogRepairUpdate(current, update)
			, previous);
		assert.equal(beforeTestProfileBacklogRepairSource(
			update.path, current
		), previous);
		assert.equal(beforeTestProfileBacklogRepairSource(
			update.path, current, update.currentSha256
		), current);
		assert.equal(beforeTestProfileBacklogRepairSource(
			update.path, current + "unknown"
		), current + "unknown");
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256
		), previous);
		if(update.path === "src/adoption/test-profiles.mjs")
		{
			assert.equal(update.edits.map(edit => edit.current).join("")
				, update.addedTests.map(name => `\t\t, "${name}"\n`).join(""));
			for(const name of update.addedTests)
			{
				const path = `tests/${name}.test.mjs`;
				await access(path);
				assert.equal(classifyRepositoryTest(path), "contract", path);
			}
		}
		else
		{
			assert.equal(update.replacements.length, 1);
			assert.equal(update.replacements[0].count, 94);
		}
		const mutations = [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
		];
		if(update.path === "src/adoption/test-profiles.mjs") mutations.push(
			item => { item.addedTests = []; }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		);
		else mutations.push(
			item => { item.replacements = []; }
			, item => { item.replacements[0].count += 1; }
			, item => { item.replacements[0].current += "unknown"; }
		);
		for(const mutate of mutations)
		{
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reverseTestProfileBacklogRepairUpdate(
				current, changed
			));
		}
	}
});

test("contract repair authenticates every changed source and refreshed pin", async () => {
	const record = JSON.parse(await readFile(ciContractRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "ci-contract-repair-source-v1");
	assert.equal(record.predecessorCommit, ciContractRepairPredecessor);
	assert.equal(record.pathsSha256, ciContractRepairPathSetSha256);
	assert.deepEqual(record.updates.map(update => update.path)
		, ciContractRepairChangedPaths);
	const original = path => execFileSync("git", ["show"
		, `${ciContractRepairPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8")
			, update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseCiContractRepairUpdate(current, update);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(beforeCiContractRepairSource(update.path, current)
			, previous);
		assert.equal(beforeCiContractRepairSource(
			update.path, current, update.currentSha256
		), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256
		), previous);
		if(![
			"docs/type-surface.v1.json"
			, "tests/helpers/fin-refinement-source-history.mjs"
		].includes(update.path)) assert.equal(previous, original(update.path)
			, update.path);
	}
	const inventoryUpdate = record.updates.find(
		update => update.path === "docs/type-surface.v1.json"
	);
	const inventory = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryUpdate.path, inventoryUpdate.currentSha256
		, beforeCiContractRepairSource
	));
	let pinCount = 0;
	for(const pin of record.pinUpdates)
	{
		const matches = inventory.evidence.flatMap(entry => entry.files)
			.filter(file => file.path === pin.path
				&& file.sha256 === pin.currentSha256);
		assert.equal(matches.length, pin.count, pin.path);
		assert.equal(inventory.evidence.flatMap(entry => entry.files)
			.filter(file => file.path === pin.path
				&& file.sha256 === pin.previousSha256).length, 0, pin.path);
		pinCount += pin.count;
	}
	assert.equal(pinCount, record.pinCount);
	const firstUpdate = record.updates[0];
	const firstCurrent = await sourceAtFinHistoryMilestone(
		firstUpdate.path, firstUpdate.currentSha256
		, beforeCiContractRepairSource
	);
	for(const mutate of [
		update => { update.path = "unknown"; }
		, update => { update.previousSha256 = "0".repeat(64); }
		, update => { update.currentSha256 = "0".repeat(64); }
		, update => { update.edits = []; }
		, update => { update.edits[0].start = -1; }
		, update => { update.edits[0].current += "unknown"; }
	]) {
		const update = structuredClone(record.updates[0]);
		mutate(update);
		assert.throws(() => reverseCiContractRepairUpdate(
			firstCurrent, update
		));
	}
});
