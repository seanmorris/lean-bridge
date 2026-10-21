/**
 * Preserve prior proofs and support records through the exact nineteen-base Perl update.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sourceAtHistoryMilestone, withHistoryMilestoneSourcePins  } from "./source-history-test-source.mjs";
import { nominalPrimitiveSubtypePerlReferences, promoteNominalPrimitiveSubtypePerl } from "./nominal-primitive-subtype-perl-promotion.mjs";
import { beforeNominalPrimitiveSubtypePerlPromotionSource, nominalPrimitiveSubtypePerlPromotionChangedPaths, nominalPrimitiveSubtypePerlPromotionHistoryPath, nominalPrimitiveSubtypePerlPromotionPredecessor, reverseNominalPrimitiveSubtypePerlPromotionUpdate } from "./nominal-primitive-subtype-perl-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeRubyPromotionPins } from "./nominal-primitive-subtype-ruby-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeRustPromotionPins } from "./nominal-primitive-subtype-rust-promotion-history.mjs";

test("primitive-base Perl promotion history authenticates the exact Perl-only support and docs transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypePerlPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-primitive-subtype-perl-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypePerlPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypePerlPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalPrimitiveSubtypePerlPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalPrimitiveSubtypePerlPromotionHistoryPath, update.path
		);
		const previous = reverseNominalPrimitiveSubtypePerlPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypePerlPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalPrimitiveSubtypePerlPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypePerlPromotionSource(update.path, previous), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNominalPrimitiveSubtypePerlPromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalPrimitiveSubtypePerlPromotionUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	// References name current sources; the later Rust and Ruby promotions re-pinned some of them.
	const expected = beforeNominalPrimitiveSubtypeRubyPromotionPins(beforeNominalPrimitiveSubtypeRustPromotionPins(await promoteNominalPrimitiveSubtypePerl(JSON.parse(original(inventoryPath)), await nominalPrimitiveSubtypePerlReferences())));
	const checkpoint = await sourceAtHistoryMilestone(
		nominalPrimitiveSubtypePerlPromotionHistoryPath, inventoryPath
	);
	assert.equal(beforeNominalPrimitiveSubtypePerlPromotionSource(
		inventoryPath, checkpoint
	), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.deepEqual(JSON.parse(checkpoint), withHistoryMilestoneSourcePins(
		nominalPrimitiveSubtypePerlPromotionHistoryPath, expected
	));
	assert.equal(expected.evidence.length, 540); assert.equal(expected.observations.length, 595);
	t.diagnostic(`${pins} current-source pins refreshed; exactly six existing Perl cells supplemented`);
});

test("primitive-base Perl promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-perl-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-primitive-subtype-perl-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
