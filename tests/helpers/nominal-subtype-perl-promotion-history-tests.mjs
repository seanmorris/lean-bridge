/**
 * Verify the standalone nominal Perl promotion preserves all earlier source and support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeNominalSubtypeJvmPromotionPins } from "./nominal-subtype-jvm-promotion-history.mjs";
import { nominalSubtypeDotnetPromotionHistoryPath } from "./nominal-subtype-dotnet-promotion-history.mjs";
import { nominalSubtypeRubyPromotionHistoryPath } from "./nominal-subtype-ruby-promotion-history.mjs";
import { nominalSubtypeRustPromotionHistoryPath } from "./nominal-subtype-rust-promotion-history.mjs";
import { nominalSubtypePerlReferences, promoteNominalSubtypePerl } from "./nominal-subtype-perl-promotion.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNominalSubtypePythonPromotionSource, nominalSubtypePythonPromotionHistoryPath } from "./nominal-subtype-python-promotion-history.mjs";
import { beforeNominalSubtypePerlPromotionSource, nominalSubtypePerlPromotionChangedPaths, nominalSubtypePerlPromotionHistoryPath, nominalSubtypePerlPromotionPredecessor, reverseNominalSubtypePerlPromotionUpdate } from "./nominal-subtype-perl-promotion-history.mjs";

test("nominal Perl promotion history authenticates exact changes and the six observed Perl cells", async t => {
	const record = JSON.parse(await readFile(nominalSubtypePerlPromotionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-perl-promotion-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypePerlPromotionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypePerlPromotionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypePerlPromotionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNominalSubtypePerlPromotionSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalSubtypePerlPromotionUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypePerlPromotionSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypePerlPromotionSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypePerlPromotionSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypePerlPromotionSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypePerlPromotionUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const expected = beforeNominalSubtypeJvmPromotionPins(await promoteNominalSubtypePerl(JSON.parse(original(inventoryPath)), await nominalSubtypePerlReferences()));
	for(const path of [nominalSubtypeDotnetPromotionHistoryPath, nominalSubtypeRustPromotionHistoryPath, nominalSubtypeRubyPromotionHistoryPath, nominalSubtypePythonPromotionHistoryPath])
	{
		const later = JSON.parse(await readFile(path));
		for(const entry of expected.evidence) for(const file of entry.files)
		{
			const update = later.updates.find(item => item.path === file.path);
			if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
		}
	}
	assert.equal(beforeNominalSubtypePerlPromotionSource(inventoryPath, await readFile(inventoryPath, "utf8")), original(inventoryPath));
	let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.ok(pins > 0); assert.deepEqual(JSON.parse(beforeNominalSubtypePythonPromotionSource(inventoryPath, await readFile(inventoryPath, "utf8"))), expected);
	assert.equal(expected.evidence.length, 484); assert.equal(expected.observations.length, 577);
	t.diagnostic(`${pins} current-source pins refreshed; exactly six observed Perl cells promoted or supplemented`);
});

test("nominal Perl promotion writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-perl-promotion-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-perl-promotion-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
