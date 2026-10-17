/**
 * Authenticate the closed contract-profile registration for every inherited
 * checked-record test entrypoint.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import {
	beforeInheritedCheckedRecordTestRegistrationSource
	, inheritedCheckedRecordTestRegistrationChangedPaths
	, inheritedCheckedRecordTestRegistrationHistoryPath
	, inheritedCheckedRecordTestRegistrationPredecessor
	, reverseInheritedCheckedRecordTestRegistrationUpdate
} from "./helpers/inherited-checked-record-test-registration-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import { finHistoryMilestoneSource } from "./helpers/source-at-fin-history-milestone.mjs";

const expectedTests = [
	"inherited-checked-record-browser"
	, "inherited-checked-record-browser-controls"
	, "inherited-checked-record-native"
	, "inherited-checked-record-npm-source"
	, "inherited-checked-record-test-registration-history"
	, "inherited-checked-records"
];

test("inherited checked-record test registrations have one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordTestRegistrationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-test-registration-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordTestRegistrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordTestRegistrationChangedPaths);
	const original = path => execFileSync("git", ["show"
		, `${inheritedCheckedRecordTestRegistrationPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	const sourceAtMilestone = finHistoryMilestoneSource(
		record.updates, beforeInheritedCheckedRecordTestRegistrationSource
	);
	for(const update of record.updates)
	{
		const current = await sourceAtMilestone(update.path);
		const previous = original(update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordTestRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordTestRegistrationSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordTestRegistrationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordTestRegistrationSource(
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
			assert.throws(() => reverseInheritedCheckedRecordTestRegistrationUpdate(
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

test("inherited checked-record registration refreshes only live profile pins", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordTestRegistrationHistoryPath, "utf8"));
	assert.equal(record.pinCount, 94);
	assert.deepEqual(record.pinUpdates.map(item => [item.path, item.count])
		, [["src/adoption/test-profiles.mjs", 94]]);
	const inventoryUpdate = record.updates.find(
		update => update.path === "docs/type-surface.v1.json");
	const inventory = JSON.parse(beforeFinRefinementSource(
		inventoryUpdate.path, await readFile(inventoryUpdate.path, "utf8")
		, inventoryUpdate.currentSha256
	));
	const pin = record.pinUpdates[0];
	const files = inventory.evidence.flatMap(entry => entry.files)
		.filter(file => file.path === pin.path);
	assert.equal(files.filter(file => file.sha256
		=== pin.currentSha256).length, pin.count);
	assert.equal(files.filter(file => file.sha256
		=== pin.previousSha256).length, 0);
});

test("inherited checked-record registration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-checked-record-registration-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-inherited-checked-record-test-registration-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
