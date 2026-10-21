/**
 * Prove that every omitted ledger transition remains reversible from exact Git
 * blobs, that the live cpan-package source walks back to a state another
 * ledger records, and that this repair's own pins are exact.
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
	beforeLedgerTransitionGapSource
	, ledgerTransitionGapAddedPaths
	, ledgerTransitionGapChangedPaths
	, ledgerTransitionGapHistoricalPaths
	, ledgerTransitionGapHistoryPath
	, ledgerTransitionGapPredecessor
	, ledgerTransitionGapTargets
	, reverseLedgerTransitionGapHistoricalUpdate
	, reverseLedgerTransitionGapUpdate
} from "./ledger-transition-gap-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const cpanPackagePath = "src/release/cpan-package.mjs";
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("ledger transition gaps and their live repair are exact", async () => {
	const record = JSON.parse(await readFile(ledgerTransitionGapHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "ledger-transition-gap-source-v1");
	assert.equal(record.predecessorCommit, ledgerTransitionGapPredecessor);
	assert.deepEqual(record.updates.map(item => item.path)
		, ledgerTransitionGapChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ledgerTransitionGapAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		ledgerTransitionGapChangedPaths
	)));
	assert.equal(record.historicalPathsSha256, sha256(JSON.stringify(
		ledgerTransitionGapHistoricalPaths
	)));
	assert.deepEqual(ledgerTransitionGapHistoricalPaths, [cpanPackagePath]);
	assert.ok(record.pinCount > 0);
	assert.equal(record.pinUpdates.reduce((sum, item) => sum + item.count, 0)
		, record.pinCount);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeLedgerTransitionGapSource
		);
		const previous = git(["show", `${ledgerTransitionGapPredecessor}:${update.path}`]);
		assert.equal(reverseLedgerTransitionGapUpdate(current, update), previous, update.path);
		assert.equal(beforeLedgerTransitionGapSource(update.path, current, update.previousSha256)
			, previous, update.path);
		assert.equal(beforeLedgerTransitionGapSource(update.path, current, update.currentSha256)
			, current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path)), addition.currentSha256, addition.path);
	assert.ok(record.historicalTransitions.length >= 1);
	for(const transition of record.historicalTransitions)
	{
		assert.ok(ledgerTransitionGapHistoricalPaths.includes(transition.path));
		const previous = git(["show", `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show", `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256);
		assert.equal(sha256(current), transition.currentSha256);
		assert.equal(reverseLedgerTransitionGapHistoricalUpdate(current, transition), previous);
	}
	const transitionsByPath = Map.groupBy(record.historicalTransitions, item => item.path);
	assert.deepEqual([...transitionsByPath.keys()], [...ledgerTransitionGapHistoricalPaths]);
	for(const [path, transitions] of transitionsByPath)
	{
		// The newest omitted state is exactly the predecessor's blob, and the chain
		// is contiguous down to a state another ledger already records.
		assert.equal(transitions[0].currentSha256
			, sha256(git(["show", `${ledgerTransitionGapPredecessor}:${path}`])), path);
		for(let index = 0; index < transitions.length - 1; index++)
			assert.equal(transitions[index].previousSha256
				, transitions[index + 1].currentSha256, path);
		const live = await readFile(path, "utf8");
		const earliest = transitions.at(-1);
		assert.equal(beforeLedgerTransitionGapSource(path, live)
			, git(["show", `${earliest.previousCommit}:${path}`]), path);
		for(const transition of transitions)
			assert.equal(beforeLedgerTransitionGapSource(path, live, transition.currentSha256)
				, git(["show", `${transition.currentCommit}:${path}`]), path);
		assert.equal(beforeLedgerTransitionGapSource(path, `${live}unknown`), `${live}unknown`);
		// The whole hub now reaches the oldest omitted state and, through the
		// older ledgers, the milestone the hosted history readers require.
		assert.equal(sha256(beforeFinRefinementSource(path, live, earliest.previousSha256))
			, earliest.previousSha256, path);
		const target = ledgerTransitionGapTargets[path];
		assert.match(target, /^[a-f0-9]{64}$/u, path);
		assert.equal(sha256(beforeFinRefinementSource(path, live, target)), target, path);
	}
});

test("ledger transition-gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ledger-transition-gap-"));
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
		"scripts/update-ledger-transition-gap-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
