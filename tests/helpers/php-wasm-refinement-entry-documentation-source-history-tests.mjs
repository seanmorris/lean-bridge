/**
 * Authenticate PHP-Wasm refinement-entry documentation boundary source history.
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
	beforePhpWasmRefinementEntryDocumentationSource
	, phpWasmRefinementEntryDocumentationAddedPaths
	, phpWasmRefinementEntryDocumentationChangedPaths
	, phpWasmRefinementEntryDocumentationHistoryPath
	, phpWasmRefinementEntryDocumentationImplementation
	, phpWasmRefinementEntryDocumentationImplementationPaths
	, phpWasmRefinementEntryDocumentationPredecessor
	, reversePhpWasmRefinementEntryDocumentationUpdate
} from "./php-wasm-refinement-entry-documentation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm entry documentation boundary restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryDocumentationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-refinement-entry-documentation-v1");
	assert.equal(record.predecessorCommit
		, phpWasmRefinementEntryDocumentationPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmRefinementEntryDocumentationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementEntryDocumentationChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementEntryDocumentationAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmRefinementEntryDocumentationSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryDocumentationPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementEntryDocumentationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmRefinementEntryDocumentationSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm entry documentation boundary implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementEntryDocumentationImplementation}^`]).trim()
	, phpWasmRefinementEntryDocumentationPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementEntryDocumentationPredecessor
		, phpWasmRefinementEntryDocumentationImplementation]).trim().split("\n").sort()
	, [...phpWasmRefinementEntryDocumentationImplementationPaths].sort());
});

test("PHP-Wasm entry documentation boundary history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryDocumentationHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmRefinementEntryDocumentationSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmRefinementEntryDocumentationUpdate(current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmRefinementEntryDocumentationUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmRefinementEntryDocumentationUpdate(current, unknown));
	assert.equal(beforePhpWasmRefinementEntryDocumentationSource(update.path
		, `${current}\n`), `${current}\n`);
});

test("PHP-Wasm entry documentation boundary writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-entry-documentation-"));
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
		"scripts/update-php-wasm-refinement-entry-documentation-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
