/**
 * Check exact PHP-Wasm hosted-identity lineage without accepting probe results.
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
	beforePhpWasmEntryHostedIdentitySource
	, phpWasmEntryHostedIdentityAddedPaths
	, phpWasmEntryHostedIdentityChangedPaths
	, phpWasmEntryHostedIdentityCommits
	, phpWasmEntryHostedIdentityImplementationPaths
	, phpWasmEntryHostedIdentityHistoryPath
	, phpWasmEntryHostedIdentityImplementation
	, phpWasmEntryHostedIdentityIntegrationBase
	, phpWasmEntryHostedIdentityIntegrationPaths
	, phpWasmEntryHostedIdentityPredecessor
	, reversePhpWasmEntryHostedIdentityUpdate
} from "./php-wasm-entry-hosted-identity-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	phpWasmEntryHostedIdentityHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("PHP-Wasm entry hosted identity authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-hosted-identity-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryHostedIdentityPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryHostedIdentityImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryHostedIdentityIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryHostedIdentityCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryHostedIdentityChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryHostedIdentityIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryHostedIdentityAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryHostedIdentityPredecessor + ".." + phpWasmEntryHostedIdentityImplementation]).trim().split("\n")
	, phpWasmEntryHostedIdentityCommits);
	for(const [index, revision] of phpWasmEntryHostedIdentityCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryHostedIdentityPredecessor : phpWasmEntryHostedIdentityCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryHostedIdentityPredecessor
		, phpWasmEntryHostedIdentityImplementation]).trim().split("\n")
	, [...phpWasmEntryHostedIdentityImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryHostedIdentitySource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryHostedIdentityIntegrationBase : phpWasmEntryHostedIdentityPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryHostedIdentityUpdate(
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

test("PHP-Wasm entry hosted identity changes only its registered preflight", async () => {
	const record = await read();
	assert.equal(record.updates.length, 1);
	assert.equal(record.updates[0].path, "tests/checked-javascript.test.mjs");
	const previous = git(["show"
		, phpWasmEntryHostedIdentityPredecessor
		+ ":tests/checked-javascript.test.mjs"]);
	const current = git(["show"
		, phpWasmEntryHostedIdentityImplementation
		+ ":tests/checked-javascript.test.mjs"]);
	assert.equal(current, previous.replace(
		'import "./helpers/owned-checked-record-matrix-publication-source-history-tests.mjs";'
		, 'import "./helpers/owned-checked-record-matrix-publication-source-history-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-hosted-identities-tests.mjs";'));
	for(const path of [inventoryPath
		, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"])
		assert.equal(git(["rev-parse", phpWasmEntryHostedIdentityPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryHostedIdentityImplementation + ":" + path]));
	assert.match(record.scope, /zero replayed routes/u);
	assert.match(record.scope, /diagnostic-only partial retention/u);
});

test("PHP-Wasm entry hosted identity rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryHostedIdentitySource);
	assert.equal(beforePhpWasmEntryHostedIdentitySource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryHostedIdentitySource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryHostedIdentityUpdate(current, forged));
	assert.equal(beforePhpWasmEntryHostedIdentitySource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry hosted identity writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-hosted-identity-guard-"));
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
		"scripts/update-php-wasm-entry-hosted-identity-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
