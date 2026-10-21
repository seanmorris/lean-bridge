/**
 * Authenticate the generic-Subtype native/Perl transition.
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
	beforeGenericSubtypeNativePerlSource
	, genericSubtypeNativePerlChangedPaths
	, genericSubtypeNativePerlHistoryPath
	, genericSubtypeNativePerlImplementation
	, genericSubtypeNativePerlImplementationAdditions
	, genericSubtypeNativePerlIntegrationPaths
	, genericSubtypeNativePerlPredecessor
	, reverseGenericSubtypeNativePerlUpdate
} from "./generic-subtype-native-perl-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("generic Subtype native/Perl history restores every source", async () => {
	const record = JSON.parse(await readFile(genericSubtypeNativePerlHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "generic-subtype-native-perl-source-v1");
	assert.equal(record.predecessorCommit, genericSubtypeNativePerlPredecessor);
	assert.equal(record.implementationCommit, genericSubtypeNativePerlImplementation);
	assert.deepEqual(record.updates.map(item => item.path), genericSubtypeNativePerlChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path), genericSubtypeNativePerlIntegrationPaths);
	assert.deepEqual(record.additions.slice(0, genericSubtypeNativePerlImplementationAdditions.length)
		.map(item => item.path), genericSubtypeNativePerlImplementationAdditions);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
			, beforeGenericSubtypeNativePerlSource);
		const previous = reverseGenericSubtypeNativePerlUpdate(current, update);
		assert.equal(previous, sourceAt(genericSubtypeNativePerlPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
			, beforeGenericSubtypeNativePerlSource);
		assert.equal(reverseGenericSubtypeNativePerlUpdate(current, update)
			, sourceAt(genericSubtypeNativePerlImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("generic Subtype native/Perl history rejects alteration", async () => {
	const record = JSON.parse(await readFile(genericSubtypeNativePerlHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
		, beforeGenericSubtypeNativePerlSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseGenericSubtypeNativePerlUpdate(current, update));
});

test("generic Subtype native/Perl history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-native-perl-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-generic-subtype-native-perl-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
