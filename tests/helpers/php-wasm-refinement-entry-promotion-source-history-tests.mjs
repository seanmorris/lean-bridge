/**
 * Authenticate recurring PHP-Wasm refinement-entry promotion source history.
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
	beforePhpWasmRefinementEntryPromotionSource
	, phpWasmRefinementEntryPromotionAddedPaths
	, phpWasmRefinementEntryPromotionChangedPaths
	, phpWasmRefinementEntryPromotionHistoryPath
	, phpWasmRefinementEntryPromotionImplementation
	, phpWasmRefinementEntryPromotionImplementationPaths
	, phpWasmRefinementEntryPromotionPredecessor
	, reversePhpWasmRefinementEntryPromotionUpdate
} from "./php-wasm-refinement-entry-promotion-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("recurring PHP-Wasm entry promotion restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryPromotionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-refinement-entry-promotion-v1");
	assert.equal(record.predecessorCommit
		, phpWasmRefinementEntryPromotionPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmRefinementEntryPromotionImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementEntryPromotionChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementEntryPromotionAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmRefinementEntryPromotionSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryPromotionPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementEntryPromotionUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmRefinementEntryPromotionSource(update.path, current)
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

test("recurring PHP-Wasm entry promotion implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementEntryPromotionImplementation}^`]).trim()
	, phpWasmRefinementEntryPromotionPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementEntryPromotionPredecessor
		, phpWasmRefinementEntryPromotionImplementation]).trim().split("\n").sort()
	, [...phpWasmRefinementEntryPromotionImplementationPaths].sort());
});

test("recurring PHP-Wasm entry promotion history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryPromotionHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmRefinementEntryPromotionSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmRefinementEntryPromotionUpdate(current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmRefinementEntryPromotionUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmRefinementEntryPromotionUpdate(current, unknown));
	assert.equal(beforePhpWasmRefinementEntryPromotionSource(update.path
		, `${current}\n`), `${current}\n`);
});

test("recurring PHP-Wasm entry promotion writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-entry-promotion-"));
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
		"scripts/update-php-wasm-refinement-entry-promotion-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
