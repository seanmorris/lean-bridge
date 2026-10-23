/**
 * Authenticate the callback-refinement PHP-Wasm hosted archive history.
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
	beforeCallbackRefinementsPhpWasmHostedArchiveSource
	, callbackRefinementsPhpWasmHostedArchiveCommit
	, callbackRefinementsPhpWasmHostedArchiveFileCount
	, callbackRefinementsPhpWasmHostedArchiveFoundation
	, callbackRefinementsPhpWasmHostedArchiveFoundationAddedPaths
	, callbackRefinementsPhpWasmHostedArchiveFoundationUpdatedPaths
	, callbackRefinementsPhpWasmHostedArchiveHistoryPath
	, callbackRefinementsPhpWasmHostedArchiveIndexSha256
	, callbackRefinementsPhpWasmHostedArchiveIndexedFileCount
	, callbackRefinementsPhpWasmHostedArchiveIntegrationPaths
	, callbackRefinementsPhpWasmHostedArchivePredecessor
	, callbackRefinementsPhpWasmHostedArchiveRoot
	, callbackRefinementsPhpWasmHostedArchiveVerifier
	, callbackRefinementsPhpWasmHostedArchiveVerifierAddedPaths
	, callbackRefinementsPhpWasmHostedArchiveVerifierUpdatedPaths
	, reverseCallbackRefinementsPhpWasmHostedArchiveFoundation
	, reverseCallbackRefinementsPhpWasmHostedArchiveIntegration
	, reverseCallbackRefinementsPhpWasmHostedArchiveVerifier
} from "./callback-refinements-php-wasm-hosted-archive-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
}).trim().split("\n").filter(Boolean).sort();

test("callback-refinement PHP-Wasm archive history closes the exact tree"
	, async () => {
		const record = JSON.parse(await readFile(
			callbackRefinementsPhpWasmHostedArchiveHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "callback-refinements-php-wasm-hosted-archive-v1");
		assert.equal(record.predecessorCommit
			, callbackRefinementsPhpWasmHostedArchivePredecessor);
		assert.equal(record.foundationCommit
			, callbackRefinementsPhpWasmHostedArchiveFoundation);
		assert.equal(record.archiveCommit
			, callbackRefinementsPhpWasmHostedArchiveCommit);
		assert.equal(record.verifierCommit
			, callbackRefinementsPhpWasmHostedArchiveVerifier);
		assert.deepEqual(record.foundationUpdates.map(item => item.path)
			, callbackRefinementsPhpWasmHostedArchiveFoundationUpdatedPaths);
		assert.deepEqual(record.verifierUpdates.map(item => item.path)
			, callbackRefinementsPhpWasmHostedArchiveVerifierUpdatedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, callbackRefinementsPhpWasmHostedArchiveIntegrationPaths);
		assert.deepEqual(record.archive, {
			root: callbackRefinementsPhpWasmHostedArchiveRoot
			, indexSha256: callbackRefinementsPhpWasmHostedArchiveIndexSha256
			, indexedFileCount:
				callbackRefinementsPhpWasmHostedArchiveIndexedFileCount
			, archiveFileCount:
				callbackRefinementsPhpWasmHostedArchiveFileCount
		});
		const archivePaths = names(["ls-tree", "-r", "--name-only"
			, callbackRefinementsPhpWasmHostedArchiveCommit, "--"
			, callbackRefinementsPhpWasmHostedArchiveRoot]);
		assert.equal(archivePaths.length
			, callbackRefinementsPhpWasmHostedArchiveFileCount);
		const indexBytes = sourceAt(
			callbackRefinementsPhpWasmHostedArchiveCommit
			, `${callbackRefinementsPhpWasmHostedArchiveRoot}/index.json`);
		assert.equal(sha256(indexBytes)
			, callbackRefinementsPhpWasmHostedArchiveIndexSha256);
		const index = JSON.parse(indexBytes);
		assert.equal(index.files.length
			, callbackRefinementsPhpWasmHostedArchiveIndexedFileCount);
		assert.deepEqual(archivePaths, [
			`${callbackRefinementsPhpWasmHostedArchiveRoot}/index.json`
			, ...index.files.map(file =>
				`${callbackRefinementsPhpWasmHostedArchiveRoot}/${file.path}`)
		].sort());
		for(const update of record.foundationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeCallbackRefinementsPhpWasmHostedArchiveSource);
			const previous = reverseCallbackRefinementsPhpWasmHostedArchiveFoundation(
				current, update);
			assert.equal(previous, sourceAt(
				callbackRefinementsPhpWasmHostedArchivePredecessor, update.path));
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous);
		}
		for(const update of record.verifierUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeCallbackRefinementsPhpWasmHostedArchiveSource);
			assert.equal(reverseCallbackRefinementsPhpWasmHostedArchiveVerifier(
				current, update), sourceAt(
				callbackRefinementsPhpWasmHostedArchiveCommit, update.path));
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeCallbackRefinementsPhpWasmHostedArchiveSource);
			assert.equal(reverseCallbackRefinementsPhpWasmHostedArchiveIntegration(
				current, update), sourceAt(
				callbackRefinementsPhpWasmHostedArchiveVerifier, update.path));
		}
		const additionPaths = record.additions.map(item => item.path);
		for(const path of [
			...callbackRefinementsPhpWasmHostedArchiveFoundationAddedPaths
			, ...callbackRefinementsPhpWasmHostedArchiveVerifierAddedPaths
		]) assert.ok(additionPaths.includes(path));
		for(const addition of record.additions)
		{
			const source = await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256);
			assert.equal(sha256(source), addition.currentSha256, addition.path);
		}
	}
);

test("callback-refinement PHP-Wasm archive history rejects alteration"
	, async () => {
		const record = JSON.parse(await readFile(
			callbackRefinementsPhpWasmHostedArchiveHistoryPath, "utf8"));
		const update = structuredClone(record.verifierUpdates[0]);
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackRefinementsPhpWasmHostedArchiveSource);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() =>
			reverseCallbackRefinementsPhpWasmHostedArchiveVerifier(
				current, update));
		update.currentSha256 = sha256(current);
		update.path = "src/not-recorded.mjs";
		assert.throws(() =>
			reverseCallbackRefinementsPhpWasmHostedArchiveVerifier(
				current, update));
	}
);

test("callback-refinement PHP-Wasm archive history writer rejects other repos"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-callback-refinements-archive-history-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const environment = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const git = arguments_ => execFileSync("git", arguments_, {
			cwd: root, env: environment, stdio: "pipe"
		});
		git(["init", "--quiet"]);
		git(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c"
			, "commit.gpgsign=false", "commit", "--allow-empty"
			, "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-callback-refinements-php-wasm-hosted-archive-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /verifier commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
