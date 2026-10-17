/**
 * Preserve existing Fin evidence and reject unrecorded source changes.
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
import { beforeStructuralSubtypeRuntimeSource, structuralSubtypeRuntimeChangedPaths, structuralSubtypeRuntimeHistoryPath, structuralSubtypeRuntimePredecessor, reverseStructuralSubtypeRuntimeUpdate } from "./structural-subtype-runtime-history.mjs";

test("structural Subtype runtime source history authenticates exact changes and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(structuralSubtypeRuntimeHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "structural-subtype-runtime-source-v1");
	assert.equal(record.predecessorCommit, structuralSubtypeRuntimePredecessor);
	assert.deepEqual(record.updates.map(update => update.path), structuralSubtypeRuntimeChangedPaths);
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		const previous = reverseStructuralSubtypeRuntimeUpdate(current, update);
		assert.equal(beforeStructuralSubtypeRuntimeSource(update.path, current), previous);
		assert.equal(beforeStructuralSubtypeRuntimeSource(update.path, current, update.currentSha256), current);
		if(["src/analyze/export-configuration.mjs", "docs/type-surface.v1.json"].includes(update.path))
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeStructuralSubtypeRuntimeSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseStructuralSubtypeRuntimeUpdate(current, changed));
			}
	}
});

test("structural Subtype runtime history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-subtype-runtime-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-structural-subtype-runtime-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
