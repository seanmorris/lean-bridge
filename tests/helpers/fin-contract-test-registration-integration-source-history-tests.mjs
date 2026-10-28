/**
 * Authenticate central integration of the final Fin contract-test history.
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
	beforeFinContractTestRegistrationIntegrationSource
	, finContractTestRegistrationIntegrationAddedPaths
	, finContractTestRegistrationIntegrationBase
	, finContractTestRegistrationIntegrationHistoryPath
	, finContractTestRegistrationIntegrationImplementation
	, finContractTestRegistrationIntegrationPaths
	, reverseFinContractTestRegistrationIntegrationUpdate
} from "./fin-contract-test-registration-integration-source-history.mjs";
import {
	finContractTestRegistrationHistoryPath
} from "./fin-contract-test-registration-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	finContractTestRegistrationIntegrationHistoryPath, "utf8"
));

test("final Fin test-registration integration restores its exact hub and partition", async () => {
	const record = await readRecord();
	assert.deepEqual(Object.keys(record).sort(), ["additions", "baseCommit"
		, "baseHistory", "implementationCommit", "milestone"
		, "schemaVersion", "scope", "updates"].sort());
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "fin-contract-test-registration-integration-v1");
	assert.equal(record.baseCommit
		, finContractTestRegistrationIntegrationBase);
	assert.equal(record.implementationCommit
		, finContractTestRegistrationIntegrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, finContractTestRegistrationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, finContractTestRegistrationIntegrationAddedPaths);
	assert.deepEqual(record.baseHistory, {
		path: finContractTestRegistrationHistoryPath
		, sha256: sha256(await readFile(finContractTestRegistrationHistoryPath))
	});
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeFinContractTestRegistrationIntegrationSource);
		const previous = git(["show"
			, `${finContractTestRegistrationIntegrationBase}:${update.path}`]);
		assert.equal(reverseFinContractTestRegistrationIntegrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.equal(beforeFinContractTestRegistrationIntegrationSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
});

test("final Fin test-registration integration additions restore exactly", async () => {
	for(const addition of (await readRecord()).additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("final Fin test-registration integration rejects alteration", async () => {
	const update = (await readRecord()).updates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeFinContractTestRegistrationIntegrationSource);
	assert.throws(() => reverseFinContractTestRegistrationIntegrationUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeFinContractTestRegistrationIntegrationSource(
		update.path, `${current}unknown\n`), `${current}unknown\n`);
});

test("final Fin test-registration integration writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-fin-contract-test-registration-integration-"));
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
		"scripts/update-fin-contract-test-registration-integration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
