/**
 * Exact source-history controls for the recursive checked PHP-Wasm promotion.
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
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	promoteRecursiveSubtypePhpWasm
	, recursiveSubtypePhpWasmReferences
} from "./recursive-subtype-php-wasm-promotion.mjs";
import {
	beforeRecursiveSubtypePhpWasmPromotionPins
	, beforeRecursiveSubtypePhpWasmPromotionSource
	, recursiveSubtypePhpWasmPromotionChangedPaths
	, recursiveSubtypePhpWasmPromotionDraftParent
	, recursiveSubtypePhpWasmPromotionHistoryPath
	, recursiveSubtypePhpWasmPromotionPredecessor
	, reverseRecursiveSubtypePhpWasmPromotionUpdate
} from "./recursive-subtype-php-wasm-promotion-history.mjs";

test("recursive checked PHP-Wasm promotion history reconstructs every predecessor source", async t => {
	const record = JSON.parse(await readFile(recursiveSubtypePhpWasmPromotionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "recursive-subtype-php-wasm-promotion-source-v1");
	assert.equal(record.predecessorCommit, recursiveSubtypePhpWasmPromotionPredecessor);
	assert.equal(record.draftParentCommit, recursiveSubtypePhpWasmPromotionDraftParent);
	assert.deepEqual(record.updates.map(update => update.path),
		recursiveSubtypePhpWasmPromotionChangedPaths);
	const original = path => execFileSync("git", [
		"show", `${recursiveSubtypePhpWasmPromotionPredecessor}:${path}`
	], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			recursiveSubtypePhpWasmPromotionHistoryPath, update.path
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = original(update.path);
		assert.equal(reverseRecursiveSubtypePhpWasmPromotionUpdate(current, update), previous);
		assert.equal(beforeRecursiveSubtypePhpWasmPromotionSource(update.path, current), previous);
		assert.equal(beforeRecursiveSubtypePhpWasmPromotionSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeRecursiveSubtypePhpWasmPromotionSource(
			update.path, current + "unknown"), current + "unknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRecursiveSubtypePhpWasmPromotionUpdate(current, changed));
		}
	}

	const inventoryPath = "docs/type-surface.v1.json";
	const expected = await promoteRecursiveSubtypePhpWasm(
		JSON.parse(original(inventoryPath)), await recursiveSubtypePhpWasmReferences()
	);
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			file.sha256 = update.currentSha256; pins++;
		}
	}
	const actual = JSON.parse(await sourceAtHistoryMilestone(
		recursiveSubtypePhpWasmPromotionHistoryPath, inventoryPath
	));
	assert.deepEqual(actual, withHistoryMilestoneSourcePins(
		recursiveSubtypePhpWasmPromotionHistoryPath, expected
	));
	const beforePins = beforeRecursiveSubtypePhpWasmPromotionPins(actual);
	assert.ok(beforePins.evidence.some((entry, index) =>
		JSON.stringify(entry.files) !== JSON.stringify(actual.evidence[index].files)));
	t.diagnostic(`${pins} current-source pins refreshed; two receipts added; six cells supplemented`);
});

test("recursive checked PHP-Wasm promotion history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-subtype-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c"
		, "commit.gpgsign=false"
		, "commit"
		, "--allow-empty"
		, "--quiet"
		, "-m"
		, "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-recursive-subtype-php-wasm-promotion-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
