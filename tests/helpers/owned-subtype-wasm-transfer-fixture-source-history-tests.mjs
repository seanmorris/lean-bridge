/**
 * Authenticate the Owned Subtype wasm transfer fixture history layer.
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
	beforeOwnedSubtypeWasmTransferFixtureSource
	, ownedSubtypeWasmTransferFixtureAddedPaths
	, ownedSubtypeWasmTransferFixtureHistoryPath
	, ownedSubtypeWasmTransferFixtureImplementation
	, ownedSubtypeWasmTransferFixtureIntegrationPaths
	, ownedSubtypeWasmTransferFixtureModifiedPaths
	, ownedSubtypeWasmTransferFixturePredecessor
	, reverseOwnedSubtypeWasmTransferFixtureUpdate
} from "./owned-subtype-wasm-transfer-fixture-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	ownedSubtypeWasmTransferFixtureHistoryPath, "utf8"));
// This layer always reverses a recognized transition, so milestones resolve
// through the central hub alone, which owns every stop decision.
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);
void inventoryPath;

test("Owned Subtype wasm transfer fixture history restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-wasm-transfer-fixture-source-v1");
	assert.equal(record.predecessorCommit, ownedSubtypeWasmTransferFixturePredecessor);
	assert.equal(record.implementationCommit, ownedSubtypeWasmTransferFixtureImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeWasmTransferFixtureModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeWasmTransferFixtureIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeWasmTransferFixtureAddedPaths);
	for(const update of record.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedSubtypeWasmTransferFixturePredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${ownedSubtypeWasmTransferFixtureImplementation}:${update.path}`]), update.path);
		assert.equal(reverseOwnedSubtypeWasmTransferFixtureUpdate(current, update), previous
			, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedSubtypeWasmTransferFixtureImplementation}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeWasmTransferFixtureUpdate(current, update), previous
			, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("Owned Subtype wasm transfer fixture history is one exact commit", () => {
	const predecessor = ownedSubtypeWasmTransferFixturePredecessor;
	const implementation = ownedSubtypeWasmTransferFixtureImplementation;
	const modified = [...ownedSubtypeWasmTransferFixtureModifiedPaths].sort();
	assert.equal(git(["rev-parse", `${implementation}^`]).trim()
		, predecessor);
	assert.deepEqual(names(["diff", "--name-only", predecessor
		, implementation]), modified);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, predecessor, implementation]), modified);
});

test("Owned Subtype wasm transfer fixture layer lets the hub reach older milestones"
	, async () => {
	const record = await readRecord();
	const update = [...record.updates, ...record.integrationUpdates].find(item =>
		item.path === "tests/helpers/fin-refinement-source-history.mjs");
	const current = await atMilestone(update.path, update.currentSha256);
	const older = "835d260a26dfd6bcbd577b47955a138accf21c7e";
	const target = git(["show", `${older}:${update.path}`]);
	assert.notEqual(sha256(target), update.previousSha256);
	assert.equal(beforeFinRefinementSource(update.path, current, sha256(target))
		, target);
	}
);

test("Owned Subtype wasm transfer fixture history rejects alteration", async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypeWasmTransferFixtureUpdate(current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseOwnedSubtypeWasmTransferFixtureUpdate(current, shifted));
	const rewritten = structuredClone(update);
	rewritten.edits[0].previous += "x";
	assert.throws(() => reverseOwnedSubtypeWasmTransferFixtureUpdate(current, rewritten));
	assert.equal(beforeOwnedSubtypeWasmTransferFixtureSource(update.path, current, update.currentSha256)
		, reverseOwnedSubtypeWasmTransferFixtureUpdate(current, update)
		, "a recognized transition is reversed regardless of the stop digest");
	assert.equal(beforeOwnedSubtypeWasmTransferFixtureSource(update.path, `${current}unrelated\n`)
		, `${current}unrelated\n`);
	assert.equal(beforeOwnedSubtypeWasmTransferFixtureSource("docs/unrelated.md", current), current);
});

test("Owned Subtype wasm transfer fixture history writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-subtype-wasm-transfer-fixture-history-"));
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
		"scripts/update-owned-subtype-wasm-transfer-fixture-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
