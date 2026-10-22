/**
 * Authenticate the PHP-Wasm hosted entry verifier closure source history.
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
	beforePhpWasmRefinementEntryHostedVerifierClosureSource
	, phpWasmRefinementEntryHostedVerifierClosureAddedPaths
	, phpWasmRefinementEntryHostedVerifierClosureChangedPaths
	, phpWasmRefinementEntryHostedVerifierClosureHistoryPath
	, phpWasmRefinementEntryHostedVerifierClosureImplementation
	, phpWasmRefinementEntryHostedVerifierClosureImplementationPaths
	, phpWasmRefinementEntryHostedVerifierClosurePredecessor
	, reversePhpWasmRefinementEntryHostedVerifierClosureUpdate
} from "./php-wasm-refinement-entry-hosted-verifier-closure-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm hosted entry verifier closure restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryHostedVerifierClosureHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-refinement-entry-hosted-verifier-closure-v1");
	assert.equal(record.predecessorCommit
		, phpWasmRefinementEntryHostedVerifierClosurePredecessor);
	assert.equal(record.implementationCommit
		, phpWasmRefinementEntryHostedVerifierClosureImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementEntryHostedVerifierClosureChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementEntryHostedVerifierClosureAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmRefinementEntryHostedVerifierClosureSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryHostedVerifierClosurePredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementEntryHostedVerifierClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforePhpWasmRefinementEntryHostedVerifierClosureSource(
			update.path, current), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm hosted entry verifier closure implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementEntryHostedVerifierClosureImplementation}^`]).trim()
	, phpWasmRefinementEntryHostedVerifierClosurePredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementEntryHostedVerifierClosurePredecessor
		, phpWasmRefinementEntryHostedVerifierClosureImplementation])
		.trim().split("\n").sort()
	, [...phpWasmRefinementEntryHostedVerifierClosureImplementationPaths].sort());
});

test("PHP-Wasm hosted entry verifier closure rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryHostedVerifierClosureHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforePhpWasmRefinementEntryHostedVerifierClosureSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmRefinementEntryHostedVerifierClosureUpdate(
		current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmRefinementEntryHostedVerifierClosureUpdate(
		current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmRefinementEntryHostedVerifierClosureUpdate(
		current, unknown));
	assert.equal(beforePhpWasmRefinementEntryHostedVerifierClosureSource(
		update.path, `${current}\n`), `${current}\n`);
});

test("PHP-Wasm hosted verifier history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-hosted-verifier-"));
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
		"scripts/update-php-wasm-refinement-entry-hosted-verifier-closure-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
