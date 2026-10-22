/**
 * Authenticate the omitted owned-Subtype PHP-Wasm package transition.
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
	beforeOwnedSubtypePhpWasmPackageGapSource
	, ownedSubtypePhpWasmPackageGapAddedPaths
	, ownedSubtypePhpWasmPackageGapHistoricalAdditions
	, ownedSubtypePhpWasmPackageGapHistoricalPaths
	, ownedSubtypePhpWasmPackageGapHistoryPath
	, ownedSubtypePhpWasmPackageGapImplementation
	, ownedSubtypePhpWasmPackageGapIntegrationPaths
	, ownedSubtypePhpWasmPackageGapIntegrationPredecessor
	, ownedSubtypePhpWasmPackageGapPredecessor
	, reverseOwnedSubtypePhpWasmPackageGapHistorical
	, reverseOwnedSubtypePhpWasmPackageGapIntegration
} from "./owned-subtype-php-wasm-package-gap-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned-Subtype PHP-Wasm package gap restores exact Git states", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypePhpWasmPackageGapHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-php-wasm-package-gap-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypePhpWasmPackageGapPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypePhpWasmPackageGapImplementation);
	assert.equal(record.integrationPredecessorCommit
		, ownedSubtypePhpWasmPackageGapIntegrationPredecessor);
	assert.deepEqual(record.historicalUpdates.map(item => item.path)
		, ownedSubtypePhpWasmPackageGapHistoricalPaths);
	assert.deepEqual(record.historicalAdditions.map(item => item.path)
		, ownedSubtypePhpWasmPackageGapHistoricalAdditions);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypePhpWasmPackageGapIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypePhpWasmPackageGapAddedPaths);
	for(const update of record.historicalUpdates)
	{
		const previous = git(["show"
			, `${ownedSubtypePhpWasmPackageGapPredecessor}:${update.path}`]);
		const current = git(["show"
			, `${ownedSubtypePhpWasmPackageGapImplementation}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseOwnedSubtypePhpWasmPackageGapHistorical(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path
			, git(["show", `HEAD:${update.path}`]), update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.historicalAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypePhpWasmPackageGapPredecessor
			, "--", addition.path]).trim(), "");
		assert.equal(sha256(git(["show"
			, `${ownedSubtypePhpWasmPackageGapImplementation}:${addition.path}`]))
		, addition.currentSha256, addition.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedSubtypePhpWasmPackageGapSource);
		assert.equal(reverseOwnedSubtypePhpWasmPackageGapIntegration(current, update)
			, git(["show"
				, `${ownedSubtypePhpWasmPackageGapIntegrationPredecessor}:${update.path}`])
			, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("owned-Subtype PHP-Wasm package gap rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypePhpWasmPackageGapHistoryPath, "utf8"));
	const update = structuredClone(record.historicalUpdates[0]);
	const current = git(["show"
		, `${ownedSubtypePhpWasmPackageGapImplementation}:${update.path}`]);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypePhpWasmPackageGapHistorical(
		current, update));
	const edited = structuredClone(record.historicalUpdates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reverseOwnedSubtypePhpWasmPackageGapHistorical(
		current, edited));
	const unknown = `${current}\nunknown`;
	assert.equal(beforeOwnedSubtypePhpWasmPackageGapSource(
		record.historicalUpdates[0].path, unknown), unknown);
});

test("owned-Subtype PHP-Wasm package-gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-subtype-php-wasm-package-gap-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-php-wasm-package-gap-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
