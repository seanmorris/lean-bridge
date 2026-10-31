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
import { joinNativeObservations } from "./native-observation-split.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeObservationSplitSource, nativeObservationSplitChangedPaths, nativeObservationSplitHistoryPath, nativeObservationSplitPredecessor, reverseNativeObservationSplitUpdate } from "./native-observation-split-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const sourceAt = (path, expected) => sourceAtFinHistoryRecordSource(
	nativeObservationSplitHistoryPath, path, expected, beforeFinRefinementSource
);

test("native observation split source history authenticates exact changes and refuses unknown edits", async () => {
	const record = JSON.parse(await readFile(nativeObservationSplitHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "native-observation-split-source-v1");
	assert.equal(record.predecessorCommit, nativeObservationSplitPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nativeObservationSplitChangedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAt(update.path, update.currentSha256);
		const previous = reverseNativeObservationSplitUpdate(current, update);
		assert.equal(beforeNativeObservationSplitSource(update.path, current), previous);
		if(update.path === ".github/workflows/consumer-matrix.yml") assert.equal(joinNativeObservations(current), previous);
		assert.equal(beforeNativeObservationSplitSource(update.path, current, update.currentSha256), current);
		if([".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json", "tests/documentation.test.mjs"].includes(update.path))
			assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeNativeObservationSplitSource(update.path, current + "unknown"), current + "unknown");
		for(const mutate of [item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNativeObservationSplitUpdate(current, changed));
			}
	}
});

test("native observation split history writer refuses an unrelated checkout before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-observation-split-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-observation-split-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
