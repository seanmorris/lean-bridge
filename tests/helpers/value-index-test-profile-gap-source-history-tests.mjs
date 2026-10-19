/**
 * Prove that every omitted value-index Core profile transition remains
 * reversible and that current evidence pins name the live profile source.
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
	beforeValueIndexTestProfileGapSource
	, reverseValueIndexTestProfileGapHistoricalUpdate
	, reverseValueIndexTestProfileGapUpdate
	, valueIndexTestProfileGapAddedPaths
	, valueIndexTestProfileGapChangedPaths
	, valueIndexTestProfileGapDraftParent
	, valueIndexTestProfileGapHistoricalPaths
	, valueIndexTestProfileGapHistoryPath
	, valueIndexTestProfileGapPredecessor
} from "./value-index-test-profile-gap-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const profilePath = "src/adoption/test-profiles.mjs";
const typeSurfacePath = "docs/type-surface.v1.json";
const historyHubPath = "tests/helpers/fin-refinement-source-history.mjs";
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("value-index profile gaps and their live repair are exact", async () => {
	const record = JSON.parse(await readFile(valueIndexTestProfileGapHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "value-index-test-profile-gap-source-v1");
	assert.equal(record.predecessorCommit, valueIndexTestProfileGapPredecessor);
	assert.equal(record.draftParentCommit, valueIndexTestProfileGapDraftParent);
	assert.deepEqual(record.updates.map(item => item.path)
		, valueIndexTestProfileGapChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, valueIndexTestProfileGapAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		valueIndexTestProfileGapChangedPaths
	)));
	assert.equal(record.pinCount, 103);
	assert.deepEqual(record.pinUpdates.map(item => [item.path, item.count]), [
		[profilePath, 94]
		, ["tests/component-array-contract.test.mjs", 3]
		, ["docs/php.md", 6]
	]);
	assert.deepEqual(valueIndexTestProfileGapHistoricalPaths, [
		typeSurfacePath, profilePath, historyHubPath
	]);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeValueIndexTestProfileGapSource
		);
		const previous = git(["show"
			, `${valueIndexTestProfileGapPredecessor}:${update.path}`]);
		assert.equal(reverseValueIndexTestProfileGapUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeValueIndexTestProfileGapSource(update.path, current)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.equal(record.historicalTransitions.length, 6);
	for(let index = 0; index < record.historicalTransitions.length; index++)
	{
		const transition = record.historicalTransitions[index];
		const previous = git(["show"
			, `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show"
			, `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256);
		assert.equal(sha256(current), transition.currentSha256);
		assert.equal(reverseValueIndexTestProfileGapHistoricalUpdate(current, transition)
			, previous);
	}
	const transitionsByPath = Map.groupBy(record.historicalTransitions
		, transition => transition.path);
	for(const transitions of transitionsByPath.values())
		for(let index = 0; index < transitions.length - 1; index++)
			assert.equal(transitions[index].previousSha256
				, transitions[index + 1].currentSha256);
	const profileTransitions = transitionsByPath.get(profilePath);
	const live = await readFile(profilePath, "utf8");
	for(const transition of profileTransitions)
		assert.equal(beforeValueIndexTestProfileGapSource(profilePath, live
			, transition.currentSha256), git(["show"
			, `${transition.currentCommit}:${profilePath}`]));
	const earliest = profileTransitions.at(-1);
	assert.equal(beforeValueIndexTestProfileGapSource(profilePath, live)
		, git(["show", `${earliest.previousCommit}:${profilePath}`]));
	assert.equal(beforeValueIndexTestProfileGapSource(profilePath, live + "unknown")
		, live + "unknown");
	const typeTransitions = transitionsByPath.get(typeSurfacePath);
	const typeSource = git(["show"
		, `${typeTransitions[0].currentCommit}:${typeSurfacePath}`]);
	assert.equal(beforeValueIndexTestProfileGapSource(typeSurfacePath, typeSource)
		, git(["show", `${typeTransitions.at(-1).previousCommit}:${typeSurfacePath}`]));
	const hubTransitions = transitionsByPath.get(historyHubPath);
	const hubSource = git(["show"
		, `${hubTransitions[0].currentCommit}:${historyHubPath}`]);
	assert.equal(beforeValueIndexTestProfileGapSource(historyHubPath, hubSource)
		, git(["show", `${hubTransitions[0].previousCommit}:${historyHubPath}`]));
});

test("value-index profile-gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-profile-gap-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-value-index-test-profile-gap-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact draft parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
