/**
 * Check exact browser registration transitions and preservation of earlier evidence.
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
import { beforeNominalSubtypeBrowserRegistrationSource, nominalSubtypeBrowserRegistrationChangedPaths, nominalSubtypeBrowserRegistrationHistoryPath, nominalSubtypeBrowserRegistrationPredecessor, reverseNominalSubtypeBrowserRegistrationUpdate } from "./nominal-subtype-browser-registration-history.mjs";

test("nominal browser harness registration authenticates exact changes without adding support claims", async () => {
	const record = JSON.parse(await readFile(nominalSubtypeBrowserRegistrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-subtype-browser-registration-source-v1");
	assert.equal(record.predecessorCommit, nominalSubtypeBrowserRegistrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalSubtypeBrowserRegistrationChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalSubtypeBrowserRegistrationPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = await sourceAtHistoryMilestone(
			nominalSubtypeBrowserRegistrationHistoryPath, update.path
		);
		const previous = reverseNominalSubtypeBrowserRegistrationUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalSubtypeBrowserRegistrationSource(update.path, current), previous);
		assert.equal(beforeNominalSubtypeBrowserRegistrationSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalSubtypeBrowserRegistrationSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalSubtypeBrowserRegistrationSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalSubtypeBrowserRegistrationUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json", inventory = JSON.parse(original(path));
	assert.equal(beforeFinRefinementSource(path, await readFile(path, "utf8"), sha256(original(path))), original(path));
	assert.equal(inventory.evidence.length, 512); assert.equal(inventory.observations.length, 591);
	for(const entry of inventory.evidence) for(const file of entry.files)
		assert.ok(!nominalSubtypeBrowserRegistrationChangedPaths.includes(file.path));
});

test("nominal browser registration writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-browser-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-subtype-browser-registration-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
