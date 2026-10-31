/**
 * Authenticate the closed registration of late checked-record test entrypoints.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { sourceAtFinHistoryRecordSource } from "./helpers/source-at-fin-history-milestone.mjs";
import {
	beforeLateCheckedRecordTestRegistrationSource
	, lateCheckedRecordTestRegistrationChangedPaths
	, lateCheckedRecordTestRegistrationHistoryPath
	, lateCheckedRecordTestRegistrationPredecessor
	, reverseLateCheckedRecordTestRegistrationUpdate
} from "./helpers/late-checked-record-test-registration-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";

const sourceAt = (path, expected) => sourceAtFinHistoryRecordSource(
	lateCheckedRecordTestRegistrationHistoryPath, path, expected
	, beforeLateCheckedRecordTestRegistrationSource
);

const expectedTests = [
	"late-checked-record-test-registration-history"
	, "php-graph-refinement-diagnostics"
	, "recursive-checked-record-php-ci"
	, "recursive-checked-record-php"
	, "recursive-checked-record-php-wasm"
	, "wit-graph-refinement-diagnostics"
];

test("late checked-record test registrations have one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		lateCheckedRecordTestRegistrationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "late-checked-record-test-registration-source-v1");
	assert.equal(record.predecessorCommit
		, lateCheckedRecordTestRegistrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, lateCheckedRecordTestRegistrationChangedPaths);
	const original = path => execFileSync("git", ["show"
		, `${lateCheckedRecordTestRegistrationPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAt(
			update.path, update.currentSha256
		);
		const previous = original(update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseLateCheckedRecordTestRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeLateCheckedRecordTestRegistrationSource(
			update.path, current), previous, update.path);
		assert.equal(beforeLateCheckedRecordTestRegistrationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeLateCheckedRecordTestRegistrationSource(
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
			assert.throws(() => reverseLateCheckedRecordTestRegistrationUpdate(
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

test("late test registration refreshes only matching current-source pins", async () => {
	const record = JSON.parse(await readFile(
		lateCheckedRecordTestRegistrationHistoryPath, "utf8"));
	assert.equal(record.pinCount, 94);
	assert.equal(record.pinUpdates.length, 1);
	const pin = record.pinUpdates[0];
	assert.equal(pin.path, "src/adoption/test-profiles.mjs");
	assert.equal(pin.count, record.pinCount);
	const inventoryUpdate = record.updates.find(
		update => update.path === "docs/type-surface.v1.json");
	const inventory = JSON.parse(await sourceAt(
		inventoryUpdate.path, inventoryUpdate.currentSha256
	));
	const files = inventory.evidence.flatMap(entry => entry.files)
		.filter(file => file.path === pin.path);
	assert.equal(files.filter(file => file.sha256 === pin.currentSha256).length
		, pin.count);
	assert.equal(files.filter(file => file.sha256 === pin.previousSha256).length, 0);
});
