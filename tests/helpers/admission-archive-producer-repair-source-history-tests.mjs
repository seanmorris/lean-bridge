/**
 * Authenticate the explicit Feature and archive producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeAdmissionArchiveProducerRepairSource
	, admissionArchiveProducerRepairAddedPaths
	, admissionArchiveProducerRepairChangedPaths
	, admissionArchiveProducerRepairCommits
	, admissionArchiveProducerRepairHistoryPath
	, admissionArchiveProducerRepairImplementation
	, admissionArchiveProducerRepairIntegrationBase
	, admissionArchiveProducerRepairIntegrationPaths
	, admissionArchiveProducerRepairPredecessor
	, reverseAdmissionArchiveProducerRepairUpdate
} from "./admission-archive-producer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Feature and archive producer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		admissionArchiveProducerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "admission-archive-producer-repair-source-v1");
	assert.equal(record.predecessorCommit
		, admissionArchiveProducerRepairPredecessor);
	assert.equal(record.implementationCommit
		, admissionArchiveProducerRepairImplementation);
	assert.deepEqual(record.implementationCommits, admissionArchiveProducerRepairCommits);
	assert.equal(record.integrationBaseCommit
		, admissionArchiveProducerRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, admissionArchiveProducerRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, admissionArchiveProducerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, admissionArchiveProducerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeAdmissionArchiveProducerRepairSource);
		const previous = git(["show"
			, `${admissionArchiveProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseAdmissionArchiveProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeAdmissionArchiveProducerRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeAdmissionArchiveProducerRepairSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeAdmissionArchiveProducerRepairSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeAdmissionArchiveProducerRepairSource);
		const previous = git(["show"
			, `${admissionArchiveProducerRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseAdmissionArchiveProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeAdmissionArchiveProducerRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeAdmissionArchiveProducerRepairSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeAdmissionArchiveProducerRepairSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Feature and archive producer repair retains the exact three-commit range", () => {
	const predecessor = admissionArchiveProducerRepairPredecessor;
	const implementation = admissionArchiveProducerRepairImplementation;
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${predecessor}..${implementation}`]).trim().split("\n")
	, admissionArchiveProducerRepairCommits);
	for(const [index, revision] of admissionArchiveProducerRepairCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? predecessor : admissionArchiveProducerRepairCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, admissionArchiveProducerRepairPredecessor
		, admissionArchiveProducerRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...admissionArchiveProducerRepairChangedPaths].sort());
});

test("Feature and archive producer repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		admissionArchiveProducerRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeAdmissionArchiveProducerRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseAdmissionArchiveProducerRepairUpdate(
		current, update));
});

test("Feature and archive producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-admission-archive-producer-repair-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-admission-archive-producer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

