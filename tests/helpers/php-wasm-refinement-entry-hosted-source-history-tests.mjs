/**
 * Authenticate the hosted PHP-Wasm entry artifact verifier source history.
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
	beforePhpWasmRefinementEntryHostedSource
	, phpWasmRefinementEntryHostedAddedPaths
	, phpWasmRefinementEntryHostedChangedPaths
	, phpWasmRefinementEntryHostedHistoryPath
	, phpWasmRefinementEntryHostedImplementation
	, phpWasmRefinementEntryHostedImplementationPaths
	, phpWasmRefinementEntryHostedPredecessor
	, reversePhpWasmRefinementEntryHostedUpdate
} from "./php-wasm-refinement-entry-hosted-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("hosted PHP-Wasm refinement entry verifier history restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryHostedHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-refinement-entry-hosted-verifier-v1");
	assert.equal(record.predecessorCommit, phpWasmRefinementEntryHostedPredecessor);
	assert.equal(record.implementationCommit, phpWasmRefinementEntryHostedImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementEntryHostedChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementEntryHostedAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmRefinementEntryHostedSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryHostedPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementEntryHostedUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmRefinementEntryHostedSource(update.path, current)
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

test("hosted PHP-Wasm refinement entry verifier implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementEntryHostedImplementation}^`]).trim()
	, phpWasmRefinementEntryHostedPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementEntryHostedPredecessor
		, phpWasmRefinementEntryHostedImplementation]).trim().split("\n").sort()
	, [...phpWasmRefinementEntryHostedImplementationPaths].sort());
});

test("hosted PHP-Wasm refinement entry verifier history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryHostedHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmRefinementEntryHostedSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmRefinementEntryHostedUpdate(current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmRefinementEntryHostedUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmRefinementEntryHostedUpdate(current, unknown));
	assert.equal(beforePhpWasmRefinementEntryHostedSource(update.path
		, `${current}\n`), `${current}\n`);
});

test("hosted PHP-Wasm refinement entry verifier writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-entry-hosted-"));
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
		"scripts/update-php-wasm-refinement-entry-hosted-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
