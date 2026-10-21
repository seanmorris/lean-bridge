/**
 * Authenticate the generic-Subtype Python/Ruby/Rust transition.
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
	beforeGenericSubtypeLanguageSource
	, genericSubtypeLanguageChangedPaths
	, genericSubtypeLanguageHistoryPath
	, genericSubtypeLanguageImplementation
	, genericSubtypeLanguageImplementationAdditions
	, genericSubtypeLanguageIntegrationPaths
	, genericSubtypeLanguagePredecessor
	, reverseGenericSubtypeLanguageUpdate
} from "./generic-subtype-language-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("generic Subtype language history restores every source", async () => {
	const record = JSON.parse(await readFile(genericSubtypeLanguageHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "generic-subtype-language-source-v1");
	assert.equal(record.predecessorCommit, genericSubtypeLanguagePredecessor);
	assert.equal(record.implementationCommit, genericSubtypeLanguageImplementation);
	assert.deepEqual(record.updates.map(item => item.path), genericSubtypeLanguageChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path), genericSubtypeLanguageIntegrationPaths);
	assert.deepEqual(record.additions.slice(0, genericSubtypeLanguageImplementationAdditions.length)
		.map(item => item.path), genericSubtypeLanguageImplementationAdditions);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
			, beforeGenericSubtypeLanguageSource);
		const previous = reverseGenericSubtypeLanguageUpdate(current, update);
		assert.equal(previous, sourceAt(genericSubtypeLanguagePredecessor, update.path));
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
			, beforeGenericSubtypeLanguageSource);
		assert.equal(reverseGenericSubtypeLanguageUpdate(current, update)
			, sourceAt(genericSubtypeLanguageImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
});

test("generic Subtype language history rejects alteration", async () => {
	const record = JSON.parse(await readFile(genericSubtypeLanguageHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256
		, beforeGenericSubtypeLanguageSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseGenericSubtypeLanguageUpdate(current, update));
});

test("generic Subtype language history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-language-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-generic-subtype-language-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
