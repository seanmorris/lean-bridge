/**
 * Authenticate the JVM generic-record Array null-boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertJvmGenericRecordArrayNullBoundaryRepair
	, beforeJvmGenericRecordArrayNullBoundaryRepairSource
	, jvmGenericRecordArrayNullBoundaryRepairHistoryAdditions
	, jvmGenericRecordArrayNullBoundaryRepairHistoryPath
	, jvmGenericRecordArrayNullBoundaryRepairImplementation
	, jvmGenericRecordArrayNullBoundaryRepairImplementationPaths
	, jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths
	, jvmGenericRecordArrayNullBoundaryRepairPredecessor
	, reverseJvmGenericRecordArrayNullBoundaryRepairUpdate
} from "./jvm-generic-record-array-null-boundary-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	jvmGenericRecordArrayNullBoundaryRepairHistoryPath, "utf8"));

test("JVM Array null-boundary repair records the exact hosted discovery"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "jvm-generic-record-array-null-boundary-repair-source-v1");
		assert.equal(history.predecessorCommit
			, jvmGenericRecordArrayNullBoundaryRepairPredecessor);
		assert.equal(history.implementationCommit
			, jvmGenericRecordArrayNullBoundaryRepairImplementation);
		assert.deepEqual(history.discovery, {
			run: 41372695232, job: 125053723860
			, lane: "Managed consumer (jvm)"
			, observed: "NatBox rejected a null required field before the Array rejection harness began"
		});
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.runtimeSemanticChanges, 0);
		assert.equal(history.livePinRefreshes, 0);
	}
);

test("JVM Array null-boundary repair binds the complete current contract"
	, async () => {
		const sources = Object.fromEntries(
			jvmGenericRecordArrayNullBoundaryRepairImplementationPaths
				.map(path => [path
					, git(["show"
					, `${jvmGenericRecordArrayNullBoundaryRepairImplementation}:${path}`])])
		);
		assert.deepEqual(assertJvmGenericRecordArrayNullBoundaryRepair(sources), {
			javaArrayChecks: 1071, changedSupportCells: 0
			, runtimeSemanticChanges: 0
		});
		const history = await record();
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		for(const mutate of [
			value => { value[
				"tests/fixtures/generic-record-array-consumers/java.java"]
				= value[
					"tests/fixtures/generic-record-array-consumers/java.java"]
					.replace("nullField[failedPosition] = new NatBox(null"
						, "brokenRows[2][position] = new NatBox(null"); }
			, value => { value["tests/helpers/generic-record-arrays.mjs"]
				= value["tests/helpers/generic-record-arrays.mjs"]
					.replace("checks: 1071", "checks: 1070"); }
		]) {
			const changed = structuredClone(sources); mutate(changed);
			assert.throws(() =>
				assertJvmGenericRecordArrayNullBoundaryRepair(changed));
		}
	}
);

test("JVM Array null-boundary repair reverses every authenticated source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(update => update.path)
			, jvmGenericRecordArrayNullBoundaryRepairImplementationPaths);
		for(const update of history.updates)
		{
			const current = git(["show"
				, `${jvmGenericRecordArrayNullBoundaryRepairImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${jvmGenericRecordArrayNullBoundaryRepairPredecessor}:${update.path}`]);
			assert.equal(reverseJvmGenericRecordArrayNullBoundaryRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeJvmGenericRecordArrayNullBoundaryRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				jvmGenericRecordArrayNullBoundaryRepairHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${jvmGenericRecordArrayNullBoundaryRepairImplementation}:${update.path}`]);
			assert.equal(reverseJvmGenericRecordArrayNullBoundaryRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of [
			...jvmGenericRecordArrayNullBoundaryRepairImplementationPaths
			, ...jvmGenericRecordArrayNullBoundaryRepairIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("JVM Array null-boundary history additions are immutable and strict"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, jvmGenericRecordArrayNullBoundaryRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, `${jvmGenericRecordArrayNullBoundaryRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseJvmGenericRecordArrayNullBoundaryRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-jvm-generic-record-array-null-boundary-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
