/**
 * Authenticate the Core historical-evidence replay repair.
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
	beforeCoreHistoricalEvidenceReplaySource
	, coreHistoricalEvidenceReplayAddedPaths
	, coreHistoricalEvidenceReplayHistoryPath
	, coreHistoricalEvidenceReplayImplementation
	, coreHistoricalEvidenceReplayImplementationPaths
	, coreHistoricalEvidenceReplayIntegrationPaths
	, coreHistoricalEvidenceReplayPredecessor
	, reverseCoreHistoricalEvidenceReplayUpdate
} from "./core-historical-evidence-replay-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	coreHistoricalEvidenceReplayHistoryPath, "utf8"
));

test("Core historical replay records its exact source range", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-historical-evidence-replay-source-v1");
	assert.equal(record.predecessorCommit
		, coreHistoricalEvidenceReplayPredecessor);
	assert.equal(record.implementationCommit
		, coreHistoricalEvidenceReplayImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreHistoricalEvidenceReplayImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreHistoricalEvidenceReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreHistoricalEvidenceReplayAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreHistoricalEvidenceReplayImplementation}^`]).trim()
	, coreHistoricalEvidenceReplayPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreHistoricalEvidenceReplayPredecessor
		, coreHistoricalEvidenceReplayImplementation]).trim().split("\n")
	, [...coreHistoricalEvidenceReplayImplementationPaths].sort());
});

test("Core historical replay reverses every source transition", async () => {
	const record = await read();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreHistoricalEvidenceReplaySource);
		const base = record.integrationUpdates.includes(update)
			? coreHistoricalEvidenceReplayImplementation
			: coreHistoricalEvidenceReplayPredecessor;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseCoreHistoricalEvidenceReplayUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core historical replay binds the immutable producer parents", async () => {
	assert.equal(git(["show", "-s", "--format=%P"
		, "511f43f1b02a6bddb5517f47a497e8eda766a065"]).trim()
	, "de6ec9dde00779476152481876de339f4cb82656");
	assert.equal(git(["show", "-s", "--format=%P"
		, "a3100134f1853102fc2cbf0c2f12839ac480af12"]).trim()
	, "93589825d4b4c028724390e4c8d886213cbc92d8");
	const cpp = await readFile("tests/helpers/owned-cpp-evidence.mjs", "utf8");
	const rust = await readFile(
		"tests/helpers/owned-rust-callback-result-acceptance.mjs", "utf8");
	const python = await readFile(
		"tests/owned-python-transfer-evidence.test.mjs", "utf8");
	assert.match(cpp, /511f43f1b02a6bddb5517f47a497e8eda766a065/u);
	assert.match(rust, /a3100134f1853102fc2cbf0c2f12839ac480af12/u);
	assert.match(python
		, /await readFile\(update\.path, "utf8"\), update\.currentSha256/u);
});

test("Core historical replay rejects altered transitions", async () => {
	const update = (await read()).updates[0];
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreHistoricalEvidenceReplaySource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreHistoricalEvidenceReplayUpdate(
			current, forged));
	assert.equal(beforeCoreHistoricalEvidenceReplaySource(
		update.path, current + "unknown"), current + "unknown");
});

test("Core historical replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-historical-replay-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-historical-evidence-replay-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
