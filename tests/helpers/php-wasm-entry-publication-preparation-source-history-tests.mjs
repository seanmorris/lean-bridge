/**
 * Check exact PHP-Wasm publication preparation lineage without claiming retained acceptance.
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
	beforePhpWasmEntryPublicationPreparationSource
	, phpWasmEntryPublicationPreparationAddedPaths
	, phpWasmEntryPublicationPreparationChangedPaths
	, phpWasmEntryPublicationPreparationCommits
	, phpWasmEntryPublicationPreparationImplementationPaths
	, phpWasmEntryPublicationPreparationHistoryPath
	, phpWasmEntryPublicationPreparationImplementation
	, phpWasmEntryPublicationPreparationIntegrationBase
	, phpWasmEntryPublicationPreparationIntegrationPaths
	, phpWasmEntryPublicationPreparationPredecessor
	, reversePhpWasmEntryPublicationPreparationUpdate
} from "./php-wasm-entry-publication-preparation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	phpWasmEntryPublicationPreparationHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("PHP-Wasm entry publication preparation authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-publication-preparation-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryPublicationPreparationPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryPublicationPreparationImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryPublicationPreparationIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryPublicationPreparationCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryPublicationPreparationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryPublicationPreparationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryPublicationPreparationAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryPublicationPreparationPredecessor + ".." + phpWasmEntryPublicationPreparationImplementation]).trim().split("\n")
	, phpWasmEntryPublicationPreparationCommits);
	for(const [index, revision] of phpWasmEntryPublicationPreparationCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryPublicationPreparationPredecessor : phpWasmEntryPublicationPreparationCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryPublicationPreparationPredecessor
		, phpWasmEntryPublicationPreparationImplementation]).trim().split("\n")
	, [...phpWasmEntryPublicationPreparationImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryPublicationPreparationSource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryPublicationPreparationIntegrationBase : phpWasmEntryPublicationPreparationPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryPublicationPreparationUpdate(
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

test("PHP-Wasm entry publication preparation adds only publication preparation and test registration", async () => {
	const record = await read();
	assert.equal(record.updates.length, 1);
	assert.equal(record.updates[0].path, "tests/checked-javascript.test.mjs");
	const previous = git(["show"
		, phpWasmEntryPublicationPreparationPredecessor
		+ ":tests/checked-javascript.test.mjs"]);
	const current = git(["show"
		, phpWasmEntryPublicationPreparationImplementation
		+ ":tests/checked-javascript.test.mjs"]);
	assert.equal(current, previous.replace(
		'import "./helpers/php-wasm-entry-complete-archive-source-history-tests.mjs";'
		, 'import "./helpers/php-wasm-entry-complete-archive-source-history-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-publication-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-publication-docs-tests.mjs";'));
	for(const path of [inventoryPath
		, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
		, "scripts/generate-type-docs.mjs", "docs/php.md", "docs/publish/php.md"
		, "docs/lean/existing-package.md", "docs/reference/types.md"])
		assert.equal(git(["rev-parse", phpWasmEntryPublicationPreparationPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryPublicationPreparationImplementation + ":" + path]));
	assert.match(record.scope, /Actual terminal-run acceptance/u);
	assert.match(record.scope, /real thirty-route verifier/u);
});

test("PHP-Wasm entry publication preparation rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryPublicationPreparationSource);
	assert.equal(beforePhpWasmEntryPublicationPreparationSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryPublicationPreparationSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryPublicationPreparationUpdate(current, forged));
	assert.equal(beforePhpWasmEntryPublicationPreparationSource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry publication preparation writer refuses another checkout", async t => {
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
		"scripts/update-php-wasm-entry-publication-preparation-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
