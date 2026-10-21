/**
 * Authenticate generic-Subtype host-suite test registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeGenericSubtypeTestRegistrationSource
	, genericSubtypeTestRegistrationAddedTests
	, genericSubtypeTestRegistrationChangedPaths
	, genericSubtypeTestRegistrationHistoryPath
	, genericSubtypeTestRegistrationImplementation
	, genericSubtypeTestRegistrationIntegrationPaths
	, genericSubtypeTestRegistrationPredecessor
	, reverseGenericSubtypeTestRegistrationUpdate
} from "./generic-subtype-test-registration-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("generic Subtype host-suite registration restores every source", async () => {
	const record = JSON.parse(await readFile(genericSubtypeTestRegistrationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "generic-subtype-test-registration-source-v1");
	assert.equal(record.predecessorCommit, genericSubtypeTestRegistrationPredecessor);
	assert.equal(record.implementationCommit, genericSubtypeTestRegistrationImplementation);
	assert.deepEqual(record.addedTests, genericSubtypeTestRegistrationAddedTests);
	assert.equal(record.pinCount, 94);
	assert.deepEqual(record.updates.map(item => item.path), genericSubtypeTestRegistrationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path), genericSubtypeTestRegistrationIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
			, beforeGenericSubtypeTestRegistrationSource);
		const previous = reverseGenericSubtypeTestRegistrationUpdate(current, update);
		assert.equal(previous, sourceAt(genericSubtypeTestRegistrationPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
			, beforeGenericSubtypeTestRegistrationSource);
		assert.equal(reverseGenericSubtypeTestRegistrationUpdate(current, update)
			, sourceAt(genericSubtypeTestRegistrationImplementation, update.path));
	}
});

test("generic Subtype host-suite registration rejects alteration", async () => {
	const record = JSON.parse(await readFile(genericSubtypeTestRegistrationHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
		, beforeGenericSubtypeTestRegistrationSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseGenericSubtypeTestRegistrationUpdate(current, update));
});

test("generic Subtype host-suite registration writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-registration-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-generic-subtype-test-registration-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
