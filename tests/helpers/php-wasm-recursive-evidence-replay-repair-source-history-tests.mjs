/**
 * Authenticate the PHP-Wasm recursive evidence replay repair.
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
	beforePhpWasmRecursiveEvidenceReplayRepairSource
	, phpWasmRecursiveEvidenceReplayRepairAddedPaths
	, phpWasmRecursiveEvidenceReplayRepairHistoryPath
	, phpWasmRecursiveEvidenceReplayRepairImplementation
	, phpWasmRecursiveEvidenceReplayRepairIntegrationPaths
	, phpWasmRecursiveEvidenceReplayRepairModifiedPaths
	, phpWasmRecursiveEvidenceReplayRepairPredecessor
	, reversePhpWasmRecursiveEvidenceReplayRepairUpdate
} from "./php-wasm-recursive-evidence-replay-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { beforeWitRecursiveCallables } from "./wit-recursive-callable-source-history.mjs";
import "./core-milestone-replay-repair-source-history-tests.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	phpWasmRecursiveEvidenceReplayRepairHistoryPath, "utf8"));

test("PHP-Wasm recursive evidence replay repair restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-recursive-evidence-replay-repair-source-v1");
	assert.equal(record.predecessorCommit
		, phpWasmRecursiveEvidenceReplayRepairPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmRecursiveEvidenceReplayRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRecursiveEvidenceReplayRepairModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmRecursiveEvidenceReplayRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRecursiveEvidenceReplayRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${phpWasmRecursiveEvidenceReplayRepairPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRecursiveEvidenceReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${phpWasmRecursiveEvidenceReplayRepairImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmRecursiveEvidenceReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
	}
);

test("PHP-Wasm recursive evidence replay repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRecursiveEvidenceReplayRepairImplementation}^`]).trim()
	, phpWasmRecursiveEvidenceReplayRepairPredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, phpWasmRecursiveEvidenceReplayRepairPredecessor
		, phpWasmRecursiveEvidenceReplayRepairImplementation])
	, [...phpWasmRecursiveEvidenceReplayRepairModifiedPaths].sort());
});

test("PHP-Wasm recursive evidence replay repair refreshes exact live pins"
	, async () => {
	const record = await readRecord();
	assert.equal(record.pinCount, 9);
	const inventoryUpdate = record.integrationUpdates.find(item =>
		item.path === inventoryPath);
	const current = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryPath, inventoryUpdate.currentSha256));
	const previous = JSON.parse(git(["show"
		, `${phpWasmRecursiveEvidenceReplayRepairImplementation}:${inventoryPath}`]));
	const expected = new Map([
		...record.updates.map(item => [item.path, item.currentSha256])
		, ...record.integrationUpdates.filter(item => item.path !== inventoryPath)
			.map(item => [item.path, item.currentSha256])
	]);
	let pins = 0;
	for(const [index, evidence] of current.evidence.entries())
	{
		const oldEvidence = previous.evidence[index];
		assert.equal(evidence.files.length, oldEvidence.files.length);
		for(const [position, file] of evidence.files.entries())
		{
			const old = oldEvidence.files[position];
			assert.equal(file.path, old.path);
			if(expected.has(file.path))
			{
				assert.equal(file.sha256, expected.get(file.path), file.path);
				if(file.sha256 !== old.sha256) pins++;
				old.sha256 = file.sha256;
			}
			else assert.equal(file.sha256, old.sha256, file.path);
		}
	}
	assert.equal(pins, 9);
	assert.deepEqual(current, previous);
	}
);

test("WIT reader reaches PHP-Wasm recursive evidence milestones", async () => {
	const record = await readRecord();
	const path = "tests/helpers/php-wasm-recursive-callable-evidence.mjs";
	const live = await readFile(path, "utf8");
	const original = JSON.parse(await readFile(
		"docs/evidence/php-wasm-recursive-callable-integration-20260926.json"
		, "utf8")).sourceHashes[path];
	assert.ok(record.updates.some(item => item.path === path));
	assert.equal(sha256(beforeWitRecursiveCallables(path, live, original))
		, original);
});

test("PHP-Wasm recursive replay reaches both transitions without passing a stop"
	, async () => {
	const record = await readRecord();
	const path = "tests/php-wasm-recursive-callable-evidence.test.mjs";
	const integration = record.integrationUpdates.find(item => item.path === path);
	const implementation = record.updates.find(item => item.path === path);
	assert.equal(integration.previousSha256, implementation.currentSha256);
	const source = await sourceAtFinHistoryMilestone(path
		, integration.currentSha256);
	for(const expected of [integration.currentSha256
		, integration.previousSha256, implementation.previousSha256]) {
		assert.equal(sha256(beforePhpWasmRecursiveEvidenceReplayRepairSource(
			path, source, expected)), expected);
		assert.equal(sha256(beforeFinRefinementSource(
			path, Buffer.from(source), expected)), expected);
		}
	assert.equal(sha256(beforePhpWasmRecursiveEvidenceReplayRepairSource(
		path, source)), integration.previousSha256);
	const unknown = source + "\nunknown\n";
	assert.equal(beforePhpWasmRecursiveEvidenceReplayRepairSource(
		path, unknown, implementation.previousSha256), unknown);
	}
);

test("PHP-Wasm recursive evidence replay repair rejects alteration"
	, async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmRecursiveEvidenceReplayRepairUpdate(
		current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start++;
	assert.throws(() => reversePhpWasmRecursiveEvidenceReplayRepairUpdate(
		current, shifted));
	assert.equal(beforePhpWasmRecursiveEvidenceReplayRepairSource(
		"docs/unrelated.md", current), current);
	}
);

test("PHP-Wasm recursive evidence replay writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-php-wasm-recursive-replay-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-recursive-evidence-replay-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
