/**
 * Preserve prior proofs through the exact nineteen-base C# promotion.
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
import {
	nominalPrimitiveSubtypeDotnetReferences
	, promoteNominalPrimitiveSubtypeDotnet
} from "./nominal-primitive-subtype-dotnet-promotion.mjs";
import {
	beforeNominalPrimitiveSubtypeDotnetPromotionSource
	, nominalPrimitiveSubtypeDotnetPromotionChangedPaths
	, nominalPrimitiveSubtypeDotnetPromotionHistoryPath
	, nominalPrimitiveSubtypeDotnetPromotionPredecessor
	, reverseNominalPrimitiveSubtypeDotnetPromotionUpdate
} from "./nominal-primitive-subtype-dotnet-promotion-history.mjs";

test("primitive-base C# promotion history authenticates the exact support transition", async t => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeDotnetPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nominal-primitive-subtype-dotnet-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeDotnetPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path),
		nominalPrimitiveSubtypeDotnetPromotionChangedPaths);
	const original = path => execFileSync("git", [
		"show", `${nominalPrimitiveSubtypeDotnetPromotionPredecessor}:${path}`
	], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalPrimitiveSubtypeDotnetPromotionHistoryPath, update.path
		);
		const previous = reverseNominalPrimitiveSubtypeDotnetPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeDotnetPromotionSource(update.path, current),
			previous);
		assert.equal(beforeNominalPrimitiveSubtypeDotnetPromotionSource(
			update.path, current, update.currentSha256
		), current);
		assert.equal(beforeNominalPrimitiveSubtypeDotnetPromotionSource(
			update.path, previous, update.previousSha256
		), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeDotnetPromotionSource(
			update.path, current + "unknown"
		), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() =>
				reverseNominalPrimitiveSubtypeDotnetPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = await promoteNominalPrimitiveSubtypeDotnet(
		JSON.parse(original(inventoryPath)), await nominalPrimitiveSubtypeDotnetReferences()
	);
	const checkpoint = await sourceAtHistoryMilestone(
		nominalPrimitiveSubtypeDotnetPromotionHistoryPath, inventoryPath
	);
	assert.equal(beforeNominalPrimitiveSubtypeDotnetPromotionSource(
		inventoryPath, checkpoint
	), original(inventoryPath));
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
		nominalPrimitiveSubtypeDotnetPromotionHistoryPath, expected
	));
	assert.equal(expected.evidence.length, 552); assert.equal(expected.observations.length, 595);
	t.diagnostic(`${pins} current-source pins refreshed; exactly six existing C# cells supplemented`);
});

test("primitive-base C# promotion writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-primitive-dotnet-promotion-history-guard-"
	));
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
		"scripts/update-nominal-primitive-subtype-dotnet-promotion-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
