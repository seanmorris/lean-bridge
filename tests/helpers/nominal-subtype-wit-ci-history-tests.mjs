/**
 * Check exact recurring WIT CI transitions without changing support claims.
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
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import { beforeNominalSubtypeWitCiSource, nominalSubtypeWitCiChangedPaths, nominalSubtypeWitCiHistoryPath, nominalSubtypeWitCiPredecessor, reverseNominalSubtypeWitCiUpdate } from "./nominal-subtype-wit-ci-history.mjs";

test("nominal WIT CI preserves exact historical producers and every support observation", async () => {
	const record = JSON.parse(await readFile(nominalSubtypeWitCiHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-wit-ci-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeWitCiPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeWitCiChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypeWitCiPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalSubtypeWitCiHistoryPath, update.path
		);
		const previous = reverseNominalSubtypeWitCiUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeWitCiSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeWitCiSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeWitCiSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypeWitCiSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypeWitCiUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json", inventory = JSON.parse(original(path));
	assert.equal(beforeFinRefinementSource(path, await readFile(path, "utf8"), sha256(original(path))), original(path));
	assert.equal(inventory.evidence.length, 508); assert.equal(inventory.observations.length, 589);
	const current = JSON.parse(await sourceAtHistoryMilestone(
		nominalSubtypeWitCiHistoryPath, path
	));
	let pins = 0;
	for(const entry of current.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(update => update.path === file.path);
		if(update && file.sha256 === update.currentSha256)
		{
			assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256);
			file.sha256 = update.previousSha256; pins++;
		}
	}
	assert.equal(pins, 117); assert.deepEqual(current, inventory, "Only exact existing workflow source pins change");
});

test("nominal WIT CI history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-wit-ci-history-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-wit-ci-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
