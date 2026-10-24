/**
 * Authenticate the explicit PHP-Wasm callback Subtype entry coverage.
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
	beforePhpWasmCallbackSubtypeEntrySource
	, phpWasmCallbackSubtypeEntryAddedPaths
	, phpWasmCallbackSubtypeEntryChangedPaths
	, phpWasmCallbackSubtypeEntryHistoryPath
	, phpWasmCallbackSubtypeEntryImplementation
	, phpWasmCallbackSubtypeEntryImplementationAdditions
	, phpWasmCallbackSubtypeEntryIntegrationBase
	, phpWasmCallbackSubtypeEntryIntegrationPaths
	, phpWasmCallbackSubtypeEntryPredecessor
	, reversePhpWasmCallbackSubtypeEntryUpdate
} from "./php-wasm-callback-subtype-entry-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm callback Subtype entry coverage restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmCallbackSubtypeEntryHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-callback-subtype-entry-source-v1");
	assert.equal(record.predecessorCommit
		, phpWasmCallbackSubtypeEntryPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmCallbackSubtypeEntryImplementation);
	assert.equal(record.integrationBaseCommit
		, phpWasmCallbackSubtypeEntryIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmCallbackSubtypeEntryChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmCallbackSubtypeEntryIntegrationPaths);
	assert.deepEqual(record.implementationAdditions.map(item => item.path)
		, phpWasmCallbackSubtypeEntryImplementationAdditions);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmCallbackSubtypeEntryAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmCallbackSubtypeEntrySource);
		const previous = git(["show"
			, `${phpWasmCallbackSubtypeEntryPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackSubtypeEntryUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmCallbackSubtypeEntrySource);
		const previous = git(["show"
			, `${phpWasmCallbackSubtypeEntryIntegrationBase}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackSubtypeEntryUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.implementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, phpWasmCallbackSubtypeEntryPredecessor, "--", addition.path]).trim(), "");
		const original = git(["show", `${phpWasmCallbackSubtypeEntryImplementation}:${addition.path}`]);
		assert.equal(sha256(original), addition.currentSha256, addition.path);
		assert.equal(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256)
			, original, addition.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm callback Subtype entry coverage is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmCallbackSubtypeEntryImplementation}^`]).trim()
	, phpWasmCallbackSubtypeEntryPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmCallbackSubtypeEntryPredecessor
		, phpWasmCallbackSubtypeEntryImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...phpWasmCallbackSubtypeEntryChangedPaths
		, ...phpWasmCallbackSubtypeEntryImplementationAdditions].sort());
});

test("PHP-Wasm callback Subtype entry coverage rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		phpWasmCallbackSubtypeEntryHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforePhpWasmCallbackSubtypeEntrySource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmCallbackSubtypeEntryUpdate(
		current, update));
});

test("PHP-Wasm callback Subtype entry writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-callback-subtype-entry-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-callback-subtype-entry-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});

test("callback Subtype inventory changes only current source pins and topology scope", async () => {
	const record = JSON.parse(await readFile(phpWasmCallbackSubtypeEntryHistoryPath, "utf8"));
	const update = record.integrationUpdates.find(item => item.path === "docs/type-surface.v1.json");
	assert.ok(update);
	const pins = [
		{
			"path": "docs/php.md"
			, "previousSha256": "5defddea3ef8c9b3697d37217a7ffdca83c8114245cc6100410e14b274be32a3"
			, "currentSha256": "0ae02f0ef9e568e5bdf469de62b17c0f675333b1c7ea50d86e46d04a21ca0b77"
			, "count": 6
		}
		, {
			"path": "docs/lean/existing-package.md"
			, "previousSha256": "36c2c9b3310496053c208332ead5abd8b486f4c463f9b4d158a733f2aad9e019"
			, "currentSha256": "e54176cef7f70ca437b55c82f54746f30a82af648e5ab3c56adf8014a153f3c5"
			, "count": 18
		}
		, {
			"path": "docs/publish/php.md"
			, "previousSha256": "80cb4f58343d8414fdb8b7aeb1edd69c325df0cd68a89025d68aea76f1f2579c"
			, "currentSha256": "abfe3b5f9567dd722a2a4bea61efb7526f5c23283c43d9de558aed026ffe9fb2"
			, "count": 5
		}
		, {
			"path": ".github/workflows/php-wasm-refinement-entry-promotion.yml"
			, "previousSha256": "e3921d7f1dde5b9056e15da772b7b8afd0e3d0ec93b82d94a667b46b7145dcc8"
			, "currentSha256": "6ed959da50824a3c2d8465a255710bf52ae267fde2487df025d11a6dd43a0167"
			, "count": 1
		}
		, {
			"path": "tests/helpers/php-wasm-refinement-entry-matrix.mjs"
			, "previousSha256": "feb9a25749a40c63f5e79d716039d26e7bf439f9b17a659ff56aa0a2583599ab"
			, "currentSha256": "82574a7d1c976d90bb65300665d2f42c67695f4dc783101b0f05cf22f5893f71"
			, "count": 1
		}
		, {
			"path": "tests/helpers/php-wasm-refinement-entry-promotion-ci.mjs"
			, "previousSha256": "eeb2eaf1f5b5caffea67bfa83a7f03c0b9ec906ca0f058f171755ace62b5cbeb"
			, "currentSha256": "68d01f9fb2aad641fe92b426b7f86f2c1183dd0199ce6d75e0150afc8f91de3c"
			, "count": 1
		}
	];
	const remaining = new Map(pins.map(pin => [pin.previousSha256, pin.count]));
	let scopes = 0;
	for(const edit of update.edits)
	{
		const previous = edit.previous.trimEnd().split("\n");
		const current = edit.current.trimEnd().split("\n");
		assert.equal(previous.length, current.length);
		for(const [index, line] of previous.entries())
		{
			if(line.trimStart().startsWith('"scope":'))
			{
				assert.equal(current[index], line.replace(
					"28 ordinary/reviewed routes in 26 retained artifacts",
					"30 ordinary/reviewed routes in 27 retained artifacts"));
				assert.notEqual(current[index], line);
				scopes++;
				continue;
			}
			const pin = pins.find(item => line.trim() === `"sha256": "${item.previousSha256}"`);
			assert.ok(pin, line);
			assert.equal(current[index], line.replace(pin.previousSha256, pin.currentSha256));
			remaining.set(pin.previousSha256, remaining.get(pin.previousSha256) - 1);
		}
	}
	assert.equal(scopes, 1);
	assert.ok([...remaining.values()].every(count => count === 0));
	for(const pin of pins)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(pin.path, pin.currentSha256)), pin.currentSha256);
});
