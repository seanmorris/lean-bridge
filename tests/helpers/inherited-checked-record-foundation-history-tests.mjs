/**
 * Preserve every earlier source receipt across inherited checked-record
 * compiler admission and refuse unrecorded bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeInheritedCheckedRecordFoundationPins
	, beforeInheritedCheckedRecordFoundationSource
	, inheritedCheckedRecordFoundationAddedPaths
	, inheritedCheckedRecordFoundationChangedPaths
	, inheritedCheckedRecordFoundationHistoryPath
	, inheritedCheckedRecordFoundationPredecessor
	, reverseInheritedCheckedRecordFoundationUpdate
} from "./inherited-checked-record-foundation-history.mjs";
import {
	beforeInheritedCheckedRecordFoundationVerifierSource
	, inheritedCheckedRecordFoundationVerifierAddedPaths
	, inheritedCheckedRecordFoundationVerifierChangedPaths
	, inheritedCheckedRecordFoundationVerifierHistoricalCommits
	, inheritedCheckedRecordFoundationVerifierHistoricalPaths
	, inheritedCheckedRecordFoundationVerifierHistoryPath
	, inheritedCheckedRecordFoundationVerifierPredecessor
	, reverseInheritedCheckedRecordFoundationVerifierUpdate
} from "./inherited-checked-record-foundation-verifier-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

test("inherited checked-record foundation has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordFoundationHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-foundation-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordFoundationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordFoundationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordFoundationAddedPaths);
	assert.equal(record.pathsSha256
		, sha256(JSON.stringify(inheritedCheckedRecordFoundationChangedPaths)));
	assert.equal(record.pinCount, 496);
	const original = path => execFileSync("git", ["show"
		, `${inheritedCheckedRecordFoundationPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordFoundationSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseInheritedCheckedRecordFoundationUpdate(
			current, update
		);
		assert.equal(previous, original(update.path), update.path);
		assert.equal(beforeInheritedCheckedRecordFoundationSource(
			update.path, current
		), previous);
		assert.equal(beforeInheritedCheckedRecordFoundationSource(
			update.path, current, update.currentSha256
		), current);
		assert.equal(beforeInheritedCheckedRecordFoundationSource(
			update.path, `${current}unknown`
		), `${current}unknown`);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256
		), previous);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
		]) {
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reverseInheritedCheckedRecordFoundationUpdate(
				current, changed
			));
		}
		if(update.edits)
		{
			for(const mutate of [item => { item.edits = []; }
				, item => { item.edits[0].start = -1; }
				, item => { item.edits[0].current += "unknown"; }]) {
				const changed = structuredClone(update);
				mutate(changed);
				assert.throws(() => reverseInheritedCheckedRecordFoundationUpdate(
					current, changed
				));
				}
		}
		else
		{
			for(const mutate of [item => { item.replacements = []; }
				, item => { item.replacements[0].count = 0; }
				, item => { item.replacements[0].current = "0".repeat(64); }]) {
				const changed = structuredClone(update);
				mutate(changed);
				assert.throws(() => reverseInheritedCheckedRecordFoundationUpdate(
					current, changed
				));
				}
		}
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		))
			, addition.currentSha256, addition.path);
	const inventoryUpdate = record.updates.find(update =>
		update.path === "docs/type-surface.v1.json");
	assert.ok(inventoryUpdate);
	const currentInventory = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryUpdate.path, inventoryUpdate.currentSha256
		, beforeInheritedCheckedRecordFoundationSource
	));
	const previousInventory = JSON.parse(original("docs/type-surface.v1.json"));
	assert.deepEqual(beforeInheritedCheckedRecordFoundationPins(currentInventory)
		, previousInventory);
});

test("foundation verifier repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordFoundationVerifierHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-foundation-verifier-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordFoundationVerifierPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordFoundationVerifierChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordFoundationVerifierAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordFoundationVerifierChangedPaths)));
	assert.equal(record.pinCount, 0);
	assert.deepEqual(record.pinUpdates, []);
	assert.deepEqual(record.historicalTransitions.map(transition =>
		transition.commit
	), inheritedCheckedRecordFoundationVerifierHistoricalCommits);
	assert.deepEqual([...new Set(record.historicalTransitions.flatMap(
		transition => transition.updates.map(update => update.path)
	))], inheritedCheckedRecordFoundationVerifierHistoricalPaths);
	const original = path => execFileSync("git", ["show"
		, `${inheritedCheckedRecordFoundationVerifierPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordFoundationVerifierSource
		);
		const previous = original(update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordFoundationVerifierUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordFoundationVerifierSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordFoundationVerifierSource(
			update.path, current, update.currentSha256), current, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordFoundationVerifierSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => {
				reverseInheritedCheckedRecordFoundationVerifierUpdate(
					current, changed
				);
			});
		}
	}
	for(const transition of record.historicalTransitions)
	{
		assert.equal(execFileSync("git", ["rev-parse"
			, `${transition.commit}^`], { encoding: "utf8" }).trim()
			, transition.predecessorCommit);
		for(const update of transition.updates)
		{
			const current = execFileSync("git", ["show"
				, `${transition.commit}:${update.path}`], { encoding: "utf8" });
			const previous = execFileSync("git", ["show"
				, `${transition.predecessorCommit}:${update.path}`]
			, { encoding: "utf8" });
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseInheritedCheckedRecordFoundationVerifierUpdate(
				current, update), previous, update.path);
		}
	}
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordFoundationVerifierPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("inherited checked-record history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-checked-record-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, {
		cwd: root, env, stdio: "pipe"
	});
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-inherited-checked-record-foundation-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("foundation verifier history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-foundation-verifier-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, {
		cwd: root, env, stdio: "pipe"
	});
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-inherited-checked-record-foundation-verifier-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
