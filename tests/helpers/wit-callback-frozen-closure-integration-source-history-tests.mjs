/**
 * Authenticate central registration of the WIT callback closure repair.
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
	beforeWitCallbackFrozenClosureIntegrationSource
	, reverseWitCallbackFrozenClosureIntegrationUpdate
	, witCallbackFrozenClosureIntegrationAddedPaths
	, witCallbackFrozenClosureIntegrationBase
	, witCallbackFrozenClosureIntegrationHistoryPath
	, witCallbackFrozenClosureIntegrationImplementation
	, witCallbackFrozenClosureIntegrationPaths
} from "./wit-callback-frozen-closure-integration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	witCallbackFrozenClosureIntegrationHistoryPath, "utf8"
));

test("WIT callback closure integration records exactly hub and partition", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "wit-callback-frozen-closure-integration-v1");
	assert.equal(record.baseCommit, witCallbackFrozenClosureIntegrationBase);
	assert.equal(record.implementationCommit
		, witCallbackFrozenClosureIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path).sort()
		, [...witCallbackFrozenClosureIntegrationPaths].sort());
	for(const update of record.updates)
	{
		const previous = git(["show"
			, `${witCallbackFrozenClosureIntegrationBase}:${update.path}`]);
		const current = git(["show"
			, `${witCallbackFrozenClosureIntegrationImplementation}:${update.path}`]);
		assert.equal(reverseWitCallbackFrozenClosureIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeWitCallbackFrozenClosureIntegrationSource(
			update.path, current), previous, update.path);
		assert.equal(beforeWitCallbackFrozenClosureIntegrationSource(
			update.path, current, update.currentSha256), current, update.path);
	}
});

test("WIT callback closure integration additions restore exactly", async () => {
	const record = await readRecord();
	assert.deepEqual(record.additions.map(item => item.path)
		, witCallbackFrozenClosureIntegrationAddedPaths);
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("WIT callback closure integration rejects altered transitions", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${witCallbackFrozenClosureIntegrationImplementation}:${update.path}`]);
		assert.throws(() => reverseWitCallbackFrozenClosureIntegrationUpdate(
			current, { ...update, currentSha256: "0".repeat(64) }));
		const unknown = `${current}unknown\n`;
		assert.equal(beforeWitCallbackFrozenClosureIntegrationSource(
			update.path, unknown), unknown);
	}
});

test("WIT callback closure integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-wit-closure-integration-"));
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
		"scripts/update-wit-callback-frozen-closure-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
