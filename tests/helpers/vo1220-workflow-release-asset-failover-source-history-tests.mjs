/**
 * Verify the complete workflow release-asset failover and seal.
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
	assertVo1220WorkflowReleaseAssetFailover
	, beforeVo1220WorkflowReleaseAssetFailoverSource
	, reverseVo1220WorkflowReleaseAssetFailoverUpdate
	, vo1220WorkflowReleaseAssetFailoverBehavior
	, vo1220WorkflowReleaseAssetFailoverChangedPaths
	, vo1220WorkflowReleaseAssetFailoverHistoryAdditions
	, vo1220WorkflowReleaseAssetFailoverHistoryPath
	, vo1220WorkflowReleaseAssetFailoverImplementation
	, vo1220WorkflowReleaseAssetFailoverImplementationAddedPaths
	, vo1220WorkflowReleaseAssetFailoverImplementationPaths
	, vo1220WorkflowReleaseAssetFailoverIntegrationPaths
	, vo1220WorkflowReleaseAssetFailoverNormalizationPaths
	, vo1220WorkflowReleaseAssetFailoverPredecessor
} from "./vo1220-workflow-release-asset-failover-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220WorkflowReleaseAssetFailoverHistoryPath, "utf8"
));

test("workflow release-asset failover authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-workflow-release-asset-failover-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220WorkflowReleaseAssetFailoverPredecessor);
	assert.equal(value.implementationCommit
		, vo1220WorkflowReleaseAssetFailoverImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220WorkflowReleaseAssetFailoverChangedPaths);
	assert.deepEqual(value.implementationAdditions.map(addition => addition.path)
		, vo1220WorkflowReleaseAssetFailoverImplementationAddedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220WorkflowReleaseAssetFailoverIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220WorkflowReleaseAssetFailoverHistoryAdditions);
	for(const addition of [
		...value.implementationAdditions, ...value.historyAdditions
	]) assert.equal(sha256(await sourceAtFinHistoryMilestone(
		addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = update.currentSha256 === value.updates.find(item =>
			item.path === update.path)?.currentSha256
			? blob(vo1220WorkflowReleaseAssetFailoverPredecessor, update.path)
			: blob(vo1220WorkflowReleaseAssetFailoverImplementation, update.path);
		assert.equal(reverseVo1220WorkflowReleaseAssetFailoverUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("workflow release-asset failover preserves every product contract", async () => {
	const value = await read();
	assert.deepEqual(value.behavior
		, vo1220WorkflowReleaseAssetFailoverBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(value.behavior.packageSemanticChanges, 0);
	assert.equal(value.behavior.workflowCallSites, 35);
	assert.equal(value.behavior.directBrowserUrlsAfter, 0);
	assert.equal(value.behavior.checksummedAssets, 2);
	assert.equal(value.behavior.uncheckedAssets, 0);
	assert.deepEqual(value.currentSourcePins, []);
	assert.equal(value.inventorySha256.before, value.inventorySha256.after);
	assert.equal(value.exactModelSha256.before, value.exactModelSha256.after);
	const sources = Object.fromEntries(
		vo1220WorkflowReleaseAssetFailoverImplementationPaths.map(path => [
			path, blob(vo1220WorkflowReleaseAssetFailoverImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220WorkflowReleaseAssetFailover(sources)
		, vo1220WorkflowReleaseAssetFailoverBehavior);
});

test("workflow release-asset failover rejects unknown transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(vo1220WorkflowReleaseAssetFailoverImplementation
		, update.path);
	assert.equal(beforeVo1220WorkflowReleaseAssetFailoverSource(
		update.path, current, update.currentSha256), current);
	assert.equal(beforeVo1220WorkflowReleaseAssetFailoverSource(
		update.path, `${current}unknown`), `${current}unknown`);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseVo1220WorkflowReleaseAssetFailoverUpdate(
			current, forged));
	assert.ok(vo1220WorkflowReleaseAssetFailoverNormalizationPaths
		.includes(update.path));
});

test("workflow release-asset failover writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-workflow-release-guard-`);
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
		"scripts/update-vo1220-workflow-release-asset-failover-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
