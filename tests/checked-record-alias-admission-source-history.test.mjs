/**
 * Bind the checked-record alias admission repair to exact source bytes,
 * refreshed inventory pins and closed test registration.
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
	beforeCheckedRecordAliasAdmissionSource
	, checkedRecordAliasAdmissionAddedPaths
	, checkedRecordAliasAdmissionChangedPaths
	, checkedRecordAliasAdmissionHistoryPath
	, checkedRecordAliasAdmissionPredecessor
	, reverseCheckedRecordAliasAdmissionUpdate
} from "./helpers/checked-record-alias-admission-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./helpers/source-at-fin-history-milestone.mjs";

const repairCommit = "a1b4f5c2246313cbe2905d3bc9c381b4f6af984f";
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});

test("checked-record alias admission has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordAliasAdmissionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-alias-admission-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordAliasAdmissionPredecessor);
	assert.equal(record.repairCommit, repairCommit);
	assert.equal(git(["rev-parse", `${repairCommit}^`]).trim()
		, checkedRecordAliasAdmissionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordAliasAdmissionChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordAliasAdmissionAddedPaths);
	assert.equal(record.pathsSha256
		, sha256(JSON.stringify(checkedRecordAliasAdmissionChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordAliasAdmissionSource
		);
		const previous = git(["show"
			, `${checkedRecordAliasAdmissionPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordAliasAdmissionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordAliasAdmissionSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordAliasAdmissionSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeCheckedRecordAliasAdmissionSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => {
				if(item.edits) item.edits[0].current += "unknown";
				else item.replacements[0].current = "0".repeat(64);
			}
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseCheckedRecordAliasAdmissionUpdate(
				current, changed));
		}
	}
});

test("alias admission additions and test registration are closed", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordAliasAdmissionHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeCheckedRecordAliasAdmissionSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordAliasAdmissionPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	assert.equal(classifyRepositoryTest(
		"tests/checked-record-alias-admission-source-history.test.mjs"
	), "contract");
});

test("alias admission refreshes only matching live source pins", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordAliasAdmissionHistoryPath, "utf8"));
	assert.equal(record.pinCount, record.pinUpdates.reduce(
		(count, pin) => count + pin.count, 0));
	assert.ok(record.pinCount > 0);
	const inventoryUpdate = record.updates.find(
		update => update.path === "docs/type-surface.v1.json"
	);
	const inventory = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryUpdate.path, inventoryUpdate.currentSha256
		, beforeCheckedRecordAliasAdmissionSource
	));
	for(const update of record.pinUpdates)
	{
		const files = inventory.evidence.flatMap(entry => entry.files)
			.filter(file => file.path === update.path);
		assert.equal(files.filter(file => file.sha256
			=== update.currentSha256).length, update.count, update.path);
		assert.equal(files.filter(file => file.sha256
			=== update.previousSha256).length, 0, update.path);
	}
});

test("alias admission history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-checked-record-alias-admission-guard-"
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
		"scripts/update-checked-record-alias-admission-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact repair commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
