/**
 * Authenticate the Python replay history and reject forged transitions.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforePythonCallbackProducerReplaySource
	, pythonCallbackProducerReplayAddedPaths
	, pythonCallbackProducerReplayChangedPaths
	, pythonCallbackProducerReplayCommits
	, pythonCallbackProducerReplayImplementationPaths
	, pythonCallbackProducerReplayHistoryPath
	, pythonCallbackProducerReplayImplementation
	, pythonCallbackProducerReplayIntegrationBase
	, pythonCallbackProducerReplayIntegrationPaths
	, pythonCallbackProducerReplayPredecessor
	, reversePythonCallbackProducerReplayUpdate
} from "./python-callback-producer-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	pythonCallbackProducerReplayHistoryPath, "utf8"));

test("Python callback replay authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "python-callback-producer-replay-source-v1");
	assert.equal(record.predecessorCommit, pythonCallbackProducerReplayPredecessor);
	assert.equal(record.implementationCommit, pythonCallbackProducerReplayImplementation);
	assert.equal(record.integrationBaseCommit, pythonCallbackProducerReplayIntegrationBase);
	assert.deepEqual(record.implementationCommits, pythonCallbackProducerReplayCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, pythonCallbackProducerReplayChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, pythonCallbackProducerReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, pythonCallbackProducerReplayAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, pythonCallbackProducerReplayPredecessor + ".." + pythonCallbackProducerReplayImplementation]).trim().split("\n")
	, pythonCallbackProducerReplayCommits);
	for(const [index, revision] of pythonCallbackProducerReplayCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? pythonCallbackProducerReplayPredecessor : pythonCallbackProducerReplayCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, pythonCallbackProducerReplayPredecessor
		, pythonCallbackProducerReplayImplementation]).trim().split("\n")
	, [...pythonCallbackProducerReplayImplementationPaths].sort());
	const updates = [...record.updates
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePythonCallbackProducerReplaySource);
		const prior = record.integrationUpdates.includes(update)
			? pythonCallbackProducerReplayIntegrationBase : pythonCallbackProducerReplayPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePythonCallbackProducerReplayUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Python callback replay rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePythonCallbackProducerReplaySource);
	assert.equal(beforePythonCallbackProducerReplaySource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePythonCallbackProducerReplaySource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePythonCallbackProducerReplayUpdate(current, forged));
	assert.equal(beforePythonCallbackProducerReplaySource(
		"unrelated.mjs", current), current);
});

test("Python callback replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-python-callback-replay-guard-"));
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
		"scripts/update-python-callback-producer-replay-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
