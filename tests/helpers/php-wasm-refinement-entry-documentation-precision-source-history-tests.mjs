/**
 * Authenticate the PHP-Wasm refinement-entry documentation precision history.
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
	beforePhpWasmRefinementEntryDocumentationPrecisionSource
	, phpWasmRefinementEntryDocumentationPrecisionAddedPaths
	, phpWasmRefinementEntryDocumentationPrecisionHistoryPath
	, phpWasmRefinementEntryDocumentationPrecisionImplementation
	, phpWasmRefinementEntryDocumentationPrecisionImplementationPaths
	, phpWasmRefinementEntryDocumentationPrecisionIntegrationPaths
	, phpWasmRefinementEntryDocumentationPrecisionPredecessor
	, reversePhpWasmRefinementEntryDocumentationPrecisionUpdate
} from "./php-wasm-refinement-entry-documentation-precision-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm entry documentation precision restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryDocumentationPrecisionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-refinement-entry-documentation-precision-v1");
	assert.equal(record.predecessorCommit
		, phpWasmRefinementEntryDocumentationPrecisionPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmRefinementEntryDocumentationPrecisionImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementEntryDocumentationPrecisionImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmRefinementEntryDocumentationPrecisionIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementEntryDocumentationPrecisionAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmRefinementEntryDocumentationPrecisionSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryDocumentationPrecisionPredecessor}:${update.path}`]);
		assert.equal(
			reversePhpWasmRefinementEntryDocumentationPrecisionUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmRefinementEntryDocumentationPrecisionSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryDocumentationPrecisionImplementation}:${update.path}`]);
		assert.equal(
			reversePhpWasmRefinementEntryDocumentationPrecisionUpdate(current, update)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm entry documentation precision range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementEntryDocumentationPrecisionImplementation}^`]).trim()
	, phpWasmRefinementEntryDocumentationPrecisionPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementEntryDocumentationPrecisionPredecessor
		, phpWasmRefinementEntryDocumentationPrecisionImplementation])
		.trim().split("\n").sort()
	, [...phpWasmRefinementEntryDocumentationPrecisionImplementationPaths].sort());
});

test("PHP-Wasm entry documentation precision rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryDocumentationPrecisionHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforePhpWasmRefinementEntryDocumentationPrecisionSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reversePhpWasmRefinementEntryDocumentationPrecisionUpdate(current, update));
});

test("PHP-Wasm entry documentation precision writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-entry-documentation-precision-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-refinement-entry-documentation-precision-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
