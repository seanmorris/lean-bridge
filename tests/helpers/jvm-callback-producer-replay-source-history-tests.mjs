/**
 * Authenticate the JVM replay history and reject forged transitions.
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
	beforeJvmCallbackProducerReplaySource
	, jvmCallbackProducerReplayAddedPaths
	, jvmCallbackProducerReplayChangedPaths
	, jvmCallbackProducerReplayCommits
	, jvmCallbackProducerReplayImplementationPaths
	, jvmCallbackProducerReplayHistoryPath
	, jvmCallbackProducerReplayImplementation
	, jvmCallbackProducerReplayIntegrationBase
	, jvmCallbackProducerReplayIntegrationPaths
	, jvmCallbackProducerReplayPredecessor
	, reverseJvmCallbackProducerReplayUpdate
} from "./jvm-callback-producer-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	jvmCallbackProducerReplayHistoryPath, "utf8"));

test("JVM callback replay authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "jvm-callback-producer-replay-source-v1");
	assert.equal(record.predecessorCommit, jvmCallbackProducerReplayPredecessor);
	assert.equal(record.implementationCommit, jvmCallbackProducerReplayImplementation);
	assert.equal(record.integrationBaseCommit, jvmCallbackProducerReplayIntegrationBase);
	assert.deepEqual(record.implementationCommits, jvmCallbackProducerReplayCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, jvmCallbackProducerReplayChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, jvmCallbackProducerReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, jvmCallbackProducerReplayAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, jvmCallbackProducerReplayPredecessor + ".." + jvmCallbackProducerReplayImplementation]).trim().split("\n")
	, jvmCallbackProducerReplayCommits);
	for(const [index, revision] of jvmCallbackProducerReplayCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? jvmCallbackProducerReplayPredecessor : jvmCallbackProducerReplayCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, jvmCallbackProducerReplayPredecessor
		, jvmCallbackProducerReplayImplementation]).trim().split("\n")
	, [...jvmCallbackProducerReplayImplementationPaths].sort());
	const updates = [...record.updates
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeJvmCallbackProducerReplaySource);
		const prior = record.integrationUpdates.includes(update)
			? jvmCallbackProducerReplayIntegrationBase : jvmCallbackProducerReplayPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseJvmCallbackProducerReplayUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("JVM callback replay rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeJvmCallbackProducerReplaySource);
	assert.equal(beforeJvmCallbackProducerReplaySource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeJvmCallbackProducerReplaySource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseJvmCallbackProducerReplayUpdate(current, forged));
	assert.equal(beforeJvmCallbackProducerReplaySource(
		"unrelated.mjs", current), current);
});

test("JVM callback replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-jvm-callback-replay-guard-"));
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
		"scripts/update-jvm-callback-producer-replay-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
