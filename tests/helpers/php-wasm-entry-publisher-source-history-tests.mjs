/**
 * Check exact PHP-Wasm publisher lineage without claiming retained acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforePhpWasmEntryPublisherSource
	, phpWasmEntryPublisherAddedPaths
	, phpWasmEntryPublisherChangedPaths
	, phpWasmEntryPublisherCommits
	, phpWasmEntryPublisherImplementationPaths
	, phpWasmEntryPublisherHistoryPath
	, phpWasmEntryPublisherImplementation
	, phpWasmEntryPublisherIntegrationBase
	, phpWasmEntryPublisherIntegrationPaths
	, phpWasmEntryPublisherPredecessor
	, phpWasmEntryPublisherPins
	, reversePhpWasmEntryPublisherUpdate
} from "./php-wasm-entry-publisher-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	phpWasmEntryPublisherHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("PHP-Wasm entry publisher authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-publisher-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryPublisherPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryPublisherImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryPublisherIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryPublisherCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryPublisherChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryPublisherIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryPublisherAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryPublisherPredecessor + ".." + phpWasmEntryPublisherImplementation]).trim().split("\n")
	, phpWasmEntryPublisherCommits);
	for(const [index, revision] of phpWasmEntryPublisherCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryPublisherPredecessor : phpWasmEntryPublisherCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryPublisherPredecessor
		, phpWasmEntryPublisherImplementation]).trim().split("\n")
	, [...phpWasmEntryPublisherImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryPublisherSource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryPublisherIntegrationBase : phpWasmEntryPublisherPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryPublisherUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.ok(finRefinementNormalizationPaths.includes(inventoryPath));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("PHP-Wasm entry publisher preserves public measurements and original verifiers", async () => {
	const record = await read();
	assert.equal(record.updates.length, 7);
	const previous = git(["show", phpWasmEntryPublisherPredecessor + ":tests/checked-javascript.test.mjs"]);
	const current = git(["show", phpWasmEntryPublisherImplementation + ":tests/checked-javascript.test.mjs"]);
	assert.equal(current, previous.replace(
		'import "./helpers/php-wasm-entry-publication-preparation-source-history-tests.mjs";'
		, 'import "./helpers/php-wasm-entry-publication-preparation-source-history-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-publisher-tests.mjs";'));
	for(const path of [".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-summary.mjs"
		, "docs/php.md", "docs/publish/php.md"
		, "docs/lean/existing-package.md", "docs/reference/types.md"])
		assert.equal(git(["rev-parse", phpWasmEntryPublisherPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryPublisherImplementation + ":" + path]));
	assert.match(record.scope, /No hosted probe evidence/u);
	assert.match(record.scope, /Actual terminal-run archive acceptance/u);
});

test("PHP-Wasm entry publisher refreshes exactly 155 source pins without changing evidence claims", async () => {
	const record = await read(), update = record.updates.find(item => item.path === inventoryPath);
	assert.deepEqual(record.pins, phpWasmEntryPublisherPins);
	assert.equal(update.edits.length, 155);
	const counters = new Map(phpWasmEntryPublisherPins.map(pin => [pin.path, 0]));
	for(const edit of update.edits)
	{
		const pin = phpWasmEntryPublisherPins.find(item =>
			edit.previous === '          "sha256": "' + item.previous + '"\n'
			&& edit.current === '          "sha256": "' + item.current + '"\n');
		assert.ok(pin, "Only the three exact source-pin replacements are admitted");
		counters.set(pin.path, counters.get(pin.path) + 1);
	}
	for(const pin of phpWasmEntryPublisherPins)
	{
		assert.equal(counters.get(pin.path), pin.count);
		assert.equal(sha256(git(["show", phpWasmEntryPublisherPredecessor + ":" + pin.path])), pin.previous);
		assert.equal(sha256(git(["show", phpWasmEntryPublisherImplementation + ":" + pin.path])), pin.current);
	}
	const digest = async revision => {
		const hash = createHash("sha256");
		for await(const chunk of gitSourceBytes(revision, inventoryPath)) hash.update(chunk);
		return hash.digest("hex");
	};
	assert.equal(await digest(phpWasmEntryPublisherPredecessor), update.previousSha256);
	assert.equal(await digest(phpWasmEntryPublisherImplementation), update.currentSha256);
	assert.equal(await authenticateSourceHistoryReverse(
		gitSourceBytes(phpWasmEntryPublisherImplementation, inventoryPath), update), true);
});

test("PHP-Wasm entry publisher rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryPublisherSource);
	assert.equal(beforePhpWasmEntryPublisherSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryPublisherSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryPublisherUpdate(current, forged));
	assert.equal(beforePhpWasmEntryPublisherSource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry publisher writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-publisher-history-guard-"));
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
		"scripts/update-php-wasm-entry-publisher-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
