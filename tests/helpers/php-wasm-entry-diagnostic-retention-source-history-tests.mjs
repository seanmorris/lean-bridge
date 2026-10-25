/**
 * Check exact PHP-Wasm original-source replay lineage without claiming matrix acceptance.
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
	beforePhpWasmEntryDiagnosticRetentionSource
	, phpWasmEntryDiagnosticRetentionAddedPaths
	, phpWasmEntryDiagnosticRetentionChangedPaths
	, phpWasmEntryDiagnosticRetentionCommits
	, phpWasmEntryDiagnosticRetentionImplementationPaths
	, phpWasmEntryDiagnosticRetentionHistoryPath
	, phpWasmEntryDiagnosticRetentionImplementation
	, phpWasmEntryDiagnosticRetentionIntegrationBase
	, phpWasmEntryDiagnosticRetentionIntegrationPaths
	, phpWasmEntryDiagnosticRetentionPredecessor
	, reversePhpWasmEntryDiagnosticRetentionUpdate
} from "./php-wasm-entry-diagnostic-retention-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	phpWasmEntryDiagnosticRetentionHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("PHP-Wasm entry diagnostic retention authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-diagnostic-retention-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryDiagnosticRetentionPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryDiagnosticRetentionImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryDiagnosticRetentionIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryDiagnosticRetentionCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryDiagnosticRetentionChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryDiagnosticRetentionIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryDiagnosticRetentionAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryDiagnosticRetentionPredecessor + ".." + phpWasmEntryDiagnosticRetentionImplementation]).trim().split("\n")
	, phpWasmEntryDiagnosticRetentionCommits);
	for(const [index, revision] of phpWasmEntryDiagnosticRetentionCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryDiagnosticRetentionPredecessor : phpWasmEntryDiagnosticRetentionCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryDiagnosticRetentionPredecessor
		, phpWasmEntryDiagnosticRetentionImplementation]).trim().split("\n")
	, [...phpWasmEntryDiagnosticRetentionImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryDiagnosticRetentionSource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryDiagnosticRetentionIntegrationBase : phpWasmEntryDiagnosticRetentionPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryDiagnosticRetentionUpdate(
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

test("PHP-Wasm entry diagnostic retention changes only byte storage and diagnostic capture", async () => {
	const record = await read();
	assert.equal(record.updates.length, 1);
	assert.equal(record.updates[0].path, "tests/checked-javascript.test.mjs");
	const previous = git(["show"
		, phpWasmEntryDiagnosticRetentionPredecessor
		+ ":tests/checked-javascript.test.mjs"]);
	const current = git(["show"
		, phpWasmEntryDiagnosticRetentionImplementation
		+ ":tests/checked-javascript.test.mjs"]);
	assert.equal(current, previous.replace(
		'import "./helpers/php-wasm-entry-hosted-replay-source-history-tests.mjs";'
		, 'import "./helpers/php-wasm-entry-hosted-replay-source-history-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-hosted-storage-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-hosted-diagnostic-tests.mjs";'));
	for(const path of [inventoryPath
		, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"])
		assert.equal(git(["rev-parse", phpWasmEntryDiagnosticRetentionPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryDiagnosticRetentionImplementation + ":" + path]));
	assert.match(record.scope, /complete matrix acceptance remains separate/u);
	assert.match(record.scope, /diagnostic-only partial retention/u);
});

test("PHP-Wasm entry diagnostic retention rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryDiagnosticRetentionSource);
	assert.equal(beforePhpWasmEntryDiagnosticRetentionSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryDiagnosticRetentionSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryDiagnosticRetentionUpdate(current, forged));
	assert.equal(beforePhpWasmEntryDiagnosticRetentionSource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry diagnostic retention writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-diagnostic-retention-guard-"));
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
		"scripts/update-php-wasm-entry-diagnostic-retention-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
