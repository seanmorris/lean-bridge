/**
 * Preserve installed observations while adding bounded Maven prerequisite recovery.
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
import { beforeMavenPrerequisiteSource, mavenPrerequisiteChangedPaths, mavenPrerequisiteHistoryPath, mavenPrerequisitePredecessor, reverseMavenPrerequisiteUpdate } from "./maven-prerequisite-history.mjs";

test("Maven prerequisite history authenticates exact transitions and refuses unknown edits", async () => {
	const history = JSON.parse(await readFile(mavenPrerequisiteHistoryPath));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "maven-prerequisite-v1");
	assert.equal(history.predecessorCommit, mavenPrerequisitePredecessor);
	assert.deepEqual(history.updates.map(update => update.path), mavenPrerequisiteChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path, "utf8"), previous = reverseMavenPrerequisiteUpdate(current, update);
		assert.equal(beforeMavenPrerequisiteSource(update.path, current), previous);
		const bytes = Buffer.from(current);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		assert.equal(beforeFinRefinementSource(update.path, Buffer.from(current), update.previousSha256), previous);
		const unknown = current + "\nunknown\n";
		assert.equal(beforeMavenPrerequisiteSource(update.path, unknown), unknown);
		assert.throws(() => reverseMavenPrerequisiteUpdate(unknown, update));
		for(const mutate of [item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.path = "unknown"; }, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "changed"; }]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseMavenPrerequisiteUpdate(current, changed));
			}
	}
});

test("Maven prerequisite gate changes source pins without adding or changing installed observations", async () => {
	const history = JSON.parse(await readFile(mavenPrerequisiteHistoryPath));
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeMavenPrerequisiteSource(path, source));
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
		if(!hashes.has(file.path)) hashes.set(file.path, sha256(await readFile(file.path)));
		assert.equal(hashes.get(file.path), file.sha256, file.path);
	}
	assert.equal(sha256(await readFile("docs/evidence/reviewed-subtype-host-ci-source-history-20261010.json")), "5e13607300b651bb48ba6567efa65a4d8327b652afb4d2b1c613f43b92780177");
});

test("Maven prerequisite history writer refuses an unrelated checkout before changing files", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-ci-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-maven-prerequisite-history.mjs")], { cwd: directory, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
