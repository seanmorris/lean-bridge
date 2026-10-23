/**
 * Authenticate the owned checked-record JavaScript hosted-lane history.
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
	beforeOwnedCheckedRecordJavaScriptHostedLaneSource
	, ownedCheckedRecordJavaScriptHostedLaneAddedPaths
	, ownedCheckedRecordJavaScriptHostedLaneHistoryPath
	, ownedCheckedRecordJavaScriptHostedLaneImplementation
	, ownedCheckedRecordJavaScriptHostedLaneImplementationPaths
	, ownedCheckedRecordJavaScriptHostedLaneIntegrationPaths
	, ownedCheckedRecordJavaScriptHostedLaneModifiedPaths
	, ownedCheckedRecordJavaScriptHostedLanePredecessor
	, reverseOwnedCheckedRecordJavaScriptHostedLaneUpdate
} from "./owned-checked-record-javascript-hosted-lane-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	ownedCheckedRecordJavaScriptHostedLaneHistoryPath, "utf8"));
const atMilestone = (path, digest) => sourceAtFinHistoryMilestone(path, digest);

test("owned checked-record JavaScript hosted-lane history restores every source"
	, async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-javascript-hosted-lane-source-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordJavaScriptHostedLanePredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordJavaScriptHostedLaneImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordJavaScriptHostedLaneModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedRecordJavaScriptHostedLaneIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordJavaScriptHostedLaneAddedPaths);
	for(const update of record.updates)
	{
		const current = await atMilestone(update.path, update.currentSha256);
		const previous = git(["show"
			, `${ownedCheckedRecordJavaScriptHostedLanePredecessor}:${update.path}`]);
		assert.equal(current, git(["show"
			, `${ownedCheckedRecordJavaScriptHostedLaneImplementation}:${update.path}`])
			, update.path);
		assert.equal(reverseOwnedCheckedRecordJavaScriptHostedLaneUpdate(
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
			, `${ownedCheckedRecordJavaScriptHostedLaneImplementation}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordJavaScriptHostedLaneUpdate(
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

test("owned checked-record JavaScript hosted-lane history is one exact commit"
	, () => {
	const predecessor = ownedCheckedRecordJavaScriptHostedLanePredecessor;
	const implementation = ownedCheckedRecordJavaScriptHostedLaneImplementation;
	assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
	assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
		, [...ownedCheckedRecordJavaScriptHostedLaneImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, predecessor, implementation])
	, [...ownedCheckedRecordJavaScriptHostedLaneModifiedPaths].sort());
	}
);

test("owned checked-record JavaScript hosted-lane history refreshes exact live pins"
	, async () => {
	const record = await readRecord();
	const inventoryUpdate = record.integrationUpdates.find(item =>
		item.path === inventoryPath);
	const inventory = JSON.parse(await atMilestone(
		inventoryPath, inventoryUpdate.currentSha256));
	const before = JSON.parse(git(["show"
		, `${ownedCheckedRecordJavaScriptHostedLaneImplementation}:${inventoryPath}`]));
	const expected = new Map([
		...record.updates.map(item => [item.path, item.currentSha256])
		, ...record.integrationUpdates.filter(item => item.path !== inventoryPath)
			.map(item => [item.path, item.currentSha256])
	]);
	assert.equal(inventory.evidence.length, before.evidence.length);
	let refreshed = 0;
	for(const [index, evidence] of inventory.evidence.entries())
	{
		const previous = before.evidence[index];
		assert.equal(evidence.files.length, previous.files.length);
		for(const [position, file] of evidence.files.entries())
		{
			const old = previous.files[position];
			assert.equal(file.path, old.path);
			if(expected.has(file.path))
			{
				assert.ok(!file.path.startsWith("docs/evidence/"), file.path);
				assert.equal(file.sha256, expected.get(file.path), file.path);
				if(old.sha256 !== file.sha256) refreshed++;
			}
			else assert.equal(file.sha256, old.sha256, file.path);
		}
	}
	assert.ok(refreshed > 0);
	assert.equal(beforeFinRefinementSource(inventoryPath
		, JSON.stringify(inventory, null, 2) + "\n"
		, inventoryUpdate.previousSha256)
	, git(["show"
		, `${ownedCheckedRecordJavaScriptHostedLaneImplementation}:${inventoryPath}`]));
	}
);

test("owned checked-record JavaScript hosted-lane lets the hub reach its older layer"
	, async () => {
	const record = await readRecord();
	const update = [...record.updates, ...record.integrationUpdates].find(item =>
		item.path === "tests/helpers/owned-checked-record-hosted-output.mjs");
	const current = await atMilestone(update.path, update.currentSha256);
	const older = "cee04d40968486fcc50b47dc7793fe9f3134ed57";
	const target = git(["show", `${older}:${update.path}`]);
	assert.notEqual(sha256(target), update.previousSha256);
	assert.equal(beforeFinRefinementSource(update.path, current, sha256(target))
		, target);
	}
);

test("owned checked-record JavaScript hosted-lane history rejects alteration"
	, async () => {
	const record = await readRecord();
	const update = structuredClone(record.updates[0]);
	const current = await atMilestone(update.path, update.currentSha256);
	const forged = structuredClone(update);
	forged.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedCheckedRecordJavaScriptHostedLaneUpdate(
		current, forged));
	const shifted = structuredClone(update);
	shifted.edits[0].start += 1;
	assert.throws(() => reverseOwnedCheckedRecordJavaScriptHostedLaneUpdate(
		current, shifted));
	assert.equal(beforeOwnedCheckedRecordJavaScriptHostedLaneSource(
		update.path, current, update.currentSha256)
	, reverseOwnedCheckedRecordJavaScriptHostedLaneUpdate(current, update));
	assert.equal(beforeOwnedCheckedRecordJavaScriptHostedLaneSource(
		"docs/unrelated.md", current), current);
	}
);

test("owned checked-record JavaScript hosted-lane writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-checked-record-javascript-hosted-history-"));
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
		"scripts/update-owned-checked-record-javascript-hosted-lane-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
