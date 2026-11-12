/**
 * Authenticate the Docker-visible shared Git object-store repair and pins.
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
	beforeVo1220ReleaseDockerGitMountSource
	, reverseVo1220ReleaseDockerGitMountUpdate
	, vo1220ReleaseDockerGitMountAddedPaths
	, vo1220ReleaseDockerGitMountHistoryPath
	, vo1220ReleaseDockerGitMountImplementation
	, vo1220ReleaseDockerGitMountImplementationPaths
	, vo1220ReleaseDockerGitMountIntegrationPaths
	, vo1220ReleaseDockerGitMountNormalizationPaths
	, vo1220ReleaseDockerGitMountPinPaths
	, vo1220ReleaseDockerGitMountPinRefresh
	, vo1220ReleaseDockerGitMountPredecessor
} from "./vo1220-release-docker-git-mount-source-history.mjs";
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
	vo1220ReleaseDockerGitMountHistoryPath, "utf8"));

test("release Docker Git-mount repair records the exact review finding", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "vo1220-release-docker-git-mount-v1");
	assert.equal(history.predecessorCommit
		, vo1220ReleaseDockerGitMountPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ReleaseDockerGitMountImplementation);
	assert.equal(history.pinRefreshCommit
		, vo1220ReleaseDockerGitMountPinRefresh);
	assert.deepEqual(history.review, {
		pullRequest: 10, comment: 4555023212
		, commit: vo1220ReleaseDockerGitMountPredecessor
		, severity: "high"
	});
	assert.equal(history.refreshedPins, 16);
	assert.equal(history.remainingMismatches, 0);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ReleaseDockerGitMountImplementationPaths);
	assert.deepEqual(history.pinUpdates.map(update => update.path)
		, vo1220ReleaseDockerGitMountPinPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ReleaseDockerGitMountIntegrationPaths);
});

test("release Docker Git-mount repair carries shared objects read-only", () => {
	const canonical = sourceAt(vo1220ReleaseDockerGitMountImplementation
		, "src/build/canonical-build.mjs");
	const tests = sourceAt(vo1220ReleaseDockerGitMountImplementation
		, "tests/canonical-build.test.mjs");
	assert.match(canonical, /export const resolveDockerGitMounts/u);
	assert.match(canonical, /alternate-object closure exceeds 64 directories/u);
	assert.match(canonical, /gitMounts\.flatMap\(mount => \[/u);
	assert.match(canonical
		, /type=bind,source=\$\{mount\.source\},target=\$\{mount\.target\},readonly/u);
	assert.match(tests
		, /Docker mounts the complete shared Git alternate-object closure read-only/u);
	assert.match(tests, /missing-docker-git-object-store/u);
});

test("release Docker Git-mount repair reverses every transition", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(reverseVo1220ReleaseDockerGitMountUpdate(
			sourceAt(vo1220ReleaseDockerGitMountImplementation, update.path), update)
		, sourceAt(vo1220ReleaseDockerGitMountPredecessor, update.path)
		, update.path);
	for(const update of history.pinUpdates)
		assert.equal(reverseVo1220ReleaseDockerGitMountUpdate(
			sourceAt(vo1220ReleaseDockerGitMountPinRefresh, update.path), update)
		, sourceAt(vo1220ReleaseDockerGitMountImplementation, update.path)
		, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(vo1220ReleaseDockerGitMountPinRefresh
			, update.path);
		assert.equal(reverseVo1220ReleaseDockerGitMountUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeVo1220ReleaseDockerGitMountSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ReleaseDockerGitMountNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("release Docker Git-mount history rejects forgeries and duplicate writers", async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ReleaseDockerGitMountAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(vo1220ReleaseDockerGitMountImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ReleaseDockerGitMountUpdate(current, forged));
	const root = await mkdtemp(`${tmpdir()}/vo1220-release-docker-git-guard-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-release-docker-git-mount-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
