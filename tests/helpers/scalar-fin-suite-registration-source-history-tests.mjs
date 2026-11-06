/**
 * Authenticate the retained Scalar Fin suite registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertScalarFinSuiteRegistration
	, beforeScalarFinSuiteRegistrationSource
	, reverseScalarFinSuiteRegistrationUpdate
	, scalarFinSuiteRegistrationHistoryAdditions
	, scalarFinSuiteRegistrationHistoryPath
	, scalarFinSuiteRegistrationImplementation
	, scalarFinSuiteRegistrationImplementationPaths
	, scalarFinSuiteRegistrationIntegrationPaths
	, scalarFinSuiteRegistrationNormalizationPaths
	, scalarFinSuiteRegistrationPredecessor
} from "./scalar-fin-suite-registration-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	scalarFinSuiteRegistrationHistoryPath, "utf8"));

test("Scalar Fin registration records the complete Core discovery", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "scalar-fin-suite-registration-source-v1");
	assert.equal(history.predecessorCommit
		, scalarFinSuiteRegistrationPredecessor);
	assert.equal(history.implementationCommit
		, scalarFinSuiteRegistrationImplementation);
	assert.deepEqual(history.discovery, {
		workflow: 41302411524, job: 124836045756
		, failure: "tests/scalar-fin-source-entry.test.mjs was absent from the closed repository test-profile manifest"
	});
	assert.equal(history.changedSupportCells, 0);
	assert.equal(history.runtimeSemanticChanges, 0);
	assert.equal(history.livePinRefreshes, 98);
	assert.deepEqual(history.exactModel, {
		sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, bytes: 16916757, cells: 1054, stageEntries: 5270
	});
});

test("Scalar Fin registration is explicit and unique", () => {
	assertScalarFinSuiteRegistration(git(["show"
		, `${scalarFinSuiteRegistrationImplementation}:src/adoption/test-profiles.mjs`]));
});

test("Scalar Fin registration reverses every authenticated source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(update => update.path)
			, scalarFinSuiteRegistrationImplementationPaths);
		for(const update of history.updates)
		{
			const current = git(["show"
				, `${scalarFinSuiteRegistrationImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${scalarFinSuiteRegistrationPredecessor}:${update.path}`]);
			assert.equal(reverseScalarFinSuiteRegistrationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeScalarFinSuiteRegistrationSource(
				update.path, current, update.previousSha256)
				, previous, update.path);
		}
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, scalarFinSuiteRegistrationIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				scalarFinSuiteRegistrationHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${scalarFinSuiteRegistrationImplementation}:${update.path}`]);
			assert.equal(reverseScalarFinSuiteRegistrationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256)
				, previous, update.path);
		}
	}
);

test("Scalar Fin registration refreshes only its complete live pin set"
	, async () => {
		const history = await record();
		assert.deepEqual(history.currentSourcePins, [{
			path: "src/adoption/test-profiles.mjs", count: 98
			, previous: "cd2afbdcbd40042ec7bf9b9eb31882d688cb155a970ad8d09f154eb43f748cdb"
			, current: "3ec58789494f149af921fcab0cafe14231663217a20c90280f3157d90a290aa9"
		}]);
		const inventoryUpdate = history.integrationUpdates.find(update =>
			update.path === "docs/type-surface.v1.json");
		assert.ok(inventoryUpdate);
		const inventory = await sourceAtFinHistoryRecordSource(
			scalarFinSuiteRegistrationHistoryPath, inventoryUpdate.path
			, inventoryUpdate.currentSha256);
		assert.equal(inventory.split(history.currentSourcePins[0].previous)
			.length - 1, 0);
		assert.equal(inventory.split(history.currentSourcePins[0].current)
			.length - 1, 98);
	}
);

test("Scalar Fin registration additions are immutable", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, scalarFinSuiteRegistrationHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const path of scalarFinSuiteRegistrationNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("Scalar Fin registration rejects forged history and duplicate writes"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${scalarFinSuiteRegistrationImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseScalarFinSuiteRegistrationUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-scalar-fin-suite-registration-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
