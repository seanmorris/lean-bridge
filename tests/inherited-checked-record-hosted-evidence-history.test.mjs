/**
 * Close hosted inherited-record evidence registration and historical roots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, readFile, readdir, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import {
	sourceAtFinHistoryRecord
	, sourceBeforeFinHistoryRecord
} from "./helpers/source-at-fin-history-milestone.mjs";
import {
	beforeInheritedCheckedRecordHostedEvidenceSource
	, inheritedCheckedRecordHostedEvidenceChangedPaths
	, inheritedCheckedRecordHostedEvidenceDraftParent
	, inheritedCheckedRecordHostedEvidenceHistoryPath
	, inheritedCheckedRecordHostedEvidencePredecessor
	, reverseInheritedCheckedRecordHostedEvidenceUpdate
} from "./helpers/inherited-checked-record-hosted-evidence-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";

const expectedTests = [
	"inherited-checked-record-hosted-evidence-history"
	, "inherited-checked-record-jvm-evidence"
];
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});

test("hosted inherited-record evidence has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		inheritedCheckedRecordHostedEvidenceHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "inherited-checked-record-hosted-evidence-source-v1");
	assert.equal(record.predecessorCommit
		, inheritedCheckedRecordHostedEvidencePredecessor);
	assert.equal(record.draftParentCommit
		, inheritedCheckedRecordHostedEvidenceDraftParent);
	assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
		, record.predecessorCommit, record.draftParentCommit]).status, 0);
	assert.deepEqual(record.updates.map(update => update.path)
		, inheritedCheckedRecordHostedEvidenceChangedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryRecord(
			inheritedCheckedRecordHostedEvidenceHistoryPath, update.path
			, beforeFinRefinementSource
		);
		const previous = git(["show"
			, `${update.previousRevision}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseInheritedCheckedRecordHostedEvidenceUpdate(
			current, update), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordHostedEvidenceSource(
			update.path, current), previous, update.path);
		assert.equal(beforeInheritedCheckedRecordHostedEvidenceSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(await sourceBeforeFinHistoryRecord(
			inheritedCheckedRecordHostedEvidenceHistoryPath, update.path
			, beforeFinRefinementSource
		), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeInheritedCheckedRecordHostedEvidenceSource(
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
			assert.throws(() => reverseInheritedCheckedRecordHostedEvidenceUpdate(
				current, changed));
		}
	}
	const profile = record.updates.find(
		update => update.path === "src/adoption/test-profiles.mjs");
	assert.deepEqual(profile.addedTests, expectedTests);
	for(const name of expectedTests)
	{
		const path = `tests/${name}.test.mjs`;
		await access(path);
		assert.equal(classifyRepositoryTest(path), "contract", path);
	}
});

test("hosted evidence history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-inherited-hosted-evidence-guard-"
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
		"scripts/update-inherited-checked-record-hosted-evidence-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
