/**
 * Bind inherited checked-record JVM support to exact source bytes and closed
 * test registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import {
	beforeInheritedCheckedRecordJvmSource
	, inheritedCheckedRecordJvmAddedPaths
	, inheritedCheckedRecordJvmChangedPaths
	, inheritedCheckedRecordJvmDraftParent
	, inheritedCheckedRecordJvmHistoryPath
	, inheritedCheckedRecordJvmPredecessor
	, reverseInheritedCheckedRecordJvmUpdate
} from "./helpers/inherited-checked-record-jvm-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./helpers/source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

test("inherited checked-record JVM support has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordJvmHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "inherited-checked-record-jvm-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordJvmPredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordJvmDraftParent);
	assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
		, inheritedCheckedRecordJvmPredecessor
		, inheritedCheckedRecordJvmDraftParent]).status, 0);
	assert.equal(Number(git(["rev-list", "--count"
		, `${inheritedCheckedRecordJvmPredecessor}..${inheritedCheckedRecordJvmDraftParent}`
	]).trim()), 4);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordJvmChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, inheritedCheckedRecordJvmAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		inheritedCheckedRecordJvmChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeInheritedCheckedRecordJvmSource
		);
		const previous = git(["show"
			, `${inheritedCheckedRecordJvmPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordJvmUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordJvmSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordJvmSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordJvmSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseInheritedCheckedRecordJvmUpdate(
				current, changed));
		}
	}
});

test("inherited JVM additions and test registration are closed", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordJvmHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeInheritedCheckedRecordJvmSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${inheritedCheckedRecordJvmPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-jvm.test.mjs"), "contract");
	assert.equal(classifyRepositoryTest(
		"tests/inherited-checked-record-jvm-source-history.test.mjs"
	), "contract");
	assert.equal(classifyRepositoryTest(
		"tests/dotnet-span-name-contract.test.mjs"), "contract");
});

test("inherited JVM history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-record-jvm-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-inherited-checked-record-jvm-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
