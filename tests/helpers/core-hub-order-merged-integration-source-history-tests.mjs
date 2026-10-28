/**
 * Authenticate integration of the local Core hub-order repair history.
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
	beforeCoreHubOrderMergedIntegrationSource
	, coreHubOrderMergedIntegrationAddedPaths
	, coreHubOrderMergedIntegrationBase
	, coreHubOrderMergedIntegrationHistoryPath
	, coreHubOrderMergedIntegrationImplementation
	, coreHubOrderMergedIntegrationPaths
	, reverseCoreHubOrderMergedIntegrationUpdate
} from "./core-hub-order-merged-integration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreHubOrderMergedIntegrationHistoryPath, "utf8"));

test("local Core hub-order integration restores its exact base", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.baseCommit, coreHubOrderMergedIntegrationBase);
	assert.equal(record.implementationCommit
		, coreHubOrderMergedIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreHubOrderMergedIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreHubOrderMergedIntegrationAddedPaths);
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${coreHubOrderMergedIntegrationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${coreHubOrderMergedIntegrationBase}:${update.path}`]);
		assert.equal(reverseCoreHubOrderMergedIntegrationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCoreHubOrderMergedIntegrationSource(update.path
			, current, update.previousSha256), previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("local Core hub-order integration rejects altered content", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${coreHubOrderMergedIntegrationImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreHubOrderMergedIntegrationUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
});

test("local Core hub-order integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-hub-order-merged-integration-"));
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
		"scripts/update-core-hub-order-merged-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
