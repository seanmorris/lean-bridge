/**
 * Preserve installed observations while retaining reviewed package build records.
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
import { beforeReviewedSubtypePackageCiSource } from "./reviewed-subtype-package-ci-history.mjs";
import { beforeReviewedSubtypePackageRecordSource, reviewedSubtypePackageRecordChangedPaths, reviewedSubtypePackageRecordHistoryPath, reviewedSubtypePackageRecordPredecessor, reverseReviewedSubtypePackageRecordUpdate } from "./reviewed-subtype-package-record-history.mjs";

test("Reviewed package record retention history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(reviewedSubtypePackageRecordHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "reviewed-subtype-package-record-v1");
	assert.equal(history.predecessorCommit, reviewedSubtypePackageRecordPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), reviewedSubtypePackageRecordChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeReviewedSubtypePackageCiSource(update.path, await readFile(update.path, "utf8"));
		const previous = reverseReviewedSubtypePackageRecordUpdate(current, update);
		assert.equal(beforeReviewedSubtypePackageRecordSource(update.path, current), previous);
		const bytes = Buffer.from(current);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, Buffer.from(current), update.previousSha256), previous);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeReviewedSubtypePackageRecordSource(update.path, unknown), unknown);
		assert.throws(() => reverseReviewedSubtypePackageRecordUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseReviewedSubtypePackageRecordUpdate(current, changed));
			}
	}
});

test("Reviewed package record retention gate changes source pins without adding or changing installed observations", async () => {
	const history = JSON.parse(await readFile(reviewedSubtypePackageRecordHistoryPath));
	const path = "docs/type-surface.v1.json", source = beforeReviewedSubtypePackageCiSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedSubtypePackageRecordSource(path, source));
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
	const hashes = new Map();
	for(const file of current.evidence.flatMap(entry => entry.files))
	{
		if(!hashes.has(file.path)) hashes.set(file.path, sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)));
		assert.equal(hashes.get(file.path), file.sha256, file.path);
	}
	assert.equal(sha256(await readFile("docs/evidence/maven-prerequisite-source-history-20261010.json")), "7db038360d3f31e1f9cbc32b35036415dc0c867e397c14eb6fb7972a6145a8dd");
});

test("Reviewed package record retention history writer refuses an unrelated checkout before changing files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-ci-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-subtype-package-record-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
