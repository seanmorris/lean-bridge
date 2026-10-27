/**
 * Verify the nominal Subtype entry publication live-pin repair.
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
	beforeNominalSubtypeEntryLivePinRepairSource
	, nominalSubtypeEntryLivePinRepairAddedPaths
	, nominalSubtypeEntryLivePinRepairHistoryPath
	, nominalSubtypeEntryLivePinRepairImplementation
	, nominalSubtypeEntryLivePinRepairImplementationPaths
	, nominalSubtypeEntryLivePinRepairIntegrationPaths
	, nominalSubtypeEntryLivePinRepairPinCount
	, nominalSubtypeEntryLivePinRepairPins
	, nominalSubtypeEntryLivePinRepairPredecessor
	, reverseNominalSubtypeEntryLivePinRepairUpdate
} from "./nominal-subtype-entry-live-pin-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";

const inventoryPath = nominalSubtypeEntryLivePinRepairImplementationPaths[0];
const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	nominalSubtypeEntryLivePinRepairHistoryPath, "utf8"));
const hashLine = digest => `          "sha256": "${digest}"\n`;

test("nominal-entry live-pin repair authenticates both streamed inventory endpoints"
	, async () => {
		const record = await readRecord();
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "nominal-subtype-entry-live-pin-repair-source-v1");
		assert.equal(record.predecessorCommit
			, nominalSubtypeEntryLivePinRepairPredecessor);
		assert.equal(record.implementationCommit
			, nominalSubtypeEntryLivePinRepairImplementation);
		assert.equal(git(["show", "-s", "--format=%P"
			, record.implementationCommit]).trim(), record.predecessorCommit);
		assert.equal(git(["show", "-s", "--format=%P"
			, record.integrationCommit]).trim(), record.implementationCommit);
		assert.deepEqual(record.updates.map(item => item.path)
			, nominalSubtypeEntryLivePinRepairImplementationPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, nominalSubtypeEntryLivePinRepairIntegrationPaths);
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			record.implementationCommit, inventoryPath), record.updates[0]), true);
		for(const update of record.integrationUpdates)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				record.integrationCommit, update.path), update), true);
			if(update.path === inventoryPath) continue;
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeNominalSubtypeEntryLivePinRepairSource);
			const previous = git(["show"
				, `${record.implementationCommit}:${update.path}`]);
			assert.equal(reverseNominalSubtypeEntryLivePinRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
	}
);

test("nominal-entry live-pin repair changes exactly 118 named hashes"
	, async () => {
		const record = await readRecord();
		assert.equal(record.pinCount, nominalSubtypeEntryLivePinRepairPinCount);
		assert.deepEqual(record.pins, nominalSubtypeEntryLivePinRepairPins);
		const counts = new Map();
		for(const edit of record.updates[0].edits)
		{
			const pin = nominalSubtypeEntryLivePinRepairPins.find(candidate =>
				edit.previous === hashLine(candidate.previousSha256));
			assert.ok(pin, "Only one declared stale source hash may change");
			assert.equal(edit.current, hashLine(pin.currentSha256));
			counts.set(pin.path, (counts.get(pin.path) ?? 0) + 1);
		}
		assert.equal(record.updates[0].edits.length
			, nominalSubtypeEntryLivePinRepairPinCount);
		for(const pin of nominalSubtypeEntryLivePinRepairPins)
		{
			assert.equal(counts.get(pin.path), pin.count, pin.path);
			assert.equal(sha256(git(["show"
				, `${record.implementationCommit}:${pin.path}`]))
				, pin.currentSha256, pin.path);
		}
	}
);

test("nominal-entry history registration changes exactly three live pins"
	, async () => {
		const record = await readRecord();
		assert.equal(record.registrationPinCount, 3);
		assert.equal(record.registration.count, 3);
		assert.equal(record.registration.path
			, "tests/component-array-contract.test.mjs");
		const update = record.integrationUpdates.find(item =>
			item.path === inventoryPath);
		assert.ok(update);
		assert.equal(update.edits.length, 3);
		for(const edit of update.edits)
		{
			assert.equal(edit.previous
				, hashLine(record.registration.previousSha256));
			assert.equal(edit.current
				, hashLine(record.registration.currentSha256));
		}
	}
);

test("nominal-entry live-pin repair additions retain exact implementation identities"
	, async () => {
		const record = await readRecord();
		assert.deepEqual(record.additions.map(item => item.path)
			, nominalSubtypeEntryLivePinRepairAddedPaths);
		assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
			, record.predecessorCommit, record.implementationCommit])
		, [...nominalSubtypeEntryLivePinRepairImplementationPaths].sort());
		assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
			, record.predecessorCommit, record.implementationCommit])
		, [...nominalSubtypeEntryLivePinRepairAddedPaths].sort());
		for(const addition of record.additions)
			assert.equal(sha256(git(["show"
				, `${addition.commit}:${addition.path}`]))
			, addition.currentSha256, addition.path);
	}
);

test("nominal-entry live-pin repair rejects forged transitions", async () => {
	const record = await readRecord();
	const update = record.integrationUpdates.find(item =>
		item.path !== inventoryPath);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeNominalSubtypeEntryLivePinRepairSource);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }])
		assert.throws(() => reverseNominalSubtypeEntryLivePinRepairUpdate(
			current, forged));
	assert.equal(beforeNominalSubtypeEntryLivePinRepairSource(
		"docs/unrelated.md", current), current);
});

test("nominal-entry live-pin writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-nominal-entry-pin-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nominal-subtype-entry-live-pin-repair-source-history.mjs")
		, "--record"], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /pending implementation identity|integration child/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
