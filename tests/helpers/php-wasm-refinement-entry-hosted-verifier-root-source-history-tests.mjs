/**
 * Authenticate the PHP-Wasm hosted entry verifier repository-root closure source history.
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
	beforePhpWasmRefinementEntryHostedVerifierRootSource
	, phpWasmRefinementEntryHostedVerifierRootAddedPaths
	, phpWasmRefinementEntryHostedVerifierRootChangedPaths
	, phpWasmRefinementEntryHostedVerifierRootHistoryPath
	, phpWasmRefinementEntryHostedVerifierRootImplementation
	, phpWasmRefinementEntryHostedVerifierRootImplementationPaths
	, phpWasmRefinementEntryHostedVerifierRootPredecessor
	, reversePhpWasmRefinementEntryHostedVerifierRootUpdate
} from "./php-wasm-refinement-entry-hosted-verifier-root-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm hosted entry verifier repository-root closure restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryHostedVerifierRootHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-refinement-entry-hosted-verifier-root-v1");
	assert.equal(record.predecessorCommit
		, phpWasmRefinementEntryHostedVerifierRootPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmRefinementEntryHostedVerifierRootImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementEntryHostedVerifierRootChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementEntryHostedVerifierRootAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmRefinementEntryHostedVerifierRootSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryHostedVerifierRootPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementEntryHostedVerifierRootUpdate(
			current, update), previous, update.path);
		assert.equal(beforePhpWasmRefinementEntryHostedVerifierRootSource(
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

test("PHP-Wasm hosted entry verifier repository-root closure implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementEntryHostedVerifierRootImplementation}^`]).trim()
	, phpWasmRefinementEntryHostedVerifierRootPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementEntryHostedVerifierRootPredecessor
		, phpWasmRefinementEntryHostedVerifierRootImplementation])
		.trim().split("\n").sort()
	, [...phpWasmRefinementEntryHostedVerifierRootImplementationPaths].sort());
});

test("PHP-Wasm hosted entry verifier repository-root closure rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryHostedVerifierRootHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforePhpWasmRefinementEntryHostedVerifierRootSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmRefinementEntryHostedVerifierRootUpdate(
		current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmRefinementEntryHostedVerifierRootUpdate(
		current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmRefinementEntryHostedVerifierRootUpdate(
		current, unknown));
	assert.equal(beforePhpWasmRefinementEntryHostedVerifierRootSource(
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
		"scripts/update-php-wasm-refinement-entry-hosted-verifier-root-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
