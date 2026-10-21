/**
 * Verify the C# ceiling ledger restores the exact pre-e15acb5 C# tests and changes no support claim.
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
import { beforeNominalSubtypeDotnetCiSource } from "./nominal-subtype-dotnet-ci-history.mjs";
import { beforeNominalSubtypeDotnetPromotionSource } from "./nominal-subtype-dotnet-promotion-history.mjs";
import { beforeNominalSubtypeDotnetCeilingSource, nominalSubtypeDotnetCeilingChangedPaths, nominalSubtypeDotnetCeilingHistoryPath, nominalSubtypeDotnetCeilingPredecessor, reverseNominalSubtypeDotnetCeilingUpdate } from "./nominal-subtype-dotnet-ceiling-history.mjs";

test("nominal C# ceiling history authenticates the exact C# test transition and reaches the older C# ledgers", async () => {
	const record = JSON.parse(await readFile(nominalSubtypeDotnetCeilingHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-dotnet-ceiling-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeDotnetCeilingPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeDotnetCeilingChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypeDotnetCeilingPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		assert.equal(beforeNominalSubtypeDotnetCeilingSource(update.path, current, update.currentSha256), current);
		const previous = reverseNominalSubtypeDotnetCeilingUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeDotnetCeilingSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeDotnetCeilingSource(update.path, previous), previous);
		assert.equal(beforeNominalSubtypeDotnetCeilingSource(update.path, current + "unknown"), current + "unknown");
		// The older C# chains stop exactly at their own epochs once this layer is reachable.
		assert.equal(beforeNominalSubtypeDotnetCiSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypeDotnetPromotionSource(update.path, current, update.previousSha256), previous);
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypeDotnetCeilingUpdate(current, changed));
		}
	}
	const inventoryPath = "docs/type-surface.v1.json";
	assert.equal(beforeNominalSubtypeDotnetCeilingSource(inventoryPath, await readFile(inventoryPath, "utf8")), await readFile(inventoryPath, "utf8"));
	assert.ok(!JSON.parse(await readFile(inventoryPath, "utf8")).evidence.some(entry => entry.files.some(file => nominalSubtypeDotnetCeilingChangedPaths.includes(file.path))), "the C# tests file is not pinned by the inventory");
});

test("nominal C# ceiling writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-dotnet-ceiling-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-dotnet-ceiling-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
