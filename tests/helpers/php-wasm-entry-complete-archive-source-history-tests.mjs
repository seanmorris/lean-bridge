/**
 * Check exact PHP-Wasm complete archive lineage without claiming retained acceptance.
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
	beforePhpWasmEntryCompleteArchiveSource
	, phpWasmEntryCompleteArchiveAddedPaths
	, phpWasmEntryCompleteArchiveChangedPaths
	, phpWasmEntryCompleteArchiveCommits
	, phpWasmEntryCompleteArchiveImplementationPaths
	, phpWasmEntryCompleteArchiveHistoryPath
	, phpWasmEntryCompleteArchiveImplementation
	, phpWasmEntryCompleteArchiveIntegrationBase
	, phpWasmEntryCompleteArchiveIntegrationPaths
	, phpWasmEntryCompleteArchivePredecessor
	, reversePhpWasmEntryCompleteArchiveUpdate
} from "./php-wasm-entry-complete-archive-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	phpWasmEntryCompleteArchiveHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("PHP-Wasm entry complete archive authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-complete-archive-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryCompleteArchivePredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryCompleteArchiveImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryCompleteArchiveIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryCompleteArchiveCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryCompleteArchiveChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryCompleteArchiveIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryCompleteArchiveAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryCompleteArchivePredecessor + ".." + phpWasmEntryCompleteArchiveImplementation]).trim().split("\n")
	, phpWasmEntryCompleteArchiveCommits);
	for(const [index, revision] of phpWasmEntryCompleteArchiveCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryCompleteArchivePredecessor : phpWasmEntryCompleteArchiveCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryCompleteArchivePredecessor
		, phpWasmEntryCompleteArchiveImplementation]).trim().split("\n")
	, [...phpWasmEntryCompleteArchiveImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryCompleteArchiveSource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryCompleteArchiveIntegrationBase : phpWasmEntryCompleteArchivePredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryCompleteArchiveUpdate(
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

test("PHP-Wasm entry complete archive adds only complete archive tooling and test registration", async () => {
	const record = await read();
	assert.equal(record.updates.length, 1);
	assert.equal(record.updates[0].path, "tests/checked-javascript.test.mjs");
	const previous = git(["show"
		, phpWasmEntryCompleteArchivePredecessor
		+ ":tests/checked-javascript.test.mjs"]);
	const current = git(["show"
		, phpWasmEntryCompleteArchiveImplementation
		+ ":tests/checked-javascript.test.mjs"]);
	assert.equal(current, previous.replace(
		'import "./helpers/php-wasm-entry-diagnostic-retention-source-history-tests.mjs";'
		, 'import "./helpers/php-wasm-entry-diagnostic-retention-source-history-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-hosted-archive-tests.mjs";'));
	for(const path of [inventoryPath
		, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"])
		assert.equal(git(["rev-parse", phpWasmEntryCompleteArchivePredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryCompleteArchiveImplementation + ":" + path]));
	assert.match(record.scope, /Actual terminal-run capture/u);
	assert.match(record.scope, /real thirty-route verifier/u);
});

test("PHP-Wasm entry complete archive rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryCompleteArchiveSource);
	assert.equal(beforePhpWasmEntryCompleteArchiveSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryCompleteArchiveSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryCompleteArchiveUpdate(current, forged));
	assert.equal(beforePhpWasmEntryCompleteArchiveSource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry complete archive writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-complete-archive-guard-"));
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
		"scripts/update-php-wasm-entry-complete-archive-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
