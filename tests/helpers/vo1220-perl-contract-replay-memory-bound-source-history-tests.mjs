/**
 * Verify the bounded-memory Perl contract replay repair and seal.
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
	assertVo1220PerlContractReplayMemoryBound
	, beforeVo1220PerlContractReplayMemoryBoundSource
	, reverseVo1220PerlContractReplayMemoryBoundUpdate
	, vo1220PerlContractReplayMemoryBoundBehavior
	, vo1220PerlContractReplayMemoryBoundHistoryAdditions
	, vo1220PerlContractReplayMemoryBoundHistoryPath
	, vo1220PerlContractReplayMemoryBoundImplementation
	, vo1220PerlContractReplayMemoryBoundImplementationPaths
	, vo1220PerlContractReplayMemoryBoundIntegrationPaths
	, vo1220PerlContractReplayMemoryBoundNormalizationPaths
	, vo1220PerlContractReplayMemoryBoundPredecessor
} from "./vo1220-perl-contract-replay-memory-bound-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220PerlContractReplayMemoryBoundHistoryPath, "utf8"
));

test("Perl contract replay memory bound authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-perl-contract-replay-memory-bound-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220PerlContractReplayMemoryBoundPredecessor);
	assert.equal(value.implementationCommit
		, vo1220PerlContractReplayMemoryBoundImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220PerlContractReplayMemoryBoundImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220PerlContractReplayMemoryBoundIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220PerlContractReplayMemoryBoundHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of [...value.updates, ...value.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = vo1220PerlContractReplayMemoryBoundImplementationPaths
			.includes(update.path)
			? blob(vo1220PerlContractReplayMemoryBoundPredecessor, update.path)
			: blob(vo1220PerlContractReplayMemoryBoundImplementation, update.path);
		assert.equal(reverseVo1220PerlContractReplayMemoryBoundUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("Perl contract replay memory bound preserves every product claim", async () => {
	const value = await read();
	assert.deepEqual(value.behavior
		, vo1220PerlContractReplayMemoryBoundBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(value.behavior.recordUpdates, 8);
	assert.equal(value.behavior.replayedNegativeMutations, 24);
	assert.equal(value.behavior.sealNegativeMutations, 3);
	assert.equal(value.behavior.cacheIdentityFields, 2);
	assert.equal(value.behavior.boundedDifferenceDiagnostics, true);
	assert.equal(value.behavior.exactRecordSources, 11);
	assert.equal(value.exactModelSha256.before, value.exactModelSha256.after);
	const sources = Object.fromEntries(
		vo1220PerlContractReplayMemoryBoundImplementationPaths.map(path => [
			path, blob(vo1220PerlContractReplayMemoryBoundImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220PerlContractReplayMemoryBound(sources)
		, vo1220PerlContractReplayMemoryBoundBehavior);
});

test("Perl contract replay memory bound rejects unknown transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(vo1220PerlContractReplayMemoryBoundImplementation
		, update.path);
	assert.equal(beforeVo1220PerlContractReplayMemoryBoundSource(
		update.path, current, update.currentSha256), current);
	assert.equal(beforeVo1220PerlContractReplayMemoryBoundSource(
		update.path, `${current}unknown`), `${current}unknown`);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseVo1220PerlContractReplayMemoryBoundUpdate(
			current, forged));
	assert.ok(vo1220PerlContractReplayMemoryBoundNormalizationPaths
		.includes(update.path));
});

test("Perl contract replay memory-bound writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-perl-replay-memory-guard-`);
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
		"scripts/update-vo1220-perl-contract-replay-memory-bound-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
