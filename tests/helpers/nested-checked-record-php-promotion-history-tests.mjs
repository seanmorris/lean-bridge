/**
 * Preserve prior proofs through native PHP nested checked-record promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	nestedCheckedRecordPhpReferences
	, promoteNestedCheckedRecordPhp
} from "./nested-checked-record-php-promotion.mjs";
import {
	beforeNestedCheckedRecordPhpPromotionSource
	, nestedCheckedRecordPhpPromotionChangedPaths
	, nestedCheckedRecordPhpPromotionDraftParent
	, nestedCheckedRecordPhpPromotionHistoryPath
	, nestedCheckedRecordPhpPromotionPredecessor
	, reverseNestedCheckedRecordPhpPromotionUpdate
} from "./nested-checked-record-php-promotion-history.mjs";

test("nested native PHP promotion history authenticates every transition", async t => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordPhpPromotionHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "nested-checked-record-php-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, nestedCheckedRecordPhpPromotionPredecessor);
	assert.equal(record.draftParentCommit
		, nestedCheckedRecordPhpPromotionDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, nestedCheckedRecordPhpPromotionChangedPaths);
	const original = path => execFileSync("git", ["show"
		, `${nestedCheckedRecordPhpPromotionPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseNestedCheckedRecordPhpPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNestedCheckedRecordPhpPromotionSource(
			update.path, current), previous);
		assert.equal(beforeNestedCheckedRecordPhpPromotionSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeNestedCheckedRecordPhpPromotionSource(
			update.path, current + "unknown"), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() =>
				reverseNestedCheckedRecordPhpPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = await promoteNestedCheckedRecordPhp(
		JSON.parse(original(inventoryPath)), await nestedCheckedRecordPhpReferences()
	);
	const inventoryUpdate = record.updates.find(
		update => update.path === inventoryPath
	);
	const checkpoint = beforeFinRefinementSource(inventoryPath
		, await readFile(inventoryPath, "utf8"), inventoryUpdate.currentSha256);
	assert.equal(beforeNestedCheckedRecordPhpPromotionSource(
		inventoryPath, checkpoint), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			file.sha256 = update.currentSha256; pins++;
		}
	}
	assert.equal(JSON.stringify(JSON.parse(checkpoint)), JSON.stringify(expected));
	assert.equal(pins, record.pinCount);
	assert.equal(expected.evidence.length, 594);
	assert.equal(expected.observations.length, 619);
	t.diagnostic(`${pins} source pins refreshed; six native PHP cells supplemented`);
});

test("nested native PHP promotion history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-bridge-nested-php-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nested-checked-record-php-promotion-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only at its exact parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
