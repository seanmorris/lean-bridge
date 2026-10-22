/**
 * Authenticate the complete PHP-Wasm refinement CI matrix source history.
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
	beforePhpWasmRefinementCiMatrixSource
	, phpWasmRefinementCiMatrixAddedPaths
	, phpWasmRefinementCiMatrixChangedPaths
	, phpWasmRefinementCiMatrixHistoryPath
	, phpWasmRefinementCiMatrixImplementation
	, phpWasmRefinementCiMatrixImplementationPaths
	, phpWasmRefinementCiMatrixPredecessor
	, reversePhpWasmRefinementCiMatrixUpdate
} from "./php-wasm-refinement-ci-matrix-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm refinement CI matrix history restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementCiMatrixHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-refinement-ci-matrix-v1");
	assert.equal(record.predecessorCommit, phpWasmRefinementCiMatrixPredecessor);
	assert.equal(record.implementationCommit, phpWasmRefinementCiMatrixImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementCiMatrixChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementCiMatrixAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmRefinementCiMatrixSource);
		const previous = git(["show"
			, `${phpWasmRefinementCiMatrixPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementCiMatrixUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmRefinementCiMatrixSource(update.path, current)
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

test("PHP-Wasm refinement CI matrix implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementCiMatrixImplementation}^`]).trim()
	, phpWasmRefinementCiMatrixPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementCiMatrixPredecessor
		, phpWasmRefinementCiMatrixImplementation]).trim().split("\n").sort()
	, [...phpWasmRefinementCiMatrixImplementationPaths].sort());
});

test("PHP-Wasm refinement CI matrix history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementCiMatrixHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmRefinementCiMatrixSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmRefinementCiMatrixUpdate(current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmRefinementCiMatrixUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmRefinementCiMatrixUpdate(current, unknown));
	assert.equal(beforePhpWasmRefinementCiMatrixSource(update.path
		, `${current}\n`), `${current}\n`);
});

test("PHP-Wasm refinement CI matrix writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-ci-matrix-"));
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
		"scripts/update-php-wasm-refinement-ci-matrix-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
