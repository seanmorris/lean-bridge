/**
 * Authenticate the generic-Subtype .NET/JVM/PHP/WIT transition.
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
	beforeGenericSubtypeManagedWitSource
	, genericSubtypeManagedWitChangedPaths
	, genericSubtypeManagedWitHistoryPath
	, genericSubtypeManagedWitImplementation
	, genericSubtypeManagedWitImplementationAdditions
	, genericSubtypeManagedWitIntegrationPaths
	, genericSubtypeManagedWitPredecessor
	, reverseGenericSubtypeManagedWitUpdate
} from "./generic-subtype-managed-wit-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("generic Subtype managed/WIT history restores every source", async () => {
	const record = JSON.parse(await readFile(genericSubtypeManagedWitHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "generic-subtype-managed-wit-source-v1");
	assert.equal(record.predecessorCommit, genericSubtypeManagedWitPredecessor);
	assert.equal(record.implementationCommit, genericSubtypeManagedWitImplementation);
	assert.deepEqual(record.updates.map(item => item.path), genericSubtypeManagedWitChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path), genericSubtypeManagedWitIntegrationPaths);
	assert.deepEqual(record.additions.slice(0, genericSubtypeManagedWitImplementationAdditions.length)
		.map(item => item.path), genericSubtypeManagedWitImplementationAdditions);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
			, beforeGenericSubtypeManagedWitSource);
		const previous = reverseGenericSubtypeManagedWitUpdate(current, update);
		assert.equal(previous, sourceAt(genericSubtypeManagedWitPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
			, beforeGenericSubtypeManagedWitSource);
		assert.equal(reverseGenericSubtypeManagedWitUpdate(current, update)
			, sourceAt(genericSubtypeManagedWitImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("generic Subtype managed/WIT history rejects alteration", async () => {
	const record = JSON.parse(await readFile(genericSubtypeManagedWitHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
		, beforeGenericSubtypeManagedWitSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseGenericSubtypeManagedWitUpdate(current, update));
});

test("generic Subtype managed/WIT history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-managed-wit-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-generic-subtype-managed-wit-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
