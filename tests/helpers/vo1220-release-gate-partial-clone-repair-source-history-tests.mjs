/**
 * Authenticate the release-gate partial-clone repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeVo1220ReleaseGatePartialCloneRepairSource
	, reverseVo1220ReleaseGatePartialCloneRepairUpdate
	, vo1220ReleaseGatePartialCloneRepairAddedPaths
	, vo1220ReleaseGatePartialCloneRepairHistoryPath
	, vo1220ReleaseGatePartialCloneRepairImplementation
	, vo1220ReleaseGatePartialCloneRepairImplementationPaths
	, vo1220ReleaseGatePartialCloneRepairIntegrationPaths
	, vo1220ReleaseGatePartialCloneRepairNormalizationPaths
	, vo1220ReleaseGatePartialCloneRepairPredecessor
} from "./vo1220-release-gate-partial-clone-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220ReleaseGatePartialCloneRepairHistoryPath, "utf8"));

test("release-gate partial clone repair records the exact hosted ENOSPC", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-release-gate-partial-clone-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220ReleaseGatePartialCloneRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ReleaseGatePartialCloneRepairImplementation);
	assert.deepEqual(history.hostedFailure, {
		run: 43301840437, job: 131474757891, step: 6
		, conclusion: "failure"
		, candidate: vo1220ReleaseGatePartialCloneRepairPredecessor
		, code: "build-command-failed"
		, diagnostic: "resource exhausted (error code: 28, no space left on device)"
	});
	assert.deepEqual(history.localValidation, {
		releaseAuthorization: { passed: 25, failed: 0 }
		, scopedLint: "passed", checkedJavaScriptTypecheck: "passed"
	});
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ReleaseGatePartialCloneRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ReleaseGatePartialCloneRepairIntegrationPaths);
});

test("release-gate checkout keeps history and leaves old blobs lazy", () => {
	const previous = sourceAt(vo1220ReleaseGatePartialCloneRepairPredecessor
		, ".github/workflows/reproducible-release.yml");
	const current = sourceAt(vo1220ReleaseGatePartialCloneRepairImplementation
		, ".github/workflows/reproducible-release.yml");
	assert.match(previous, /fetch-depth: 0\n\s+persist-credentials: false/u);
	assert.doesNotMatch(previous, /filter: blob:none/u);
	assert.match(current, /fetch-depth: 0\n(?:.|\n)*?filter: blob:none/u);
	const tests = sourceAt(vo1220ReleaseGatePartialCloneRepairImplementation
		, "tests/reproducibility-gate.test.mjs");
	assert.match(tests
		, /source preparation accepts a blob-filtered complete commit graph/u);
	assert.match(tests, /GIT_NO_LAZY_FETCH: "1"/u);
});

test("release-gate partial clone repair reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(vo1220ReleaseGatePartialCloneRepairImplementation
			, update.path);
		const previous = sourceAt(vo1220ReleaseGatePartialCloneRepairPredecessor
			, update.path);
		assert.equal(reverseVo1220ReleaseGatePartialCloneRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220ReleaseGatePartialCloneRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(vo1220ReleaseGatePartialCloneRepairImplementation
			, update.path);
		assert.equal(reverseVo1220ReleaseGatePartialCloneRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ReleaseGatePartialCloneRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("release-gate partial clone history rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ReleaseGatePartialCloneRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(vo1220ReleaseGatePartialCloneRepairImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ReleaseGatePartialCloneRepairUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-release-gate-partial-clone-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-release-gate-partial-clone-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
