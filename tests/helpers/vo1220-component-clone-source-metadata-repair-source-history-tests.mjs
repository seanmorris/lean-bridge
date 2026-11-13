/**
 * Authenticate the component clone source-metadata repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	beforeVo1220ComponentCloneSourceMetadataRepairSource
	, reverseVo1220ComponentCloneSourceMetadataRepairUpdate
	, vo1220ComponentCloneSourceMetadataRepairAddedPaths
	, vo1220ComponentCloneSourceMetadataRepairHistoryPath
	, vo1220ComponentCloneSourceMetadataRepairImplementation
	, vo1220ComponentCloneSourceMetadataRepairImplementationPaths
	, vo1220ComponentCloneSourceMetadataRepairIntegrationPaths
	, vo1220ComponentCloneSourceMetadataRepairNormalizationPaths
	, vo1220ComponentCloneSourceMetadataRepairPredecessor
} from "./vo1220-component-clone-source-metadata-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220ComponentCloneSourceMetadataRepairHistoryPath, "utf8"));

test("component clone source-metadata repair binds the exact failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-component-clone-source-metadata-repair-v1");
	assert.equal(history.predecessorCommit
		, vo1220ComponentCloneSourceMetadataRepairPredecessor);
	assert.equal(history.implementationCommit
		, vo1220ComponentCloneSourceMetadataRepairImplementation);
	assert.deepEqual(history.hostedFailure, {
		run: 43336952561, job: 131602330677
		, workflow: "Downstream package consumers"
		, jobName: "Node and browser npm consumers"
		, failingTest: "locked release dry run reproduces both clean clones and verifies publication evidence"
		, failure: "Release gate changed author files or Git metadata"
	});
	assert.deepEqual(history.localValidation, {
		cloneOwnership: { tests: 1, passed: 1, failed: 0 }
		, cloneContract: { tests: 1, passed: 1, failed: 0 }
		, exactHostedTest: { tests: 1, passed: 1, failed: 0
			, durationSeconds: 110 }
		, liveSourcePins: { paths: 2661, occurrences: 16326
			, mismatches: 0 }
		, scopedLint: "passed"
	});
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ComponentCloneSourceMetadataRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ComponentCloneSourceMetadataRepairIntegrationPaths);
});

test("component clone source-metadata repair preserves independent clean clones"
	, () => {
	const source = sourceAt(
		vo1220ComponentCloneSourceMetadataRepairImplementation
		, "src/release/component-reproducibility-gate.mjs");
	assert.match(source
		, /"clone", "--quiet", "--shared", "--dissociate", "--no-checkout"/u);
	assert.doesNotMatch(source
		, /"clone", "--quiet", "--local", "--dissociate", "--no-checkout"/u);
	const ownership = sourceAt(
		vo1220ComponentCloneSourceMetadataRepairImplementation
		, "tests/lake-component-input.test.mjs");
	assert.match(ownership
		, /Clean source preparation changed author files or Git metadata/u);
	const contract = sourceAt(
		vo1220ComponentCloneSourceMetadataRepairImplementation
		, "tests/reproducibility-gate.test.mjs");
	assert.match(contract
		, /"clone", "--quiet", "--shared", "--dissociate", "--no-checkout"/u);
	}
);

test("component clone source-metadata repair reverses every transition"
	, async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(
			vo1220ComponentCloneSourceMetadataRepairImplementation, update.path);
		const previous = sourceAt(
			vo1220ComponentCloneSourceMetadataRepairPredecessor, update.path);
		assert.equal(reverseVo1220ComponentCloneSourceMetadataRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220ComponentCloneSourceMetadataRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			vo1220ComponentCloneSourceMetadataRepairImplementation, update.path);
		assert.equal(reverseVo1220ComponentCloneSourceMetadataRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220ComponentCloneSourceMetadataRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("component clone source-metadata repair rejects forgeries and duplicate writers"
	, async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220ComponentCloneSourceMetadataRepairAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(
		vo1220ComponentCloneSourceMetadataRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220ComponentCloneSourceMetadataRepairUpdate(current, forged));
	const root = await mkdtemp(
		`${tmpdir()}/vo1220-component-clone-source-metadata-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-component-clone-source-metadata-repair-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
		assert.deepEqual(await readdir(root), []);}
);
