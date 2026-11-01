/**
 * Authenticate the nominal callback-result refinement repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertNominalCallbackResultRepair
	, beforeNominalCallbackResultRepairSource
	, nominalCallbackResultRepairHistoryAdditions
	, nominalCallbackResultRepairHistoryPath
	, nominalCallbackResultRepairImplementation
	, nominalCallbackResultRepairImplementationPaths
	, nominalCallbackResultRepairIntegrationPaths
	, nominalCallbackResultRepairPinAdditions
	, nominalCallbackResultRepairPinCommit
	, nominalCallbackResultRepairPinPaths
	, nominalCallbackResultRepairPredecessor
	, reverseNominalCallbackResultRepairUpdate
} from "./nominal-callback-result-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	nominalCallbackResultRepairHistoryPath, "utf8"));

test("nominal callback-result repair records the observed semantic failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "nominal-callback-result-repair-v1");
		assert.equal(history.predecessorCommit
			, nominalCallbackResultRepairPredecessor);
		assert.equal(history.implementationCommit
			, nominalCallbackResultRepairImplementation);
		assert.equal(history.pinCommit, nominalCallbackResultRepairPinCommit);
		assert.deepEqual(history.discovery, {
			run: 41275246725, job: 124761649316
			, workflow: "Downstream consumer contract"
			, contract: "checked Fin callbacks and closures compile, reproduce and recover in installed npm packages"
			, observed: "raw nominal callback reply outside Fin bound returned normally"
			, expected: "status 5 expectation violation"
		});
	}
);

test("nominal callback-result repair binds native and contract behavior"
	, async () => {
		const history = await record();
		const sources = nominalCallbackResultRepairImplementationPaths.map(path =>
			git(["show", `${nominalCallbackResultRepairImplementation}:${path}`]));
		assertNominalCallbackResultRepair(...sources);
		assert.deepEqual(history.repair, {
			mirror: "compiler-normalized shared nominal refinements"
			, boundary: "native callback result trampoline"
			, violationStatus: 5, refreshedLiveCitations: 7
		});
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.runtimeSemanticChanges, 1);
	}
);

test("nominal callback-result repair reverses every authenticated stage"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(update => update.path)
			, nominalCallbackResultRepairImplementationPaths);
		for(const update of history.updates)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				nominalCallbackResultRepairImplementation, update.path), update)
			, true, update.path);
			const current = git(["show"
				, `${nominalCallbackResultRepairImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${nominalCallbackResultRepairPredecessor}:${update.path}`]);
			assert.equal(beforeNominalCallbackResultRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		assert.deepEqual(history.pinUpdates.map(update => update.path)
			, nominalCallbackResultRepairPinPaths);
		for(const update of history.pinUpdates)
		{
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				nominalCallbackResultRepairPinCommit, update.path), update)
			, true, update.path);
			const current = git(["show"
				, `${nominalCallbackResultRepairPinCommit}:${update.path}`]);
			const previous = git(["show"
				, `${nominalCallbackResultRepairImplementation}:${update.path}`]);
			assert.equal(beforeNominalCallbackResultRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, nominalCallbackResultRepairIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${nominalCallbackResultRepairPinCommit}:${update.path}`]);
			assert.equal(reverseNominalCallbackResultRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of [
			...nominalCallbackResultRepairImplementationPaths
			, ...nominalCallbackResultRepairPinPaths
			, ...nominalCallbackResultRepairIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("nominal callback-result repair binds additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.pinAdditions.map(item => item.path)
			, nominalCallbackResultRepairPinAdditions);
		for(const addition of history.pinAdditions)
		{
			const source = git(["show"
				, `${nominalCallbackResultRepairPinCommit}:${addition.path}`]);
			assert.equal(sha256(source), addition.sha256, addition.path);
		}
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, nominalCallbackResultRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, `${nominalCallbackResultRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseNominalCallbackResultRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-nominal-callback-result-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
