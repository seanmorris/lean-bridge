/**
 * Authenticate the Core receiver endpoint repair history and reject forged transitions.
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
	beforeCoreReceiverEndpointRepairSource
	, coreReceiverEndpointRepairAddedPaths
	, coreReceiverEndpointRepairChangedPaths
	, coreReceiverEndpointRepairCommits
	, coreReceiverEndpointRepairImplementationPaths
	, coreReceiverEndpointRepairHistoryPath
	, coreReceiverEndpointRepairImplementation
	, coreReceiverEndpointRepairIntegrationBase
	, coreReceiverEndpointRepairIntegrationPaths
	, coreReceiverEndpointRepairPredecessor
	, reverseCoreReceiverEndpointRepairUpdate
} from "./core-receiver-endpoint-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	coreReceiverEndpointRepairHistoryPath, "utf8"));

test("Core receiver endpoint repair authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-receiver-endpoint-repair-source-v1");
	assert.equal(record.predecessorCommit, coreReceiverEndpointRepairPredecessor);
	assert.equal(record.implementationCommit, coreReceiverEndpointRepairImplementation);
	assert.equal(record.integrationBaseCommit, coreReceiverEndpointRepairIntegrationBase);
	assert.deepEqual(record.implementationCommits, coreReceiverEndpointRepairCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreReceiverEndpointRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, coreReceiverEndpointRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreReceiverEndpointRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, coreReceiverEndpointRepairPredecessor + ".." + coreReceiverEndpointRepairImplementation]).trim().split("\n")
	, coreReceiverEndpointRepairCommits);
	for(const [index, revision] of coreReceiverEndpointRepairCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? coreReceiverEndpointRepairPredecessor : coreReceiverEndpointRepairCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, coreReceiverEndpointRepairPredecessor
		, coreReceiverEndpointRepairImplementation]).trim().split("\n")
	, [...coreReceiverEndpointRepairImplementationPaths].sort());
	const updates = [...record.updates
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCoreReceiverEndpointRepairSource);
		const prior = record.integrationUpdates.includes(update)
			? coreReceiverEndpointRepairIntegrationBase : coreReceiverEndpointRepairPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reverseCoreReceiverEndpointRepairUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Core receiver endpoint repair rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCoreReceiverEndpointRepairSource);
	assert.equal(beforeCoreReceiverEndpointRepairSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforeCoreReceiverEndpointRepairSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseCoreReceiverEndpointRepairUpdate(current, forged));
	assert.equal(beforeCoreReceiverEndpointRepairSource(
		"unrelated.mjs", current), current);
});

test("Core receiver endpoint repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-receiver-endpoint-guard-"));
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
		"scripts/update-core-receiver-endpoint-repair-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
