/**
 * Prove that every omitted hub, registration and owned-fixture transition
 * remains reversible from exact Git blobs, that each live source walks back to
 * a state another ledger records, and that this repair's own pins are exact.
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
	beforeHubTransitionGapSource
	, hubTransitionGapAddedPaths
	, hubTransitionGapChangedPaths
	, hubTransitionGapHistoricalPaths
	, hubTransitionGapHistoryPath
	, hubTransitionGapPredecessor
	, hubTransitionGapTargets
	, reverseHubTransitionGapHistoricalUpdate
	, reverseHubTransitionGapUpdate
} from "./hub-transition-gap-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("hub transition gaps and their live repair are exact", async () => {
	const record = JSON.parse(await readFile(hubTransitionGapHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "hub-transition-gap-source-v1");
	assert.equal(record.predecessorCommit, hubTransitionGapPredecessor);
	assert.deepEqual(record.updates.map(item => item.path)
		, hubTransitionGapChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, hubTransitionGapAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		hubTransitionGapChangedPaths
	)));
	assert.equal(record.historicalPathsSha256, sha256(JSON.stringify(
		hubTransitionGapHistoricalPaths
	)));
	assert.deepEqual(hubTransitionGapHistoricalPaths, [
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
		, "tests/component-array-contract.test.mjs"
		, "tests/fixtures/onboarding/owned-subtypes/Owned.lean"
		, "tests/helpers/owned-aggregate-fixture.mjs"
	]);
	assert.ok(record.pinCount > 0);
	assert.equal(record.pinUpdates.reduce((sum, item) => sum + item.count, 0)
		, record.pinCount);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeHubTransitionGapSource
		);
		const previous = git(["show", `${hubTransitionGapPredecessor}:${update.path}`]);
		assert.equal(reverseHubTransitionGapUpdate(current, update), previous, update.path);
		assert.equal(beforeHubTransitionGapSource(update.path, current, update.previousSha256)
			, previous, update.path);
		assert.equal(beforeHubTransitionGapSource(update.path, current, update.currentSha256)
			, current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	assert.ok(record.historicalTransitions.length >= 2);
	for(const transition of record.historicalTransitions)
	{
		assert.ok(hubTransitionGapHistoricalPaths.includes(transition.path));
		const previous = git(["show", `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256);
		assert.equal(sha256(current), transition.currentSha256);
		assert.equal(reverseHubTransitionGapHistoricalUpdate(current, transition), previous);
	}
	const transitionsByPath = Map.groupBy(record.historicalTransitions, item => item.path);
	assert.deepEqual([...transitionsByPath.keys()], [...hubTransitionGapHistoricalPaths]);
	for(const [path, transitions] of transitionsByPath)
	{
		// The newest omitted state is exactly the predecessor's blob, and the chain
		// is contiguous down to a state another ledger already records.
		assert.equal(transitions[0].currentSha256
			, sha256(git(["show", `${hubTransitionGapPredecessor}:${path}`])), path);
		for(let index = 0; index < transitions.length - 1; index++)
			assert.equal(transitions[index].previousSha256
				, transitions[index + 1].currentSha256, path);
		// Later layers keep changing these live files, so the walk starts from this
		// layer's own milestone, reached through the hub, never from the live bytes.
		const milestone = await sourceAtFinHistoryMilestone(path
			, record.updates.find(item => item.path === path)?.currentSha256
				?? transitions[0].currentSha256
			, beforeHubTransitionGapSource);
		const earliest = transitions.at(-1);
		assert.equal(beforeHubTransitionGapSource(path, milestone)
			, git(["show", `${earliest.previousCommit}:${path}`]), path);
		for(const transition of transitions)
			assert.equal(beforeHubTransitionGapSource(path, milestone, transition.currentSha256)
				, git(["show", `${transition.currentCommit}:${path}`]), path);
		assert.equal(beforeHubTransitionGapSource(path, `${milestone}unknown`), `${milestone}unknown`);
		// The whole hub now reaches the oldest omitted state from the live file and,
		// through the older ledgers, the milestone the hosted history readers require.
		const live = await readFile(path, "utf8");
		assert.equal(sha256(beforeFinRefinementSource(path, live, earliest.previousSha256))
			, earliest.previousSha256, path);
		const target = hubTransitionGapTargets[path];
		assert.match(target, /^[a-f0-9]{64}$/u, path);
		assert.equal(sha256(beforeFinRefinementSource(path, live, target)), target, path);
	}
});

test("hub transition-gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-hub-transition-gap-"));
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
		"scripts/update-hub-transition-gap-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
