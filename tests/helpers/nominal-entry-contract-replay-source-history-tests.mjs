/**
 * Authenticate the nominal-entry historical-contract replay repair.
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
	beforeNominalEntryContractReplaySource
	, nominalEntryContractReplayHistoryAdditions
	, nominalEntryContractReplayHistoryPath
	, nominalEntryContractReplayImplementation
	, nominalEntryContractReplayImplementationPaths
	, nominalEntryContractReplayIntegrationPaths
	, nominalEntryContractReplayPredecessor
	, reverseNominalEntryContractReplayUpdate
} from "./nominal-entry-contract-replay-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	nominalEntryContractReplayHistoryPath, "utf8"));

test("nominal-entry replay repair records the exact old-head failures", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "nominal-entry-contract-replay-source-v1");
	assert.equal(history.predecessorCommit
		, nominalEntryContractReplayPredecessor);
	assert.equal(history.implementationCommit
		, nominalEntryContractReplayImplementation);
	assert.equal(history.diagnosticCoreRun, 41117023757);
	assert.deepEqual(history.repairs, [
		"historical-binding-ir-and-consumer-contract"
		, "exact-source-history-milestone"
		, "publication-time-addition-identity"
	]);
	assert.deepEqual(history.updates.map(item => item.path)
		, nominalEntryContractReplayImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, nominalEntryContractReplayIntegrationPaths);
});

test("nominal-entry replay repair reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			nominalEntryContractReplayImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${nominalEntryContractReplayImplementation}:${update.path}`]);
		assert.equal(reverseNominalEntryContractReplayUpdate(
			current, update), previous, update.path);
		assert.equal(beforeNominalEntryContractReplaySource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("nominal-entry replay uses each recorded contract and source", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, nominalEntryContractReplayHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const [measurement, promotion, publication] = await Promise.all(
		nominalEntryContractReplayImplementationPaths.map(path =>
			readFile(path, "utf8"))
	);
	assert.ok(measurement.includes("sourceAtFinHistoryMilestone("));
	assert.ok(promotion.includes(
		'gitJson(implementation, "schema/binding-ir.schema.json")'));
	assert.ok(publication.includes(
		'gitJson(beforeCommit, "schema/binding-ir.schema.json")'));
	assert.ok(publication.includes(
		"nominalSubtypeEntryPublicationCommit}:${addition.path}"));
});

test("nominal-entry replay repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${nominalEntryContractReplayImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseNominalEntryContractReplayUpdate(current, forged));
});

test("nominal-entry replay history writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-nominal-entry-contract-replay-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /nominal-entry-contract-replay-source-history-20261030\.json/u);
});
