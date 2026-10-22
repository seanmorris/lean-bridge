/**
 * Authenticate installed PHP-Wasm graph-entry measurement source history.
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
	beforePhpWasmRefinementEntryInstalledSource
	, phpWasmRefinementEntryInstalledAddedPaths
	, phpWasmRefinementEntryInstalledChangedPaths
	, phpWasmRefinementEntryInstalledHistoryPath
	, phpWasmRefinementEntryInstalledImplementation
	, phpWasmRefinementEntryInstalledImplementationPaths
	, phpWasmRefinementEntryInstalledPredecessor
	, reversePhpWasmRefinementEntryInstalledUpdate
} from "./php-wasm-refinement-entry-installed-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("installed graph-entry history restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryInstalledHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-refinement-entry-installed-v1");
	assert.equal(record.predecessorCommit, phpWasmRefinementEntryInstalledPredecessor);
	assert.equal(record.implementationCommit, phpWasmRefinementEntryInstalledImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementEntryInstalledChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementEntryInstalledAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmRefinementEntryInstalledSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryInstalledPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementEntryInstalledUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmRefinementEntryInstalledSource(update.path, current)
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

test("installed graph-entry implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementEntryInstalledImplementation}^`]).trim()
	, phpWasmRefinementEntryInstalledPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementEntryInstalledPredecessor
		, phpWasmRefinementEntryInstalledImplementation]).trim().split("\n").sort()
	, [...phpWasmRefinementEntryInstalledImplementationPaths].sort());
});

test("installed graph-entry history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryInstalledHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmRefinementEntryInstalledSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmRefinementEntryInstalledUpdate(current, update));
	const edited = structuredClone(record.updates[0]); edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmRefinementEntryInstalledUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]); unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmRefinementEntryInstalledUpdate(current, unknown));
	assert.equal(beforePhpWasmRefinementEntryInstalledSource(update.path, `${current}\n`)
		, `${current}\n`);
});

test("installed graph-entry history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-entry-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-refinement-entry-installed-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
