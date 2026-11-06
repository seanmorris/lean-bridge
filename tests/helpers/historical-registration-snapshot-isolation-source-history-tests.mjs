/**
 * Authenticate the historical registration-snapshot isolation repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeHistoricalRegistrationSnapshotIsolationSource
	, historicalRegistrationSnapshotIsolationHistoryAdditions
	, historicalRegistrationSnapshotIsolationHistoryPath
	, historicalRegistrationSnapshotIsolationImplementation
	, historicalRegistrationSnapshotIsolationImplementationPaths
	, historicalRegistrationSnapshotIsolationIntegrationPaths
	, historicalRegistrationSnapshotIsolationPredecessor
	, reverseHistoricalRegistrationSnapshotIsolationUpdate
} from "./historical-registration-snapshot-isolation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	historicalRegistrationSnapshotIsolationHistoryPath, "utf8"));

test("historical registration isolation records both exact repairs", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "historical-registration-snapshot-isolation-v1");
	assert.equal(value.predecessorCommit
		, historicalRegistrationSnapshotIsolationPredecessor);
	assert.equal(value.implementationCommit
		, historicalRegistrationSnapshotIsolationImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, historicalRegistrationSnapshotIsolationImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, historicalRegistrationSnapshotIsolationIntegrationPaths);
});

test("historical registration isolation removes every live exact-handoff hash"
	, () => {
		const [genericPath, perlPath]
			= historicalRegistrationSnapshotIsolationImplementationPaths;
		const generic = git(["show"
			, `${historicalRegistrationSnapshotIsolationImplementation}:`
				+ genericPath]);
		assert.match(generic, /retainedContractScopeRepairPredecessor/u);
		assert.match(generic, /execFileSync\("git", \["show"/u);
		assert.match(generic, /retains lazy registration/u);
		assert.doesNotMatch(generic
			, /text = await readFile\(path, "utf8"\)/u);
		const perl = git(["show"
			, `${historicalRegistrationSnapshotIsolationImplementation}:`
				+ perlPath]);
		assert.match(perl, /sourceAtHistoryMilestone\(/u);
		assert.match(perl, /await readFile\(path, "utf8"\).*counts/u);
		assert.doesNotMatch(perl
			, /source = await readFile\("tests\/perl-fin\.test\.mjs"/u);
	}
);

test("historical registration isolation reverses source and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${historicalRegistrationSnapshotIsolationImplementation}:`
					+ update.path]);
			const previous = git(["show"
				, `${historicalRegistrationSnapshotIsolationPredecessor}:`
					+ update.path]);
			assert.equal(
				reverseHistoricalRegistrationSnapshotIsolationUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeHistoricalRegistrationSnapshotIsolationSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				historicalRegistrationSnapshotIsolationHistoryPath, update.path
					, update.currentSha256);
			const previous = git(["show"
				, `${historicalRegistrationSnapshotIsolationImplementation}:`
					+ update.path]);
			assert.equal(
				reverseHistoricalRegistrationSnapshotIsolationUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("historical registration isolation authenticates additions and model"
	, async () => {
		const value = await record();
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(value.changedSupportCells, 0);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, historicalRegistrationSnapshotIsolationHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${historicalRegistrationSnapshotIsolationImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of historicalRegistrationSnapshotIsolationIntegrationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		const exactSources = [historicalRegistrationSnapshotIsolationPredecessor
			, historicalRegistrationSnapshotIsolationImplementation].map(commit =>
			git(["show", `${commit}:${exactModelPath}`]));
		assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
	}
);

test("historical registration isolation writer refuses an existing history"
	, () => {
		const result = spawnSync(process.execPath, [
			"scripts/update-historical-registration-snapshot-isolation-source-history.mjs"
		], { encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /History already exists/u);
	}
);
