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
	beforePhpWasmEntryHostedReplaySource
	, phpWasmEntryHostedReplayAddedPaths
	, phpWasmEntryHostedReplayChangedPaths
	, phpWasmEntryHostedReplayCommits
	, phpWasmEntryHostedReplayImplementationPaths
	, phpWasmEntryHostedReplayHistoryPath
	, phpWasmEntryHostedReplayImplementation
	, phpWasmEntryHostedReplayIntegrationBase
	, phpWasmEntryHostedReplayIntegrationPaths
	, phpWasmEntryHostedReplayPredecessor
	, reversePhpWasmEntryHostedReplayUpdate
} from "./php-wasm-entry-hosted-replay-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	phpWasmEntryHostedReplayHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";

test("PHP-Wasm entry hosted replay authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-hosted-replay-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryHostedReplayPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryHostedReplayImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryHostedReplayIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryHostedReplayCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryHostedReplayChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryHostedReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryHostedReplayAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryHostedReplayPredecessor + ".." + phpWasmEntryHostedReplayImplementation]).trim().split("\n")
	, phpWasmEntryHostedReplayCommits);
	for(const [index, revision] of phpWasmEntryHostedReplayCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryHostedReplayPredecessor : phpWasmEntryHostedReplayCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryHostedReplayPredecessor
		, phpWasmEntryHostedReplayImplementation]).trim().split("\n")
	, [...phpWasmEntryHostedReplayImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryHostedReplaySource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryHostedReplayIntegrationBase : phpWasmEntryHostedReplayPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryHostedReplayUpdate(
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

test("PHP-Wasm entry hosted replay adds only its registered original-source replay", async () => {
	const record = await read();
	assert.equal(record.updates.length, 1);
	assert.equal(record.updates[0].path, "tests/checked-javascript.test.mjs");
	const previous = git(["show"
		, phpWasmEntryHostedReplayPredecessor
		+ ":tests/checked-javascript.test.mjs"]);
	const current = git(["show"
		, phpWasmEntryHostedReplayImplementation
		+ ":tests/checked-javascript.test.mjs"]);
	assert.equal(current, previous.replace(
		'import "./helpers/php-wasm-entry-hosted-identity-source-history-tests.mjs";'
		, 'import "./helpers/php-wasm-entry-hosted-identity-source-history-tests.mjs";'
		+ '\nimport "./helpers/php-wasm-refinement-entry-hosted-replay-tests.mjs";'));
	for(const path of [inventoryPath
		, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"])
		assert.equal(git(["rev-parse", phpWasmEntryHostedReplayPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryHostedReplayImplementation + ":" + path]));
	assert.match(record.scope, /complete matrix acceptance remains separate/u);
	assert.match(record.scope, /diagnostic-only partial retention/u);
});

test("PHP-Wasm entry hosted replay rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryHostedReplaySource);
	assert.equal(beforePhpWasmEntryHostedReplaySource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryHostedReplaySource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryHostedReplayUpdate(current, forged));
	assert.equal(beforePhpWasmEntryHostedReplaySource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry hosted replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-hosted-replay-guard-"));
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
		"scripts/update-php-wasm-entry-hosted-replay-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
