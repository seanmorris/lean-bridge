/**
 * Authenticate the bounded discard-only Docker log repair and public pins.
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
	beforeVo1220ReleaseDockerLogBoundSource
	, reverseVo1220ReleaseDockerLogBoundUpdate
	, vo1220ReleaseDockerLogBoundAddedPaths
	, vo1220ReleaseDockerLogBoundHistoryPath
	, vo1220ReleaseDockerLogBoundImplementation
	, vo1220ReleaseDockerLogBoundImplementationPaths
	, vo1220ReleaseDockerLogBoundIntegrationPaths
	, vo1220ReleaseDockerLogBoundNormalizationPaths
	, vo1220ReleaseDockerLogBoundPinPaths
	, vo1220ReleaseDockerLogBoundPinRefresh
	, vo1220ReleaseDockerLogBoundPredecessor
} from "./vo1220-release-docker-log-bound-source-history.mjs";
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
	vo1220ReleaseDockerLogBoundHistoryPath, "utf8"));

test("release Docker-log repair records the complete hosted failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "vo1220-release-docker-log-bound-v1");
	assert.equal(history.predecessorCommit
		, vo1220ReleaseDockerLogBoundPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ReleaseDockerLogBoundImplementation);
	assert.equal(history.pinRefreshCommit
		, vo1220ReleaseDockerLogBoundPinRefresh);
	assert.deepEqual(history.failedRun, {
		workflow: 43282516528, job: 131407244760
		, code: "build-output-limit"
		, failure: "Docker exceeded the 32 MiB diagnostic limit"
	});
	assert.equal(history.refreshedPins, 18);
	assert.deepEqual(history.pinCounts, {
		"src/build/canonical-build.mjs": 16
		, "src/build/process-runner.mjs": 2
	});
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ReleaseDockerLogBoundImplementationPaths);
	assert.deepEqual(history.pinUpdates.map(update => update.path)
		, vo1220ReleaseDockerLogBoundPinPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ReleaseDockerLogBoundIntegrationPaths);
});

test("release Docker-log repair preserves strict and bounded runner policies", async () => {
	const runner = sourceAt(vo1220ReleaseDockerLogBoundImplementation
		, "src/build/process-runner.mjs");
	const canonical = sourceAt(vo1220ReleaseDockerLogBoundImplementation
		, "src/build/canonical-build.mjs");
	const tests = sourceAt(vo1220ReleaseDockerLogBoundImplementation
		, "tests/helpers/process-failure-diagnostics-tests.mjs");
	assert.match(runner, /outputPolicies = new Set\(\["fail", "bounded-tail"\]\)/u);
	assert.match(runner, /outputPolicy === "fail" && bytes > maximumOutputBytes/u);
	assert.match(runner, /while\(target\.retained > maximumOutputBytes\)/u);
	assert.equal(canonical.match(/outputPolicy: "bounded-tail"/gu)?.length, 2);
	assert.equal(canonical.match(/maximumOutputBytes: 1024 \* 1024/gu)?.length, 2);
	assert.match(tests, /ordinary output exceeds its limit/u);
	assert.match(tests, /retain bounded tails without killing the process/u);
	assert.match(tests, /report observed and truncated output/u);
});

test("release Docker-log repair reverses implementation, pins and integration", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(reverseVo1220ReleaseDockerLogBoundUpdate(
			sourceAt(vo1220ReleaseDockerLogBoundImplementation, update.path), update)
		, sourceAt(vo1220ReleaseDockerLogBoundPredecessor, update.path), update.path);
	for(const update of history.pinUpdates)
		assert.equal(reverseVo1220ReleaseDockerLogBoundUpdate(
			sourceAt(vo1220ReleaseDockerLogBoundPinRefresh, update.path), update)
		, sourceAt(vo1220ReleaseDockerLogBoundImplementation, update.path)
		, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(vo1220ReleaseDockerLogBoundPinRefresh
			, update.path);
		assert.equal(reverseVo1220ReleaseDockerLogBoundUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeVo1220ReleaseDockerLogBoundSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ReleaseDockerLogBoundNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("release Docker-log repair rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ReleaseDockerLogBoundAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(vo1220ReleaseDockerLogBoundImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ReleaseDockerLogBoundUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-release-docker-log-guard-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-release-docker-log-bound-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
