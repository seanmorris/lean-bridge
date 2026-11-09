/**
 * Verify the workflow release-asset source-pin refresh and seal.
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
	assertVo1220WorkflowReleaseAssetPinRefresh
	, beforeVo1220WorkflowReleaseAssetPinRefreshSource
	, reverseVo1220WorkflowReleaseAssetPinRefreshUpdate
	, vo1220WorkflowReleaseAssetPinRefreshBehavior
	, vo1220WorkflowReleaseAssetPinRefreshChangedPaths
	, vo1220WorkflowReleaseAssetPinRefreshHistoryAdditions
	, vo1220WorkflowReleaseAssetPinRefreshHistoryPath
	, vo1220WorkflowReleaseAssetPinRefreshImplementation
	, vo1220WorkflowReleaseAssetPinRefreshImplementationAddedPaths
	, vo1220WorkflowReleaseAssetPinRefreshImplementationPaths
	, vo1220WorkflowReleaseAssetPinRefreshIntegrationPaths
	, vo1220WorkflowReleaseAssetPinRefreshNormalizationPaths
	, vo1220WorkflowReleaseAssetPinRefreshPredecessor
} from "./vo1220-workflow-release-asset-pin-refresh-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220WorkflowReleaseAssetPinRefreshHistoryPath, "utf8"
));

test("workflow release-asset pin refresh authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-workflow-release-asset-pin-refresh-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220WorkflowReleaseAssetPinRefreshPredecessor);
	assert.equal(value.implementationCommit
		, vo1220WorkflowReleaseAssetPinRefreshImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220WorkflowReleaseAssetPinRefreshChangedPaths);
	assert.deepEqual(value.implementationAdditions.map(addition => addition.path)
		, vo1220WorkflowReleaseAssetPinRefreshImplementationAddedPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220WorkflowReleaseAssetPinRefreshIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220WorkflowReleaseAssetPinRefreshHistoryAdditions);
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
			? blob(vo1220WorkflowReleaseAssetPinRefreshPredecessor, update.path)
			: blob(vo1220WorkflowReleaseAssetPinRefreshImplementation, update.path);
		assert.equal(reverseVo1220WorkflowReleaseAssetPinRefreshUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("workflow release-asset pin refresh changes only exact source identities", async () => {
	const value = await read();
	assert.deepEqual(value.behavior
		, vo1220WorkflowReleaseAssetPinRefreshBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(value.behavior.currentSourcePaths, 18);
	assert.equal(value.behavior.refreshedPins, 271);
	assert.equal(value.currentSourcePins.length, 18);
	assert.equal(value.currentSourcePins.reduce(
		(sum, pin) => sum + pin.occurrences, 0), 271);
	assert.equal(value.exactModelSha256.before, value.exactModelSha256.after);
	assert.notEqual(value.inventorySha256.before, value.inventorySha256.after);
	const sources = Object.fromEntries(
		vo1220WorkflowReleaseAssetPinRefreshImplementationPaths.map(path => [
			path, blob(vo1220WorkflowReleaseAssetPinRefreshImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220WorkflowReleaseAssetPinRefresh(sources)
		, vo1220WorkflowReleaseAssetPinRefreshBehavior);
});

test("workflow release-asset pin refresh rejects unknown transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(vo1220WorkflowReleaseAssetPinRefreshImplementation
		, update.path);
	assert.equal(beforeVo1220WorkflowReleaseAssetPinRefreshSource(
		update.path, current, update.currentSha256), current);
	assert.equal(beforeVo1220WorkflowReleaseAssetPinRefreshSource(
		update.path, `${current}unknown`), `${current}unknown`);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseVo1220WorkflowReleaseAssetPinRefreshUpdate(
			current, forged));
	assert.ok(vo1220WorkflowReleaseAssetPinRefreshNormalizationPaths
		.includes(update.path));
});

test("workflow release-asset pin writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-workflow-pin-guard-`);
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
		"scripts/update-vo1220-workflow-release-asset-pin-refresh-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
