/**
 * Preserve earlier evidence while recording nominal native installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sourceAtHistoryMilestone, withHistorySourcePins } from "./source-history-test-source.mjs";
import { beforeNominalSubtypeJvmPromotionPins } from "./nominal-subtype-jvm-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeNativePromotionPins } from "./nominal-primitive-subtype-native-promotion-history.mjs";
import { nominalSubtypeDotnetPromotionHistoryPath } from "./nominal-subtype-dotnet-promotion-history.mjs";
import { nominalSubtypeRubyPromotionHistoryPath } from "./nominal-subtype-ruby-promotion-history.mjs";
import { nominalSubtypeRustPromotionHistoryPath } from "./nominal-subtype-rust-promotion-history.mjs";
import { nominalSubtypeNativeReferences, promoteNominalSubtypeNative } from "./nominal-subtype-native-promotion.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { nominalSubtypePythonPromotionHistoryPath } from "./nominal-subtype-python-promotion-history.mjs";
import { beforeComponentEngineClosureSource
	, componentEngineClosureHistoryPath
} from "./component-engine-closure-history.mjs";
import { nominalSubtypePerlPromotionHistoryPath } from "./nominal-subtype-perl-promotion-history.mjs";
import { beforeNominalSubtypeNativePromotionSource, nominalSubtypeNativePromotionChangedPaths, nominalSubtypeNativePromotionHistoryPath, nominalSubtypeNativePromotionPredecessor, reverseNominalSubtypeNativePromotionUpdate } from "./nominal-subtype-native-promotion-history.mjs";

test("Nominal native promotion authenticates exact changes and the scoped C/C++ support update", async () => {
	const record = JSON.parse(await readFile(nominalSubtypeNativePromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-native-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeNativePromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeNativePromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypeNativePromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalSubtypeNativePromotionHistoryPath, update.path
		);
		const previous = reverseNominalSubtypeNativePromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeNativePromotionSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeNativePromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeNativePromotionSource(update.path, previous), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeNominalSubtypeNativePromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypeNativePromotionUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const currentInventory = await sourceAtHistoryMilestone(
		nominalSubtypeNativePromotionHistoryPath, inventoryPath
	);
	assert.equal(beforeNominalSubtypeNativePromotionSource(
		inventoryPath, currentInventory
	), original(inventoryPath));
	const expected = beforeNominalSubtypeJvmPromotionPins(beforeNominalPrimitiveSubtypeNativePromotionPins(
		await promoteNominalSubtypeNative(JSON.parse(original(inventoryPath)), await nominalSubtypeNativeReferences())));
	for(const path of [nominalSubtypeDotnetPromotionHistoryPath, nominalSubtypeRustPromotionHistoryPath, nominalSubtypeRubyPromotionHistoryPath, nominalSubtypePythonPromotionHistoryPath, nominalSubtypePerlPromotionHistoryPath])
	{
		const later = JSON.parse(await readFile(path));
		for(const entry of expected.evidence) for(const file of entry.files)
		{
			const update = later.updates.find(item => item.path === file.path);
			if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
		}
	}
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 177);
	assert.deepEqual(JSON.parse(beforeComponentEngineClosureSource(inventoryPath, await sourceAtHistoryMilestone(componentEngineClosureHistoryPath, inventoryPath))), await withHistorySourcePins(componentEngineClosureHistoryPath, expected));
	assert.equal(expected.evidence.length, 480); assert.equal(expected.observations.length, 575);
});

test("Nominal native promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-native-promotion-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-native-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
