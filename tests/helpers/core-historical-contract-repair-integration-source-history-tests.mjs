/**
 * Authenticate central registration of the Core historical-contract repair.
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
	beforeCoreHistoricalContractRepairIntegrationSource
	, coreHistoricalContractRepairIntegrationAddedPaths
	, coreHistoricalContractRepairIntegrationBase
	, coreHistoricalContractRepairIntegrationCommits
	, coreHistoricalContractRepairIntegrationHistoryPath
	, coreHistoricalContractRepairIntegrationImplementation
	, coreHistoricalContractRepairIntegrationPaths
	, reverseCoreHistoricalContractRepairIntegrationUpdate
} from "./core-historical-contract-repair-integration-source-history.mjs";
import {
	coreHistoricalContractRepairHistoryPath
} from "./core-historical-contract-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreHistoricalContractRepairIntegrationHistoryPath, "utf8"
));

test("Core historical-contract integration restores its exact hub and partition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "baseHistory", "baseCommit", "implementationCommit"
		, "implementationCommits", "milestone", "schemaVersion", "scope", "updates"
	].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-historical-contract-repair-integration-v1");
	assert.equal(record.baseCommit
		, coreHistoricalContractRepairIntegrationBase);
	assert.equal(record.implementationCommit
		, coreHistoricalContractRepairIntegrationImplementation);
	assert.deepEqual(record.implementationCommits
		, coreHistoricalContractRepairIntegrationCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreHistoricalContractRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreHistoricalContractRepairIntegrationAddedPaths);
	assert.deepEqual(record.baseHistory, {
		path: coreHistoricalContractRepairHistoryPath
		, sha256: sha256(await readFile(coreHistoricalContractRepairHistoryPath))
	});
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${coreHistoricalContractRepairIntegrationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${coreHistoricalContractRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseCoreHistoricalContractRepairIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.equal(beforeCoreHistoricalContractRepairIntegrationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("Core historical-contract integration rejects altered transitions", async () => {
	const record = await readRecord(), update = record.updates[0];
	const current = git(["show"
		, `${coreHistoricalContractRepairIntegrationImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreHistoricalContractRepairIntegrationUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeCoreHistoricalContractRepairIntegrationSource(update.path
		, `${current}unknown\n`), `${current}unknown\n`);
});

test("Core historical-contract integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-historical-contract-integration-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-historical-contract-repair-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration implementation/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
