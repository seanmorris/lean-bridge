/**
 * Check exact PHP-Wasm publication-pin lineage without accepting probe results.
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
	beforePhpWasmEntryPublicationPinRepairSource
	, phpWasmEntryPublicationPinRepairAddedPaths
	, phpWasmEntryPublicationPinRepairChangedPaths
	, phpWasmEntryPublicationPinRepairCommits
	, phpWasmEntryPublicationPinRepairImplementationPaths
	, phpWasmEntryPublicationPinRepairHistoryPath
	, phpWasmEntryPublicationPinRepairImplementation
	, phpWasmEntryPublicationPinRepairIntegrationBase
	, phpWasmEntryPublicationPinRepairIntegrationPaths
	, phpWasmEntryPublicationPinRepairPredecessor
	, reversePhpWasmEntryPublicationPinRepairUpdate
} from "./php-wasm-entry-publication-pin-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	phpWasmEntryPublicationPinRepairHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("PHP-Wasm entry publication pin repair authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-publication-pin-repair-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryPublicationPinRepairPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryPublicationPinRepairImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryPublicationPinRepairIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryPublicationPinRepairCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryPublicationPinRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryPublicationPinRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryPublicationPinRepairAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryPublicationPinRepairPredecessor + ".." + phpWasmEntryPublicationPinRepairImplementation]).trim().split("\n")
	, phpWasmEntryPublicationPinRepairCommits);
	for(const [index, revision] of phpWasmEntryPublicationPinRepairCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryPublicationPinRepairPredecessor : phpWasmEntryPublicationPinRepairCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryPublicationPinRepairPredecessor
		, phpWasmEntryPublicationPinRepairImplementation]).trim().split("\n")
	, [...phpWasmEntryPublicationPinRepairImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryPublicationPinRepairSource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryPublicationPinRepairIntegrationBase : phpWasmEntryPublicationPinRepairPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryPublicationPinRepairUpdate(
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

test("PHP-Wasm entry publication pin repair changes only staging and registered regressions", async () => {
	const record = await read();
	assert.equal(record.updates.length, 2);
	const previous = git(["show"
		, phpWasmEntryPublicationPinRepairPredecessor
		+ ":tests/checked-javascript.test.mjs"]);
	const current = git(["show"
		, phpWasmEntryPublicationPinRepairImplementation
		+ ":tests/checked-javascript.test.mjs"]);
	assert.equal(current, previous.replace(
		'import "./helpers/php-wasm-refinement-entry-publisher-tests.mjs";'
		, 'import "./helpers/php-wasm-refinement-entry-publisher-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-publication-pins-tests.mjs";'));
	for(const path of [inventoryPath
		, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-archive.mjs"
		, "tests/helpers/type-surface-promotion-io.mjs"
		, "docs/php.md", "docs/publish/php.md"
		, "docs/lean/existing-package.md", "docs/reference/types.md"])
		assert.equal(git(["rev-parse", phpWasmEntryPublicationPinRepairPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryPublicationPinRepairImplementation + ":" + path]));
	assert.match(record.scope, /29 live documentation pins/u);
	assert.match(record.scope, /No public measurement/u);
});

test("PHP-Wasm entry publication pin repair rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryPublicationPinRepairSource);
	assert.equal(beforePhpWasmEntryPublicationPinRepairSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryPublicationPinRepairSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryPublicationPinRepairUpdate(current, forged));
	assert.equal(beforePhpWasmEntryPublicationPinRepairSource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry publication pin repair writer refuses another checkout", async t => {
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
		"scripts/update-php-wasm-entry-publication-pin-repair-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
