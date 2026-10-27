/**
 * Preserve installed observations while adding native CI workflow validation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import { beforeReviewedSubtypeHostCiSource, reviewedSubtypeHostCiChangedPaths, reviewedSubtypeHostCiHistoryPath, reviewedSubtypeHostCiPredecessor, reverseReviewedSubtypeHostCiUpdate } from "./reviewed-subtype-host-ci-history.mjs";
import { assertHistoricalTypeSurfaceEvidence } from "./type-surface-historical-evidence.mjs";

test("reviewed native CI workflow history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(reviewedSubtypeHostCiHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "reviewed-subtype-host-ci-v1");
	assert.equal(history.predecessorCommit, reviewedSubtypeHostCiPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), reviewedSubtypeHostCiChangedPaths);
	for(const update of history.updates)
	{
		const current = await sourceAtHistoryMilestone(
			reviewedSubtypeHostCiHistoryPath, update.path
		);
		const previous = reverseReviewedSubtypeHostCiUpdate(current, update);
		assert.equal(beforeReviewedSubtypeHostCiSource(update.path, current), previous);
		const bytes = Buffer.from(current);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, Buffer.from(current), update.previousSha256), previous);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeReviewedSubtypeHostCiSource(update.path, unknown), unknown);
		assert.throws(() => reverseReviewedSubtypeHostCiUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseReviewedSubtypeHostCiUpdate(current, changed));
			}
	}
});

test("reviewed native CI workflow gate changes source pins without adding or changing installed observations", async () => {
	const history = JSON.parse(await readFile(reviewedSubtypeHostCiHistoryPath));
	const path = "docs/type-surface.v1.json", source = await sourceAtHistoryMilestone(reviewedSubtypeHostCiHistoryPath, path);
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedSubtypeHostCiSource(path, source));
	const expected = structuredClone(previous); let pins = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.ok(pins > 0); assert.deepEqual(current, expected);
	assert.equal(current.evidence.length, 419); assert.equal(current.observations.length, 518);
	assert.deepEqual(current.observations, previous.observations);
	await assertHistoricalTypeSurfaceEvidence(current);
	assert.equal(sha256(await readFile("docs/evidence/reviewed-subtype-host-ci-report-source-history-20261010.json")), "5e827c8b3c2cd9223f6634b1c523f4b0bf0fd7782812d0f1c755e7e2a5f6224f");
});

test("reviewed native CI workflow history writer refuses an unrelated checkout before changing files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-ci-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-subtype-host-ci-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
