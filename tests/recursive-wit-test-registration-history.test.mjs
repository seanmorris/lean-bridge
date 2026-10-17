/**
 * Authenticate the closed registration of recursive checked-record WIT tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import {
	beforeRecursiveWitTestRegistrationSource
	, recursiveWitTestRegistrationChangedPaths
	, recursiveWitTestRegistrationHistoryPath
	, recursiveWitTestRegistrationPredecessor
	, reverseRecursiveWitTestRegistrationUpdate
} from "./helpers/recursive-wit-test-registration-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import { finHistoryMilestoneSource } from "./helpers/source-at-fin-history-milestone.mjs";

const expectedTests = [
	"recursive-checked-record-wit-ci"
	, "recursive-checked-record-wit"
	, "recursive-wit-test-registration-history"
];

test("recursive WIT test registrations have one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		recursiveWitTestRegistrationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "recursive-wit-test-registration-source-v1");
	assert.equal(record.predecessorCommit
		, recursiveWitTestRegistrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, recursiveWitTestRegistrationChangedPaths);
	const original = path => execFileSync("git", ["show"
		, `${recursiveWitTestRegistrationPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	const sourceAtMilestone = finHistoryMilestoneSource(
		record.updates, beforeRecursiveWitTestRegistrationSource
	);
	for(const update of record.updates)
	{
		const current = await sourceAtMilestone(update.path);
		const previous = original(update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseRecursiveWitTestRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeRecursiveWitTestRegistrationSource(
			update.path, current), previous, update.path);
		assert.equal(beforeRecursiveWitTestRegistrationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeRecursiveWitTestRegistrationSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => {
				if(item.edits) item.edits[0].current += "unknown";
				else item.replacements[0].current = "0".repeat(64);
			}
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRecursiveWitTestRegistrationUpdate(
				current, changed));
		}
	}
	const profile = record.updates.find(
		update => update.path === "src/adoption/test-profiles.mjs");
	assert.deepEqual(profile.addedTests, expectedTests);
	for(const name of expectedTests)
	{
		const path = `tests/${name}.test.mjs`;
		await access(path);
		assert.equal(classifyRepositoryTest(path), "contract", path);
	}
});

test("recursive WIT registration refreshes only matching current-source pins", async () => {
	const record = JSON.parse(await readFile(
		recursiveWitTestRegistrationHistoryPath, "utf8"));
	assert.equal(record.pinCount, record.pinUpdates.reduce(
		(count, pin) => count + pin.count, 0));
	const pin = record.pinUpdates.find(
		item => item.path === "src/adoption/test-profiles.mjs");
	assert.ok(pin);
	assert.equal(pin.path, "src/adoption/test-profiles.mjs");
	assert.equal(pin.count, 94);
	const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	for(const update of record.pinUpdates)
	{
		const files = inventory.evidence.flatMap(entry => entry.files)
			.filter(file => file.path === update.path);
		assert.equal(files.filter(file => file.sha256
			=== update.currentSha256).length, update.count, update.path);
		assert.equal(files.filter(file => file.sha256
			=== update.previousSha256).length, 0, update.path);
	}
});
