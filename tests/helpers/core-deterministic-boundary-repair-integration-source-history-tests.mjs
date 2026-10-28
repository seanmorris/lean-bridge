/**
 * Authenticate central registration of the deterministic Core repairs.
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
	beforeCoreDeterministicBoundaryRepairIntegrationSource
	, coreDeterministicBoundaryRepairIntegrationAddedPaths
	, coreDeterministicBoundaryRepairIntegrationBase
	, coreDeterministicBoundaryRepairIntegrationHistoryPath
	, coreDeterministicBoundaryRepairIntegrationImplementation
	, coreDeterministicBoundaryRepairIntegrationPaths
	, reverseCoreDeterministicBoundaryRepairIntegrationUpdate
} from "./core-deterministic-boundary-repair-integration-source-history.mjs";
import {
	coreDeterministicBoundaryRepairChangedPaths
	, coreDeterministicBoundaryRepairHistoryPath
	, coreDeterministicBoundaryRepairImplementation
} from "./core-deterministic-boundary-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreDeterministicBoundaryRepairIntegrationHistoryPath, "utf8"
));

test("deterministic Core boundary repair integration records its exact central transition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions", "baseCommit"
		, "baseHistory", "implementationCommit", "milestone"
		, "schemaVersion", "scope", "updates"]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-deterministic-boundary-repair-integration-v1");
	assert.equal(record.baseCommit
		, coreDeterministicBoundaryRepairIntegrationBase);
	assert.equal(record.implementationCommit
		, coreDeterministicBoundaryRepairIntegrationImplementation);
	assert.equal(git(["rev-parse"
		, `${coreDeterministicBoundaryRepairIntegrationImplementation}^`]).trim()
	, coreDeterministicBoundaryRepairIntegrationBase);
	assert.deepEqual(git(["diff", "--name-only"
		, coreDeterministicBoundaryRepairIntegrationBase
		, coreDeterministicBoundaryRepairIntegrationImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...coreDeterministicBoundaryRepairIntegrationPaths].sort());
	assert.deepEqual(record.baseHistory, {
		path: coreDeterministicBoundaryRepairHistoryPath
		, sha256: sha256(await readFile(
			coreDeterministicBoundaryRepairHistoryPath))
	});
	assert.deepEqual(record.updates.map(item => item.path)
		, coreDeterministicBoundaryRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${coreDeterministicBoundaryRepairIntegrationBase}:${update.path}`]);
		const current = git(["show"
			, `${coreDeterministicBoundaryRepairIntegrationImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseCoreDeterministicBoundaryRepairIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreDeterministicBoundaryRepairIntegrationSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCoreDeterministicBoundaryRepairIntegrationSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("deterministic Core boundary repair integration additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, coreDeterministicBoundaryRepairIntegrationAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("central history reaches every deterministic boundary repair endpoint", async () => {
	const sourceRecord = JSON.parse(await readFile(
		coreDeterministicBoundaryRepairHistoryPath, "utf8"));
	assert.equal(sourceRecord.implementationCommit
		, coreDeterministicBoundaryRepairImplementation);
	assert.deepEqual(sourceRecord.updates.map(item => item.path)
		, coreDeterministicBoundaryRepairChangedPaths);
	for(const update of sourceRecord.updates)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256)), update.currentSha256, update.path);
});

test("deterministic Core boundary repair integration rejects altered transitions", async () => {
	for(const update of (await readRecord()).updates)
	{
		const current = git(["show"
			, `${coreDeterministicBoundaryRepairIntegrationImplementation}:${update.path}`]);
		for(const changed of [{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }])
			assert.throws(() =>
				reverseCoreDeterministicBoundaryRepairIntegrationUpdate(
					current, changed));
		const unknown = `${current}unrelated\n`;
		assert.equal(beforeCoreDeterministicBoundaryRepairIntegrationSource(
			update.path, unknown), unknown);
	}
});

test("deterministic Core boundary repair integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-deterministic-boundary-integration-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-deterministic-boundary-repair-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration implementation/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
