/**
 * Authenticate the sparse Core static-classification repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeCoreStaticClassificationSparseSource
	, coreStaticClassificationSparseHistoryAdditions
	, coreStaticClassificationSparseHistoryPath
	, coreStaticClassificationSparseImplementation
	, coreStaticClassificationSparseImplementationPaths
	, coreStaticClassificationSparseIntegrationPaths
	, coreStaticClassificationSparsePins
	, coreStaticClassificationSparsePredecessor
	, reverseCoreStaticClassificationSparseUpdate
} from "./core-static-classification-sparse-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreStaticClassificationSparseHistoryPath, "utf8"));

test("sparse Core classification records the complete hosted defect", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-static-classification-sparse-source-v1");
	assert.equal(history.predecessorCommit
		, coreStaticClassificationSparsePredecessor);
	assert.equal(history.implementationCommit
		, coreStaticClassificationSparseImplementation);
	assert.equal(history.failedWorkflowRun, 41171335673);
	assert.equal(history.failedStaticJob, 124450245666);
	assert.equal(history.failureClass, "deterministic sparse-checkout ENOENT");
	assert.equal(history.missingPath
		, "docs/evidence/optional-parameter-dispatch-bridge-source-history-20261029.json");
	assert.deepEqual(history.updates.map(item => item.path)
		, coreStaticClassificationSparseImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreStaticClassificationSparseIntegrationPaths);
});

test("sparse Core classification reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			coreStaticClassificationSparseImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, coreStaticClassificationSparseImplementation + ":" + update.path]);
		assert.equal(reverseCoreStaticClassificationSparseUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreStaticClassificationSparseSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("sparse Core classification preserves the complete type-surface model"
	, async () => {
		const history = await record();
		assert.equal(history.refreshedCitationCount, 29);
		assert.equal(history.semanticChanges, 0);
		assert.deepEqual(history.typeSurfaceCounts, {
			evidence: 900, observations: 717, paths: 2, positions: 6
			, profiles: 17, stages: 5
		});
		const inventoryPath = coreStaticClassificationSparseImplementationPaths[0];
		const before = git(["show"
			, coreStaticClassificationSparsePredecessor + ":" + inventoryPath]);
		const after = git(["show"
			, coreStaticClassificationSparseImplementation + ":" + inventoryPath]);
		let restored = after;
		for(const pin of coreStaticClassificationSparsePins)
		{
			restored = restored.replaceAll(pin.current, pin.previous);
			assert.equal(after.split(pin.current).length - 1, pin.count);
			assert.equal(after.includes(pin.previous), false);
		}
		assert.equal(restored, before);
	}
);

test("sparse Core classification keeps history lazy and the full contract intact"
	, async () => {
		const packageDocument = JSON.parse(await readFile("package.json", "utf8"));
		assert.match(packageDocument.scripts["env:check:core"]
			, /test-name-pattern=.*execution profile.*test-profiles\.test\.mjs/u);
		const profileTest = await readFile("tests/test-profiles.test.mjs", "utf8");
		assert.doesNotMatch(profileTest
			, /^import .*test-registration-history\.mjs/mu);
		assert.match(profileTest
			, /await import\(\s*"\.\/helpers\/test-registration-history\.mjs"\)/u);
		assert.match(profileTest
			, /historical test registration checks permit additions/u);
		const checked = await readFile("tests/checked-javascript.test.mjs", "utf8");
		assert.ok(checked.includes(
			"test-name-pattern=.*execution profile.*test-profiles\\.test\\.mjs"));
	}
);

test("sparse Core classification authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, coreStaticClassificationSparseHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, coreStaticClassificationSparseImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.json" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseCoreStaticClassificationSparseUpdate(current, forged));
	}
);

test("sparse Core classification writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-static-classification-sparse-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /core-static-classification-sparse-source-history-20261031\.json/u);
});
