/**
 * Check exact primitive-base native registration transitions and preservation of prior evidence.
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
import { beforeNominalPrimitiveSubtypeNativeRegistrationSource, nominalPrimitiveSubtypeNativeRegistrationChangedPaths, nominalPrimitiveSubtypeNativeRegistrationHistoryPath, nominalPrimitiveSubtypeNativeRegistrationPredecessor, reverseNominalPrimitiveSubtypeNativeRegistrationUpdate } from "./nominal-primitive-subtype-native-registration-history.mjs";

test("primitive-base native harness registration authenticates exact changes without adding support claims", async () => {
	const record = JSON.parse(await readFile(nominalPrimitiveSubtypeNativeRegistrationHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "nominal-primitive-subtype-native-registration-source-v1");
	assert.equal(record.predecessorCommit, nominalPrimitiveSubtypeNativeRegistrationPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nominalPrimitiveSubtypeNativeRegistrationChangedPaths);
	const original = path => execFileSync("git", ["show", `${nominalPrimitiveSubtypeNativeRegistrationPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const current = beforeNominalPrimitiveSubtypeNativeRegistrationSource(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const previous = reverseNominalPrimitiveSubtypeNativeRegistrationUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNominalPrimitiveSubtypeNativeRegistrationSource(update.path, current), previous);
		assert.equal(beforeNominalPrimitiveSubtypeNativeRegistrationSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeNominalPrimitiveSubtypeNativeRegistrationSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNominalPrimitiveSubtypeNativeRegistrationSource(update.path, current + "unknown"), current + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNominalPrimitiveSubtypeNativeRegistrationUpdate(current, changed));
		}
	}
	const path = "docs/type-surface.v1.json", inventory = JSON.parse(original(path));
	assert.equal(beforeFinRefinementSource(path, await readFile(path, "utf8"), sha256(original(path))), original(path));
	assert.equal(inventory.evidence.length, 532); assert.equal(inventory.observations.length, 595);
	for(const entry of inventory.evidence) for(const file of entry.files)
		assert.ok(!nominalPrimitiveSubtypeNativeRegistrationChangedPaths.includes(file.path));
});

test("primitive-base native registration writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-nominal-native-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-nominal-primitive-subtype-native-registration-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
