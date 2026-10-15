/**
 * Preserve prior proofs and support records through the exact nineteen-base Ruby update.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { nominalPrimitiveSubtypeRubyReferences, promoteNominalPrimitiveSubtypeRuby } from "./nominal-primitive-subtype-ruby-promotion.mjs";
import {
	beforeNominalPrimitiveSubtypeRubyPromotionSource
	, nominalPrimitiveSubtypeRubyPromotionChangedPaths
	, nominalPrimitiveSubtypeRubyPromotionHistoryPath
	, nominalPrimitiveSubtypeRubyPromotionPredecessor
	, reverseNominalPrimitiveSubtypeRubyPromotionUpdate
} from "./nominal-primitive-subtype-ruby-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeRustPromotionPins } from "./nominal-primitive-subtype-rust-promotion-history.mjs";

test("primitive-base Ruby promotion history authenticates the exact Ruby-only support and docs transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeRubyPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-primitive-subtype-ruby-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeRubyPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeRubyPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalPrimitiveSubtypeRubyPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalPrimitiveSubtypeRubyPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeRubyPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalPrimitiveSubtypeRubyPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeRubyPromotionSource(update.path, previous, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalPrimitiveSubtypeRubyPromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalPrimitiveSubtypeRubyPromotionUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = beforeNominalPrimitiveSubtypeRustPromotionPins(await promoteNominalPrimitiveSubtypeRuby(JSON.parse(original(inventoryPath)), await nominalPrimitiveSubtypeRubyReferences()));
	const inventoryUpdate = record.updates.find(item => item.path === inventoryPath);
	assert.equal(beforeFinRefinementSource(inventoryPath, await readFile(inventoryPath, "utf8"), inventoryUpdate.previousSha256), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	const checkpoint = beforeFinRefinementSource(inventoryPath, await readFile(inventoryPath, "utf8"), inventoryUpdate.currentSha256);
	assert.deepEqual(JSON.parse(checkpoint), expected);
	assert.equal(expected.evidence.length, 544); assert.equal(expected.observations.length, 595);
	t.diagnostic(`${pins} current-source pins refreshed; exactly six existing Ruby cells supplemented`);
});

test("primitive-base Ruby promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-ruby-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-primitive-subtype-ruby-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
