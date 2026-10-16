/**
 * Preserve prior proofs through the exact nested checked-record Perl promotion.
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
	nestedCheckedRecordPerlGeneratorPath
	, nestedCheckedRecordPerlReferences
	, promoteNestedCheckedRecordPerl
} from "./nested-checked-record-perl-promotion.mjs";
import {
	beforeNestedCheckedRecordPerlPromotionSource
	, nestedCheckedRecordPerlGeneratorPredecessor
	, nestedCheckedRecordPerlPromotionChangedPaths
	, nestedCheckedRecordPerlPromotionDraftParent
	, nestedCheckedRecordPerlPromotionHistoryPath
	, nestedCheckedRecordPerlPromotionPredecessor
	, reverseNestedCheckedRecordPerlPromotionUpdate
} from "./nested-checked-record-perl-promotion-history.mjs";

test("nested Perl promotion history authenticates every source transition", async t => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordPerlPromotionHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone,
		"nested-checked-record-perl-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, nestedCheckedRecordPerlPromotionPredecessor);
	assert.equal(record.draftParentCommit
		, nestedCheckedRecordPerlPromotionDraftParent);
	assert.equal(record.generatorPredecessorCommit
		, nestedCheckedRecordPerlGeneratorPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, nestedCheckedRecordPerlPromotionChangedPaths);
	const original = path => execFileSync("git", ["show"
		, `${path === nestedCheckedRecordPerlGeneratorPath
			? nestedCheckedRecordPerlGeneratorPredecessor
			: nestedCheckedRecordPerlPromotionPredecessor}:${path}`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseNestedCheckedRecordPerlPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNestedCheckedRecordPerlPromotionSource(
			update.path, current), previous);
		assert.equal(beforeNestedCheckedRecordPerlPromotionSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeNestedCheckedRecordPerlPromotionSource(
			update.path, previous, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeNestedCheckedRecordPerlPromotionSource(
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
				reverseNestedCheckedRecordPerlPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = await promoteNestedCheckedRecordPerl(
		JSON.parse(original(inventoryPath))
		, await nestedCheckedRecordPerlReferences()
	);
	const inventoryUpdate = record.updates.find(
		update => update.path === inventoryPath
	);
	const checkpoint = beforeFinRefinementSource(inventoryPath
		, await readFile(inventoryPath, "utf8"), inventoryUpdate.currentSha256);
	assert.equal(beforeNestedCheckedRecordPerlPromotionSource(
		inventoryPath, checkpoint), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			file.sha256 = update.currentSha256;
			pins++;
		}
	}
	assert.equal(JSON.stringify(JSON.parse(checkpoint)), JSON.stringify(expected));
	assert.equal(pins, record.pinCount);
	assert.equal(expected.evidence.length, 590);
	assert.equal(expected.observations.length, 617);
	t.diagnostic(`${pins} current-source pins refreshed; six Perl cells supplemented`);
});

test("nested Perl promotion history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-bridge-nested-perl-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nested-checked-record-perl-promotion-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only at its exact parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
