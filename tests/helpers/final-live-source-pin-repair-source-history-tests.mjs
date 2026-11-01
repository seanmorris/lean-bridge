/**
 * Authenticate the final exact-candidate live-source pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceEvidenceFiles }
	from "../../src/adoption/type-surface-evidence-receipt.mjs";
import {
	beforeFinalLiveSourcePinRepairSource
	, finalLiveSourcePinRepairHistoryAdditions
	, finalLiveSourcePinRepairHistoryPath
	, finalLiveSourcePinRepairImplementation
	, finalLiveSourcePinRepairImplementationPaths
	, finalLiveSourcePinRepairIntegrationPaths
	, finalLiveSourcePinRepairPredecessor
	, reverseFinalLiveSourcePinRepairUpdate
} from "./final-live-source-pin-repair-source-history.mjs";
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
	finalLiveSourcePinRepairHistoryPath, "utf8"));

test("final live-source pin repair records the complete stale cohort", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "final-live-source-pin-repair-source-v1");
	assert.equal(history.predecessorCommit, finalLiveSourcePinRepairPredecessor);
	assert.equal(history.implementationCommit, finalLiveSourcePinRepairImplementation);
	assert.deepEqual(history.discovery, {
		candidate: finalLiveSourcePinRepairPredecessor
		, gate: "all current live-source pins match in one complete pass"
		, stalePaths: 4, stalePins: 136, missingPaths: 0
	});
	assert.deepEqual(history.pinTransitions.map(item => ({
		path: item.path, count: item.count
	})), [
		{ path: ".github/workflows/consumer-matrix.yml", count: 92 }
		, { path: ".github/workflows/perl-consumer.yml", count: 13 }
		, { path: "tests/documentation.test.mjs", count: 25 }
		, { path: "tests/helpers/checked-record-promotion-tests.mjs", count: 6 }
	]);
	assert.equal(history.pinTransitions.reduce(
		(sum, item) => sum + item.count, 0), 136);
});

test("final live-source pin repair reverses every authenticated source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(item => item.path)
			, finalLiveSourcePinRepairImplementationPaths);
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				finalLiveSourcePinRepairImplementation, update.path), update)
			, true, update.path);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, finalLiveSourcePinRepairIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${finalLiveSourcePinRepairImplementation}:${update.path}`]);
			assert.equal(reverseFinalLiveSourcePinRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinalLiveSourcePinRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of [
			...finalLiveSourcePinRepairImplementationPaths
			, ...finalLiveSourcePinRepairIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("final live-source repair authenticates all current pins in one pass"
	, async () => {
		const history = await record();
		const document = JSON.parse(git(["show"
			, `${finalLiveSourcePinRepairImplementation}:docs/type-surface.v1.json`]));
		const files = typeSurfaceEvidenceFiles(document).filter(file =>
			!file.path.startsWith("docs/evidence/"));
		const expected = new Map(files.map(file => [file.path, file.sha256]));
		const mismatches = [], missing = [];
		for(let offset = 0; offset < files.length; offset += 16)
		{
			const batch = files.slice(offset, offset + 16);
			const actual = await Promise.all(batch.map(async file => {
				try
				{
					return createHash("sha256").update(
						await readFile(file.path)).digest("hex");
				}
				catch(error)
				{ missing.push({ path: file.path, code: error.code }); return null; }
			}));
			for(const [index, file] of batch.entries())
				if(actual[index] !== null && actual[index] !== expected.get(file.path))
					mismatches.push({ path: file.path, actual: actual[index]
						, expected: expected.get(file.path) });
		}
		assert.equal(files.length, 2661);
		assert.deepEqual(missing, []);
		assert.deepEqual(mismatches, []);
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.runtimeSemanticChanges, 0);
	}
);

test("final live-source pin repair rejects forgeries and another writer"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, finalLiveSourcePinRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, `${finalLiveSourcePinRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseFinalLiveSourcePinRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-final-live-source-pin-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|implementation revision/u);
	}
);
