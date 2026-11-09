/**
 * Verify the pinned GitHub release-asset API failover and seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220ReleaseAssetApiFailover
	, beforeVo1220ReleaseAssetApiFailoverSource
	, reverseVo1220ReleaseAssetApiFailoverUpdate
	, vo1220ReleaseAssetApiFailoverBehavior
	, vo1220ReleaseAssetApiFailoverHistoryAdditions
	, vo1220ReleaseAssetApiFailoverHistoryPath
	, vo1220ReleaseAssetApiFailoverImplementation
	, vo1220ReleaseAssetApiFailoverImplementationPaths
	, vo1220ReleaseAssetApiFailoverIntegrationPaths
	, vo1220ReleaseAssetApiFailoverNormalizationPaths
	, vo1220ReleaseAssetApiFailoverPredecessor
} from "./vo1220-release-asset-api-failover-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220ReleaseAssetApiFailoverHistoryPath, "utf8"
));

test("release-asset API failover authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-release-asset-api-failover-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220ReleaseAssetApiFailoverPredecessor);
	assert.equal(value.implementationCommit
		, vo1220ReleaseAssetApiFailoverImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220ReleaseAssetApiFailoverImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220ReleaseAssetApiFailoverIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220ReleaseAssetApiFailoverHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = update.currentSha256 === value.updates.find(item =>
			item.path === update.path)?.currentSha256
			? blob(vo1220ReleaseAssetApiFailoverPredecessor, update.path)
			: blob(vo1220ReleaseAssetApiFailoverImplementation, update.path);
		assert.equal(reverseVo1220ReleaseAssetApiFailoverUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("release-asset API failover preserves every product contract", async () => {
	const value = await read();
	assert.deepEqual(value.behavior, vo1220ReleaseAssetApiFailoverBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(value.behavior.packageSemanticChanges, 0);
	assert.equal(value.behavior.releaseAssets, 4);
	assert.equal(value.behavior.checksummedAssets, 4);
	assert.equal(value.behavior.uncheckedAssets, 0);
	assert.deepEqual(value.currentSourcePins, []);
	assert.equal(value.inventorySha256.before, value.inventorySha256.after);
	assert.equal(value.exactModelSha256.before, value.exactModelSha256.after);
	const sources = Object.fromEntries(
		vo1220ReleaseAssetApiFailoverImplementationPaths.map(path => [
			path, blob(vo1220ReleaseAssetApiFailoverImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220ReleaseAssetApiFailover(sources)
		, vo1220ReleaseAssetApiFailoverBehavior);
});

test("release-asset API failover rejects unknown transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(vo1220ReleaseAssetApiFailoverImplementation
		, update.path);
	assert.equal(beforeVo1220ReleaseAssetApiFailoverSource(
		update.path, current, update.currentSha256), current);
	assert.equal(beforeVo1220ReleaseAssetApiFailoverSource(
		update.path, `${current}unknown`), `${current}unknown`);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseVo1220ReleaseAssetApiFailoverUpdate(
			current, forged));
	assert.ok(vo1220ReleaseAssetApiFailoverNormalizationPaths
		.includes(update.path));
});

test("release-asset API failover writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-release-api-guard-`);
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
		"scripts/update-vo1220-release-asset-api-failover-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
