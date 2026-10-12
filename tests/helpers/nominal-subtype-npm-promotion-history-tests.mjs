/**
 * Preserve earlier evidence while recording nominal npm installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { nominalSubtypeNpmReferences, promoteNominalSubtypeNpm } from "./nominal-subtype-npm-promotion.mjs";
import { beforeNominalSubtypeNativePromotionSource, nominalSubtypeNativePromotionHistoryPath } from "./nominal-subtype-native-promotion-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNominalSubtypeNpmPromotionSource, nominalSubtypeNpmPromotionChangedPaths, nominalSubtypeNpmPromotionHistoryPath, nominalSubtypeNpmPromotionPredecessor, reverseNominalSubtypeNpmPromotionUpdate } from "./nominal-subtype-npm-promotion-history.mjs";

test("Nominal npm promotion authenticates exact changes and the scoped Node support update", async () => {
	const record = JSON.parse(await readFile(nominalSubtypeNpmPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-npm-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeNpmPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeNpmPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypeNpmPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNominalSubtypeNpmPromotionSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalSubtypeNpmPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeNpmPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeNpmPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeNpmPromotionSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypeNpmPromotionSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypeNpmPromotionUpdate(current, changed));
			}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforeNominalSubtypeNpmPromotionSource(inventoryPath, await readFile(inventoryPath, "utf8")), original(inventoryPath));
	const expected = await promoteNominalSubtypeNpm(JSON.parse(original(inventoryPath)), await nominalSubtypeNpmReferences());
	const later = JSON.parse(await readFile(nominalSubtypeNativePromotionHistoryPath));
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = later.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 123);
	assert.deepEqual(JSON.parse(beforeNominalSubtypeNativePromotionSource(inventoryPath, await readFile(inventoryPath, "utf8"))), expected);
	assert.equal(expected.evidence.length, 476); assert.equal(expected.observations.length, 573);
});

test("Nominal npm promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-npm-promotion-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-npm-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
