/**
 * Authenticate the JavaScript hosted-run outcome history layer.
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
	beforeOwnedCheckedRecordJavaScriptHostedRunOutcomeSource
	, ownedCheckedRecordJavaScriptHostedRunOutcomeAddedPaths
	, ownedCheckedRecordJavaScriptHostedRunOutcomeHistoryPath
	, ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation
	, ownedCheckedRecordJavaScriptHostedRunOutcomeImplementationPaths
	, ownedCheckedRecordJavaScriptHostedRunOutcomeIntegrationPaths
	, ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths
	, ownedCheckedRecordJavaScriptHostedRunOutcomePredecessor
	, reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate
} from "./owned-checked-record-javascript-hosted-run-outcome-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	ownedCheckedRecordJavaScriptHostedRunOutcomeHistoryPath, "utf8"));
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);

test("owned checked-record JavaScript run-outcome history restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-javascript-hosted-run-outcome-source-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordJavaScriptHostedRunOutcomePredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedRecordJavaScriptHostedRunOutcomeIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordJavaScriptHostedRunOutcomeAddedPaths);
	for(const update of record.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedCheckedRecordJavaScriptHostedRunOutcomePredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation}:${update.path}`])
			, update.path);
		assert.equal(reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate(
			current, update), previous, update.path);
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

test("owned checked-record JavaScript run-outcome history is one exact commit"
	, () => {
	const predecessor = ownedCheckedRecordJavaScriptHostedRunOutcomePredecessor;
	const implementation
		= ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation;
	assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
	assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
		, [...ownedCheckedRecordJavaScriptHostedRunOutcomeImplementationPaths]
			.sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, predecessor, implementation])
	, [...ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths].sort());
	}
);

test("owned checked-record JavaScript run-outcome history invents no pin update"
	, () => {
	const inventory = JSON.parse(git(["show"
		, `${ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation}:docs/type-surface.v1.json`]));
	const pinnedPaths = new Set(inventory.evidence.flatMap(evidence =>
		evidence.files.map(file => file.path)));
	for(const path of [
		...ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths
		, ...ownedCheckedRecordJavaScriptHostedRunOutcomeIntegrationPaths
	]) assert.equal(pinnedPaths.has(path), false, path);
	}
);

test("owned checked-record JavaScript run-outcome layer reaches older history"
	, async () => {
	const record = await readRecord();
	const update = record.updates.find(item =>
		item.path === "tests/helpers/owned-checked-record-hosted-contracts.mjs");
	const current = await atMilestone(update.path, update.currentSha256);
	const older = "cee04d40968486fcc50b47dc7793fe9f3134ed57";
	const target = git(["show", `${older}:${update.path}`]);
	assert.notEqual(sha256(target), update.previousSha256);
	assert.equal(beforeFinRefinementSource(update.path, current, sha256(target))
		, target);
	}
);

test("owned checked-record JavaScript run-outcome history rejects alteration"
	, async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate(
		current, forged));
	assert.equal(beforeOwnedCheckedRecordJavaScriptHostedRunOutcomeSource(
		update.path, current, update.currentSha256)
	, reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate(current, update));
	}
);

test("owned checked-record JavaScript run-outcome writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-checked-record-javascript-run-outcome-history-"));
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
		"scripts/update-owned-checked-record-javascript-hosted-run-outcome-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
