/**
 * Verify the primitive-base history repair restores its exact predecessor sources and changes no support claim.
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
import { beforeNominalPrimitiveSubtypePerlPromotionSource } from "./nominal-primitive-subtype-perl-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeRubyIntegrationSource } from "./nominal-primitive-subtype-ruby-integration-history.mjs";
import { beforeNominalSubtypePythonRegistrationSource } from "./nominal-subtype-python-registration-history.mjs";
import { beforeNominalSubtypeDotnetCiSource } from "./nominal-subtype-dotnet-ci-history.mjs";
import { nominalSubtypeDotnetCeilingChangedPaths, nominalSubtypeDotnetCeilingHistoryPath } from "./nominal-subtype-dotnet-ceiling-history.mjs";
import { beforePrimitiveSubtypeHistoryRepairSource, primitiveSubtypeHistoryRepairChangedPaths, primitiveSubtypeHistoryRepairHistoryPath, primitiveSubtypeHistoryRepairPredecessor, reversePrimitiveSubtypeHistoryRepairUpdate } from "./primitive-subtype-history-repair.mjs";

test("primitive-base history repair authenticates its exact chain edits and makes the Ruby promotion reachable", async () => {
	const record = JSON.parse(await readFile(primitiveSubtypeHistoryRepairHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "primitive-subtype-history-repair-source-v1");
	assert.equal(record.predecessorCommit, primitiveSubtypeHistoryRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), primitiveSubtypeHistoryRepairChangedPaths);
	const original = path => execFileSync("git", ["show", `${primitiveSubtypeHistoryRepairPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		assert.equal(beforePrimitiveSubtypeHistoryRepairSource(update.path, current, update.currentSha256), current);
		const previous = reversePrimitiveSubtypeHistoryRepairUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforePrimitiveSubtypeHistoryRepairSource(update.path, current), previous);
		assert.equal(beforePrimitiveSubtypeHistoryRepairSource(update.path, previous), previous);
		assert.equal(beforePrimitiveSubtypeHistoryRepairSource(update.path, current + "unknown"), current + "unknown");
		// Every older chain reaches this layer through the Perl promotion layer and the Ruby promotion layer.
		assert.equal(beforeNominalPrimitiveSubtypePerlPromotionSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalPrimitiveSubtypeRubyIntegrationSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypePythonRegistrationSource(update.path, current, update.previousSha256), previous);
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reversePrimitiveSubtypeHistoryRepairUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforePrimitiveSubtypeHistoryRepairSource(inventoryPath, await readFile(inventoryPath, "utf8")), await readFile(inventoryPath, "utf8"));
	assert.ok(!JSON.parse(await readFile(inventoryPath, "utf8")).evidence.some(entry => entry.files.some(file => primitiveSubtypeHistoryRepairChangedPaths.includes(file.path))), "no repaired file is pinned by the inventory");
	// The C# ceiling ledger is reachable from the oldest C# chain only through this layer.
	const ceiling = JSON.parse(await readFile(nominalSubtypeDotnetCeilingHistoryPath)).updates[0];
	assert.deepEqual(nominalSubtypeDotnetCeilingChangedPaths, [ceiling.path]);
	assert.equal(beforeNominalSubtypeDotnetCiSource(ceiling.path, await readFile(ceiling.path, "utf8"), ceiling.previousSha256).length > 0, true);
	assert.notEqual(beforeNominalSubtypeDotnetCiSource(ceiling.path, await readFile(ceiling.path, "utf8")), await readFile(ceiling.path, "utf8"));
});

test("primitive-base history repair writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-subtype-history-repair-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-primitive-subtype-history-repair.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
