/**
 * Preserve prior proofs through nested checked-record PHP-Wasm promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
} from "./source-history-test-source.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	nestedCheckedRecordPhpWasmReferences
	, promoteNestedCheckedRecordPhpWasm
} from "./nested-checked-record-php-wasm-promotion.mjs";
import {
	beforeNestedCheckedRecordPhpWasmPromotionSource
	, nestedCheckedRecordPhpWasmPromotionChangedPaths
	, nestedCheckedRecordPhpWasmPromotionDraftParent
	, nestedCheckedRecordPhpWasmPromotionHistoryPath
	, nestedCheckedRecordPhpWasmPromotionPredecessor
	, reverseNestedCheckedRecordPhpWasmPromotionUpdate
} from "./nested-checked-record-php-wasm-promotion-history.mjs";

test("nested PHP-Wasm promotion history authenticates every transition", async t => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordPhpWasmPromotionHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "nested-checked-record-php-wasm-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, nestedCheckedRecordPhpWasmPromotionPredecessor);
	assert.equal(record.draftParentCommit
		, nestedCheckedRecordPhpWasmPromotionDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, nestedCheckedRecordPhpWasmPromotionChangedPaths);
	const original = path => execFileSync("git", ["show"
		, `${nestedCheckedRecordPhpWasmPromotionPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nestedCheckedRecordPhpWasmPromotionHistoryPath, update.path
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseNestedCheckedRecordPhpWasmPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNestedCheckedRecordPhpWasmPromotionSource(
			update.path, current), previous);
		assert.equal(beforeNestedCheckedRecordPhpWasmPromotionSource(
			update.path, current, update.currentSha256), current);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNestedCheckedRecordPhpWasmPromotionSource(
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
				reverseNestedCheckedRecordPhpWasmPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = await promoteNestedCheckedRecordPhpWasm(
		JSON.parse(original(inventoryPath)), await nestedCheckedRecordPhpWasmReferences()
	);
	const checkpoint = await sourceAtHistoryMilestone(
		nestedCheckedRecordPhpWasmPromotionHistoryPath, inventoryPath
	);
	assert.equal(beforeNestedCheckedRecordPhpWasmPromotionSource(
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
	assert.deepEqual(JSON.parse(checkpoint), withHistoryMilestoneSourcePins(
		nestedCheckedRecordPhpWasmPromotionHistoryPath, expected
	));
	assert.equal(pins, record.pinCount);
	assert.equal(expected.evidence.length, 610);
	assert.equal(expected.observations.length, 627);
	t.diagnostic(`${pins} source pins refreshed; six PHP-Wasm cells supplemented`);
});

test("nested PHP-Wasm promotion history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-bridge-nested-php-wasm-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nested-checked-record-php-wasm-promotion-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only at its exact parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
